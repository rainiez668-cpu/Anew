import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const previousProvider = process.env.AI_PROVIDER;

function request(body: unknown): Request {
  return new Request("https://anew.test/api/review-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Review chat route", () => {
  afterEach(() => {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  });

  it("keeps the Chinese Mock reply available", async () => {
    process.env.AI_PROVIDER = "mock";
    const response = await POST(request({
      locale: "zh-CN",
      messages: [{ role: "user", text: "今天有点累" }],
    }));
    const data = (await response.json()) as { source?: string; reply?: string };

    expect(response.status).toBe(200);
    expect(data.source).toBe("mock");
    expect(data.reply).toMatch(/[\u3400-\u9fff]/);
  });

  it("rejects malformed message payloads", async () => {
    const response = await POST(request({ messages: "not an array" }));
    expect(response.status).toBe(400);
  });
});
