"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const HINT_DISTANCE = 14;
export const HINT_DELAY_MS = 750;
export const HINT_DURATION_MS = 1600;
export const SWIPE_HINT_STORAGE_KEY = "anew:swipe-hint-seen:v1";
export type HintMotion = { x: number; rotation: number };

export function readSwipeHintSeen(storage: Pick<Storage, "getItem">): boolean {
  try { return storage.getItem(SWIPE_HINT_STORAGE_KEY) === "1"; } catch { return false; }
}

export function saveSwipeHintSeen(storage: Pick<Storage, "setItem">): boolean {
  try { storage.setItem(SWIPE_HINT_STORAGE_KEY, "1"); return true; } catch { return false; }
}

const KEYFRAMES = [
  { at: 0, x: 0, rotation: 0 },
  { at: 0.22, x: -14, rotation: -2 },
  { at: 0.45, x: 0, rotation: 0 },
  { at: 0.72, x: 14, rotation: 2 },
  { at: 1, x: 0, rotation: 0 },
] as const;

export function hintMotion(progress: number): HintMotion {
  const bounded = Math.max(0, Math.min(1, progress));
  const index = KEYFRAMES.findIndex((frame) => frame.at >= bounded);
  if (index <= 0) return { x: 0, rotation: 0 };
  const from = KEYFRAMES[index - 1];
  const to = KEYFRAMES[index];
  const fraction = (bounded - from.at) / (to.at - from.at);
  const eased = (1 - Math.cos(Math.PI * fraction)) / 2;
  return { x: from.x + (to.x - from.x) * eased, rotation: from.rotation + (to.rotation - from.rotation) * eased };
}

export function SwipeHintTouch({ x }: { x: number }) {
  const offset = x * 1.8;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute bottom-[83px] left-1/2 z-20 h-10 w-24 -translate-x-1/2" style={{ opacity: 0.9 }}>
      <span className="absolute left-1/2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/45 shadow-[0_0_5px_rgba(118,155,205,0.2)]" style={{ width: `${Math.abs(offset)}px`, transform: `translateX(${offset < 0 ? offset : 0}px) translateY(-50%)` }} />
      <span className="absolute left-1/2 top-1/2 h-[30px] w-[30px] rounded-full border border-[rgba(0,0,0,0.12)] bg-white/65 shadow-[0_2px_10px_rgba(0,0,0,0.18)]" style={{ transform: `translate(calc(-50% + ${offset}px), -50%)` }} />
    </div>
  );
}

export function useFirstSwipeHint(eligible: boolean) {
  const [motion, setMotion] = useState<HintMotion>({ x: 0, rotation: 0 });
  const [running, setRunning] = useState(false);
  const current = useRef<HintMotion>({ x: 0, rotation: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const completed = useRef(false);

  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
    const position = current.current;
    current.current = { x: 0, rotation: 0 };
    setRunning(false);
    setMotion({ x: 0, rotation: 0 });
    return position;
  }, []);

  const complete = useCallback(() => {
    completed.current = true;
    try { saveSwipeHintSeen(window.localStorage); } catch { /* Access itself can fail; completion remains in memory. */ }
    stop();
  }, [stop]);

  useEffect(() => {
    if (!eligible || completed.current) return;
    try {
      if (readSwipeHintSeen(window.localStorage)) {
        completed.current = true;
        return;
      }
    } catch { /* Storage may be unavailable; the current session still works. */ }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || document.visibilityState === "hidden") return;
    const onReduced = (event: MediaQueryListEvent) => { if (event.matches) stop(); };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); };
    reduced.addEventListener("change", onReduced);
    document.addEventListener("visibilitychange", onVisibility);
    timer.current = setTimeout(() => {
      timer.current = null;
      setRunning(true);
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / HINT_DURATION_MS);
        current.current = hintMotion(progress);
        setMotion(current.current);
        if (progress < 1) frame.current = requestAnimationFrame(tick);
        else { frame.current = null; complete(); }
      };
      frame.current = requestAnimationFrame(tick);
    }, HINT_DELAY_MS);
    return () => {
      reduced.removeEventListener("change", onReduced);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [eligible, complete, stop]);

  return { motion, running, cancel: stop, complete };
}
