import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const previousProvider = process.env.AI_PROVIDER;

function request(body: unknown): Request {
  return new Request("https://anew.test/api/ai-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("AI plan route", () => {
  afterEach(() => {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  });

  it("keeps the Mock planner available and localized", async () => {
    process.env.AI_PROVIDER = "mock";
    const response = await POST(request({ locale: "zh-CN", reviewText: "今天有点累" }));
    const data = (await response.json()) as { source?: string; tasks?: { title: string }[] };

    expect(response.status).toBe(200);
    expect(data.source).toBe("mock");
    expect(data.tasks?.length).toBeGreaterThanOrEqual(5);
    expect(data.tasks?.[0]?.title).toMatch(/[\u3400-\u9fff]/);
  });

  it("rejects malformed payload field types", async () => {
    const response = await POST(request({ reviewText: 42 }));
    expect(response.status).toBe(400);
  });

  it("rejects bodies over the route limit", async () => {
    const response = await POST(request({ reviewText: "a".repeat(21_000) }));
    expect(response.status).toBe(413);
  });
});
