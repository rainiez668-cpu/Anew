import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { hintMotion, readSwipeHintSeen, saveSwipeHintSeen, SwipeHintTouch, SWIPE_HINT_STORAGE_KEY } from "./swipe-hint";

describe("swipe hint", () => {
  it("moves left then right and returns to the center without choosing a task", () => {
    expect(hintMotion(0)).toEqual({ x: 0, rotation: 0 });
    expect(hintMotion(0.22)).toEqual({ x: -14, rotation: -2 });
    expect(hintMotion(0.45)).toEqual({ x: 0, rotation: 0 });
    expect(hintMotion(0.72)).toEqual({ x: 14, rotation: 2 });
    expect(hintMotion(1)).toEqual({ x: 0, rotation: 0 });
  });

  it("uses a decorative 30px touch point", () => {
    const markup = renderToStaticMarkup(<SwipeHintTouch x={5} />);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain("h-[30px] w-[30px]");
  });

  it("persists completion independently and tolerates storage failure", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(readSwipeHintSeen(storage)).toBe(false);
    expect(saveSwipeHintSeen(storage)).toBe(true);
    expect(values.get(SWIPE_HINT_STORAGE_KEY)).toBe("1");
    expect(readSwipeHintSeen(storage)).toBe(true);
    expect(readSwipeHintSeen({ getItem: vi.fn(() => { throw new Error("blocked"); }) })).toBe(false);
    expect(saveSwipeHintSeen({ setItem: vi.fn(() => { throw new Error("quota"); }) })).toBe(false);
  });
});
