import { guardJsonRequest } from "@/lib/api-guard";

// POST /api/review-chat
//
// Conversational companion for the evening Review tab. Takes the running
// conversation and returns ONE short, supportive reply — this is the "talk to
// it" half of Review; the separate /api/ai-plan endpoint turns the same
// conversation into tomorrow's candidate tasks. Same three interchangeable
// providers as ai-plan (mock / openai / anthropic), selected via AI_PROVIDER or
// auto-detected from whichever key is present. Any failure falls back to a
// gentle canned reply so the chat never dead-ends. Keys stay server-side.

export const dynamic = "force-dynamic";

const PROVIDER_TIMEOUT_MS = 15_000;

type Provider = "mock" | "openai" | "anthropic";
type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  text: string;
}

interface ChatRequest {
  messages?: ChatMessage[];
  locale?: "en" | "zh-CN";
}

const SYSTEM_PROMPT =
  "You are Anew's evening companion — a warm, ADHD-friendly daily planning coach. " +
  "The user is doing a short end-of-day review. Reply in ONE to THREE sentences: " +
  "acknowledge what they shared, reflect it back kindly, and ask at most one gentle " +
  "follow-up. Celebrate small wins; never lecture or pile on tasks. Do NOT produce " +
  "task lists or JSON — a separate planner handles tomorrow's tasks. Plain text only.";

export async function POST(request: Request) {
  const guarded = await guardJsonRequest(request, {
    scope: "review-chat",
    maxBytes: 24_000,
    limit: 30,
    windowMs: 10 * 60_000,
  });
  if (!guarded.ok) return guarded.response;
  const body =
    guarded.body && typeof guarded.body === "object"
      ? (guarded.body as ChatRequest)
      : {};

  const messages = sanitizeMessages(body.messages);
  const locale = body.locale === "zh-CN" ||
    (body.locale !== "en" && messages.some((message) => /[\u3400-\u9fff]/.test(message.text)))
    ? "zh-CN"
    : "en";
  const provider = resolveProvider();

  if (provider !== "mock") {
    try {
      const reply =
        provider === "anthropic"
          ? await callAnthropic(process.env.ANTHROPIC_API_KEY, messages, locale)
          : await callOpenAI(process.env.OPENAI_API_KEY, messages, locale);
      const clean = reply.trim();
      if (clean) return Response.json({ source: "review-chat", reply: clean });
    } catch {
      // Fall through to the mock.
    }
  }

  return Response.json({ source: "mock", reply: mockReply(messages, locale) });
}

// --- Provider selection (mirrors /api/ai-plan) ----------------------------

function resolveProvider(): Provider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "mock" || explicit === "openai" || explicit === "anthropic") {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

// Drop anything malformed and cap length so a long journal can't blow the
// context window. Keep the last 20 turns — plenty for an evening review.
function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role: Role = o.role === "assistant" ? "assistant" : "user";
    const text = typeof o.text === "string" ? o.text.trim().slice(0, 1000) : "";
    if (text) out.push({ role, text });
  }
  return out.slice(-20);
}

async function callOpenAI(key: string | undefined, messages: ChatMessage[], locale: "en" | "zh-CN"): Promise<string> {
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 200,
      messages: [
        { role: "system", content: localizedPrompt(locale) },
        ...messages.map((m) => ({ role: m.role, content: m.text })),
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("no content");
  return content;
}

async function callAnthropic(key: string | undefined, messages: ChatMessage[], locale: "en" | "zh-CN"): Promise<string> {
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  // Anthropic requires the first message to be from the user; the client only
  // ever sends after a user turn, but guard anyway.
  const convo = messages.length && messages[0].role === "user" ? messages : [{ role: "user" as Role, text: "(no message)" }, ...messages];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: localizedPrompt(locale),
      messages: convo.map((m) => ({ role: m.role, content: m.text })),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  if (data?.stop_reason === "refusal") throw new Error("Anthropic refusal");
  const blocks: Array<{ type?: string; text?: unknown }> = Array.isArray(data?.content) ? data.content : [];
  const text = blocks.find((b) => b?.type === "text")?.text;
  if (typeof text !== "string") throw new Error("no content");
  return text;
}

// --- Mock fallback: a kind reply that keeps the loop closing -----------------

function localizedPrompt(locale: "en" | "zh-CN"): string {
  return locale === "zh-CN"
    ? `${SYSTEM_PROMPT} Reply in Simplified Chinese.`
    : SYSTEM_PROMPT;
}

function mockReply(messages: ChatMessage[], locale: "en" | "zh-CN" = "en"): string {
  const last = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";
  if (locale === "zh-CN") {
    if (!last) return "我在这里，准备好后告诉我今天过得怎么样。";
    if (/(累|疲惫|精疲力尽|耗尽|倦)/.test(last) || /(tired|exhausted|drained|burn)/i.test(last)) {
      return "听起来今天很辛苦。即使精力不多，你仍然完成了一些事；有什么小事还算顺利吗？";
    }
    if (/(完成|做完|做好|修好|发布|发出|结束)/.test(last) || /(shipped|built|finished|done|fixed|launched)/i.test(last)) {
      return "做得好，这些都是实实在在的进展。明天想从中延续哪一个小部分？";
    }
    if (/(卡住|受阻|失败|困难|不顺|没能)/.test(last) || /(stuck|blocked|couldn't|failed|hard)/i.test(last)) {
      return "遇到阻碍很正常，并不代表你退步了。明天怎样迈出更容易的第一步？";
    }
    return "收到，谢谢你记录下今天。还有什么值得在明天之前留意的吗？";
  }
  if (!last) return "I'm here whenever you're ready — what did today look like?";
  const lower = last.toLowerCase();
  if (/(tired|exhausted|drained|burn)/.test(lower)) {
    return "Sounds like a heavy day — getting anything done while running low still counts. What's one thing that went okay?";
  }
  if (/(shipped|built|finished|done|fixed|launched)/.test(lower)) {
    return "Nice — that's real momentum. Want to carry a small piece of that into tomorrow?";
  }
  if (/(stuck|blocked|couldn't|failed|hard)/.test(lower)) {
    return "Getting blocked is part of building, not a step back. What might make the first move easier tomorrow?";
  }
  return "Got it — thanks for closing the loop on that. Anything else from today worth noting before we plan tomorrow?";
}
