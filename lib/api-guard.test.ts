import { describe, expect, it } from "vitest";
import { guardJsonRequest } from "./api-guard";

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
});
