import { describe, expect, it } from "vitest";
import { resolveLocale } from "./i18n";

describe("resolveLocale", () => {
  it("prefers a saved user locale over the deployment default", () => {
    expect(resolveLocale("en", "zh-CN")).toBe("en");
    expect(resolveLocale("zh-CN", "en")).toBe("zh-CN");
  });

  it("uses the deployment default when no valid saved locale exists", () => {
    expect(resolveLocale(undefined, "zh-CN")).toBe("zh-CN");
    expect(resolveLocale("invalid", "zh-CN")).toBe("zh-CN");
  });

  it("falls back to English when the deployment default is missing or invalid", () => {
    expect(resolveLocale(undefined, undefined)).toBe("en");
    expect(resolveLocale(undefined, "fr")).toBe("en");
  });
});
