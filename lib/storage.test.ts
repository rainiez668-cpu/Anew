import { describe, expect, it } from "vitest";
import { parseLegacyExport } from "./storage";

const validExport = {
  app: "HamLoop",
  exportedAt: "2026-06-14T00:00:00.000Z",
  version: "0.1.0",
  tasks: [],
  reviews: [],
  dailyBasics: [],
};

describe("parseLegacyExport", () => {
  it("accepts a legacy export", () => {
    expect(parseLegacyExport(JSON.stringify(validExport))).toMatchObject(validExport);
  });

  it("accepts a valid Anew export", () => {
    const anewExport = { ...validExport, app: "Anew" as const };
    expect(parseLegacyExport(JSON.stringify(anewExport))).toMatchObject(anewExport);
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseLegacyExport('{"app":"Other"}')).toThrow(
      "That does not look like an Anew export.",
    );
  });

  it("rejects malformed collections", () => {
    expect(() =>
      parseLegacyExport(JSON.stringify({ ...validExport, tasks: [{ title: "Incomplete" }] })),
    ).toThrow("The tasks data in this export is invalid.");
  });

  it("rejects task values that could break the UI", () => {
    const now = "2026-06-14T00:00:00.000Z";
    expect(() =>
      parseLegacyExport(
        JSON.stringify({
          ...validExport,
          tasks: [
            {
              id: "task-1",
              title: "Bad type",
              type: "unknown",
              status: "candidate",
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      ),
    ).toThrow("The tasks data in this export is invalid.");
  });

  it("accepts exports using an expanded color theme", () => {
    expect(() =>
      parseLegacyExport(
        JSON.stringify({
          ...validExport,
          loopState: {
            day: "2026-06-14",
            theme: "Glacier",
            locale: "zh-CN",
            swiped: 0,
            basicsDone: {},
            stepsDone: {},
            generated: false,
            basics: [],
            msgs: [],
          },
        }),
      ),
    ).not.toThrow();
  });
});
