import { guardJsonRequest } from "@/lib/api-guard";
import type { EnergyLevel, Task, TaskType } from "@/lib/types";

// POST /api/ai-plan
//
// Generates 5–10 small candidate tasks for tomorrow from the user's daily review
// and current context. Supports three interchangeable providers — mock / openai /
// anthropic — selected via the AI_PROVIDER env var, or auto-detected from whichever
// API key is present. Whatever a provider returns is run through the SAME
// sanitizeTask cleaner, so all validation/clamping lives in one place. API keys are
// read only on the server and never returned to the client. Any failure (missing
// key, network error, non-200, refusal, bad JSON, too few tasks) falls back to mock.

export const dynamic = "force-dynamic";

type Provider = "mock" | "openai" | "anthropic";

interface PlanRequest {
  reviewText?: string;
  currentTasks?: string[];
  completedTasks?: string[];
  dailyBasics?: { label: string; done: boolean }[];
}

const TASK_TYPES: TaskType[] = [
  "focus",
  "quick",
  "errand",
  "health",
  "admin",
  "life",
];
const ENERGIES: EnergyLevel[] = ["low", "medium", "high"];
const PROVIDER_TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT =
  "You are the planning assistant for Anew, an ADHD-friendly daily planning app. " +
  "From the user's end-of-day review and context, propose 6 to 8 small candidate tasks for tomorrow. " +
  "Rules: every task must be concrete and doable in 5 to 60 minutes; keep titles short; " +
  "favour momentum over ambition; vary the task types; never invent large multi-hour tasks. " +
  `Respond ONLY with JSON of the form {"tasks":[{"title":string,"reason":string,"type":one of ${TASK_TYPES.join(
    "|",
  )},"minutes":integer between 5 and 60,"energy":one of low|medium|high}]}.`;

export async function POST(request: Request) {
  const guarded = await guardJsonRequest(request, {
    scope: "ai-plan",
    maxBytes: 20_000,
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!guarded.ok) return guarded.response;
  const body = sanitizePlanRequest(guarded.body);

  const provider = resolveProvider();
  if (provider !== "mock") {
    try {
      const raw =
        provider === "anthropic"
          ? await callAnthropic(process.env.ANTHROPIC_API_KEY, body)
          : await callOpenAI(process.env.OPENAI_API_KEY, body);
      const tasks = cleanAll(raw).slice(0, 10);
      if (tasks.length >= 5) {
        return Response.json({ source: "ai-plan", tasks });
      }
    } catch {
      // Fall through to the mock.
    }
  }
  return Response.json({ source: "mock", tasks: cleanAll(mockRaw(body)) });
}

function cleanString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, 160))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function sanitizePlanRequest(input: unknown): PlanRequest {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>;
  const basics = Array.isArray(value.dailyBasics)
    ? value.dailyBasics
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object",
        )
        .map((item) => ({
          label: cleanString(item.label, 80),
          done: item.done === true,
        }))
        .filter((item) => item.label)
        .slice(0, 30)
    : [];

  return {
    reviewText: cleanString(value.reviewText, 6_000),
    currentTasks: cleanStringArray(value.currentTasks, 50),
    completedTasks: cleanStringArray(value.completedTasks, 50),
    dailyBasics: basics,
  };
}

// --- Provider selection ---------------------------------------------------

function resolveProvider(): Provider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "mock" || explicit === "openai" || explicit === "anthropic") {
    return explicit;
  }
  // Auto-detect from whichever key is configured; default to mock.
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

// --- Providers: each returns RAW, untrusted candidate items ---------------
// Cleaning happens once, in cleanAll → sanitizeTask.

function buildUserContent(ctx: PlanRequest): string {
  return JSON.stringify({
    review: ctx.reviewText ?? "",
    inProgress: ctx.currentTasks ?? [],
    completedToday: ctx.completedTasks ?? [],
    dailyBasics: ctx.dailyBasics ?? [],
  });
}

function parseTasks(content: string): unknown[] {
  const parsed = JSON.parse(content) as { tasks?: unknown };
  return Array.isArray(parsed.tasks) ? parsed.tasks : [];
}

async function callOpenAI(key: string | undefined, ctx: PlanRequest): Promise<unknown[]> {
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserContent(ctx) },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("no content");
  return parseTasks(content);
}

// JSON schema for Anthropic structured outputs (GA on claude-opus-4-8). The 5–60
// minute range isn't expressible in json_schema — sanitizeTask clamps it.
const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          type: { type: "string", enum: TASK_TYPES },
          minutes: { type: "integer" },
          energy: { type: "string", enum: ENERGIES },
        },
        required: ["title", "reason", "type", "minutes", "energy"],
      },
    },
  },
  required: ["tasks"],
};

async function callAnthropic(key: string | undefined, ctx: PlanRequest): Promise<unknown[]> {
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    // No temperature / thinking budget — those 400 on claude-opus-4-8.
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(ctx) }],
      output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
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
  return parseTasks(text);
}

// --- Mock fallback: also RAW items, so it flows through the same cleaner ---

function mockRaw(_ctx: PlanRequest): unknown[] {
  return [
    { title: "The one thing that matters today", reason: "Start with a single clear focus", type: "focus", minutes: 30, energy: "medium" },
    { title: "Do one small errand you keep putting off", reason: "Clear a nagging open loop", type: "errand", minutes: 15, energy: "low" },
    { title: "Reply to two messages", reason: "Clear the deck", type: "admin", minutes: 15, energy: "low" },
    { title: "Write tonight's short review", reason: "Feed tomorrow's plan", type: "quick", minutes: 5, energy: "low" },
    { title: "Move for ten minutes", reason: "Reset energy", type: "health", minutes: 10, energy: "low" },
    { title: "Tidy one surface for ten minutes", reason: "Lighter space, lighter head", type: "life", minutes: 10, energy: "low" },
  ];
}

// --- The one shared cleaner -----------------------------------------------

function cleanAll(items: unknown[]): Task[] {
  return items.map((item, i) => sanitizeTask(item, i)).filter((t): t is Task => t !== null);
}

// Coerce one untrusted item into a safe Task, or null if unusable. The server owns
// id / status / source / timestamps; the model only suggests the content, and
// minutes are clamped to 5–60 so tasks always stay small.
function sanitizeTask(item: unknown, index: number): Task | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;

  const title = typeof o.title === "string" ? o.title.trim().slice(0, 80) : "";
  if (!title) return null;

  const type = TASK_TYPES.includes(o.type as TaskType) ? (o.type as TaskType) : "focus";
  const energy = ENERGIES.includes(o.energy as EnergyLevel) ? (o.energy as EnergyLevel) : "medium";

  const rawMinutes = typeof o.minutes === "number" ? o.minutes : Number(o.minutes);
  const minutes = Number.isFinite(rawMinutes) ? Math.min(60, Math.max(5, Math.round(rawMinutes))) : 20;

  const reason =
    typeof o.reason === "string" && o.reason.trim() ? o.reason.trim().slice(0, 160) : "Suggested for tomorrow";

  const now = new Date().toISOString();
  return {
    id: `ai-${Date.now()}-${index}`,
    title,
    reason,
    type,
    minutes,
    energy,
    status: "candidate",
    source: "ai-plan",
    createdAt: now,
    updatedAt: now,
  };
}
