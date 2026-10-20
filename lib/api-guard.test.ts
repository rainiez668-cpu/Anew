import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __rateLimitSizeForTests,
  __resetApiGuardForTests,
  clientId,
  guardJsonRequest,
  realAiProductionGuard,
} from "./api-guard";

function jsonRequest(body: string, ip: string): Request {
  return new Request("https://anew.test/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body,
  });
}

describe("API guard", () => {
  beforeEach(() => __resetApiGuardForTests());
  afterEach(() => vi.restoreAllMocks());

  it("parses a valid JSON request", async () => {
    const result = await guardJsonRequest(jsonRequest('{"ok":true}', "test-valid"), {
      scope: "valid",
      maxBytes: 100,
      limit: 2,
      windowMs: 60_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toEqual({ ok: true });
  });

  it("rejects oversized request bodies", async () => {
    const result = await guardJsonRequest(jsonRequest('{"text":"too long"}', "test-size"), {
      scope: "size",
      maxBytes: 5,
      limit: 2,
      windowMs: 60_000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("rate limits repeated requests within the window", async () => {
    const options = {
      scope: "rate",
      maxBytes: 100,
      limit: 1,
      windowMs: 60_000,
    };
    await guardJsonRequest(jsonRequest("{}", "test-rate"), options);
    const result = await guardJsonRequest(jsonRequest("{}", "test-rate"), options);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
  });

  it("does not trust a forwarded IP outside an explicitly trusted proxy", () => {
    expect(clientId(jsonRequest("{}", "203.0.113.9"))).toBe("unknown");
  });

  it("uses one conservative bucket when a trusted IP is unavailable", async () => {
    const options = { scope: "unknown", maxBytes: 100, limit: 1, windowMs: 60_000 };
    await guardJsonRequest(jsonRequest("{}", "198.51.100.1"), options);
    const result = await guardJsonRequest(jsonRequest("{}", "198.51.100.2"), options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
  });

  it("prunes expired records without a background interval", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    await guardJsonRequest(jsonRequest("{}", "old-entry"), {
      scope: "expiry",
      maxBytes: 100,
      limit: 2,
      windowMs: 1,
    });
    expect(__rateLimitSizeForTests()).toBe(1);

    vi.spyOn(Date, "now").mockReturnValue(1_060_001);
    await guardJsonRequest(jsonRequest("{}", "new-entry"), {
      scope: "expiry-next",
      maxBytes: 100,
      limit: 2,
      windowMs: 60_000,
    });
    expect(__rateLimitSizeForTests()).toBe(1);
  });

  it("caps in-memory rate-limit records", async () => {
    for (let index = 0; index < 10_001; index += 1) {
      await guardJsonRequest(jsonRequest("{}", `192.0.2.${index}`), {
        scope: `capacity-${index}`,
        maxBytes: 100,
        limit: 1,
        windowMs: 60_000,
      });
    }
    expect(__rateLimitSizeForTests()).toBe(10_000);
  });

  it("blocks real providers in production until shared limiting exists", () => {
    expect(realAiProductionGuard("openai", "production")?.status).toBe(503);
    expect(realAiProductionGuard("mock", "production")).toBeNull();
  });
});
