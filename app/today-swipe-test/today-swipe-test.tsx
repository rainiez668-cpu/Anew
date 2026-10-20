"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { dictionaries, formatMinutes, taskTypeLabel, type Locale } from "../lib/i18n";
import { THEMES, TYPE_COLORS, type Task } from "../lib/loop-data";
import { HINT_DELAY_MS, HINT_DISTANCE, HINT_DURATION_MS, hintMotion, SwipeHintTouch, type HintMotion } from "../components/swipe-hint";

const SWIPE_THRESHOLD = 90;
const AXIS_LOCK = 10;

const TEST_TASKS: Task[] = [
  { id: "swipe-test-1", title: "Choose one clear focus for today", reason: "A small decision is enough to get started", min: 25, type: "Focus", energy: "Medium", steps: ["Name the next small step"], status: "candidate" },
  { id: "swipe-test-2", title: "Reply to one important message", reason: "Close one small open loop", min: 10, type: "Admin", energy: "Low", steps: ["Open the conversation", "Write a short reply"], status: "candidate" },
  { id: "swipe-test-3", title: "Take a short walk", reason: "Give your attention a gentle reset", min: 15, type: "Health", energy: "Low", steps: ["Put on your shoes", "Step outside"], status: "candidate" },
];

const TEST_TASK_COPY: Record<Locale, Record<string, { title: string; reason: string }>> = {
  en: {
    "swipe-test-1": { title: "Choose one clear focus for today", reason: "A small decision is enough to get started" },
    "swipe-test-2": { title: "Reply to one important message", reason: "Close one small open loop" },
    "swipe-test-3": { title: "Take a short walk", reason: "Give your attention a gentle reset" },
  },
  "zh-CN": {
    "swipe-test-1": { title: "为今天选择一个清晰的重点", reason: "只做一个小决定，就可以开始" },
    "swipe-test-2": { title: "回复一条重要消息", reason: "解决一个小循环" },
    "swipe-test-3": { title: "出去走一小段路", reason: "让注意力轻轻重启" },
  },
};

const TEST_UI_COPY = {
  en: {
    today: "Today",
    intro: "Pick one thing at a time.",
    controls: "Test controls",
    variantA: "A / Card + labels",
    variantB: "B / Card + labels + touch point",
    replay: "Replay",
    complete: "Swipe test complete",
    isolated: "All choices stayed inside this test page.",
    reset: "Reset test cards",
    kept: "Task kept for today.",
    skipped: "Task skipped.",
  },
  "zh-CN": {
    today: "今天",
    intro: "一次只选择一件事。",
    controls: "测试控制",
    variantA: "A / 卡片与标签",
    variantB: "B / 卡片、标签与触点",
    replay: "重新播放",
    complete: "滑动测试已完成",
    isolated: "所有选择都只保留在这个测试页面中。",
    reset: "重置测试卡片",
    kept: "任务已保留到今天。",
    skipped: "任务已跳过。",
  },
} as const;

type HintVariant = "A" | "B";
type DragOrigin = {
  x: number;
  y: number;
  id: number;
  axis: "none" | "x";
  hintX: number;
  hintRotation: number;
};

function localizedMonoClass(locale: Locale, tracking: string) {
  return locale === "zh-CN" ? "font-sans tracking-[0.04em]" : `font-mono uppercase ${tracking}`;
}

function TaskBadge({ task, locale }: { task: Task; locale: Locale }) {
  const [color, background] = TYPE_COLORS[task.type];
  return (
    <span
      className={`rounded-full px-[11px] py-[6px] ${localizedMonoClass(locale, "tracking-[0.12em]")} text-[10px]`}
      style={{ color, background }}
    >
      {taskTypeLabel(locale, task.type)}
    </span>
  );
}

export function TodaySwipeTest() {
  const theme = THEMES.Daybreak;
  const [locale, setLocale] = useState<Locale>("en");
  const [variant, setVariant] = useState<HintVariant>("B");
  const [taskIndex, setTaskIndex] = useState(0);
  const [decision, setDecision] = useState<"kept" | "skipped" | null>(null);
  const [hint, setHint] = useState<HintMotion>({ x: 0, rotation: 0 });
  const [hintRunning, setHintRunning] = useState(false);
  const [drag, setDrag] = useState({ x: 0, rotation: 0, active: false });
  const [swipeExit, setSwipeExit] = useState<-1 | 0 | 1>(0);
  const dragOriginRef = useRef<DragOrigin | null>(null);
  const hintRef = useRef<HintMotion>({ x: 0, rotation: 0 });
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintFrameRef = useRef<number | null>(null);
  const task = TEST_TASKS[taskIndex];
  const t = dictionaries[locale];
  const testCopy = TEST_UI_COPY[locale];

  const clearHintSchedule = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (hintFrameRef.current !== null) cancelAnimationFrame(hintFrameRef.current);
    hintTimerRef.current = null;
    hintFrameRef.current = null;
  }, []);

  const centerHint = useCallback(() => {
    hintRef.current = { x: 0, rotation: 0 };
    setHint({ x: 0, rotation: 0 });
  }, []);

  const cancelHint = useCallback(() => {
    clearHintSchedule();
    setHintRunning(false);
  }, [clearHintSchedule]);

  const scheduleHint = useCallback(() => {
    clearHintSchedule();
    dragOriginRef.current = null;
    setDrag({ x: 0, rotation: 0, active: false });
    setHintRunning(false);
    centerHint();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    hintTimerRef.current = setTimeout(() => {
      setHintRunning(true);
      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / HINT_DURATION_MS);
        const motion = hintMotion(progress);
        hintRef.current = motion;
        setHint(motion);
        if (progress < 1) {
          hintFrameRef.current = requestAnimationFrame(animate);
        } else {
          hintFrameRef.current = null;
          setHintRunning(false);
        }
      };
      hintFrameRef.current = requestAnimationFrame(animate);
    }, HINT_DELAY_MS);
  }, [centerHint, clearHintSchedule]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setTimeout(scheduleHint, 0);
    const stopForReducedMotion = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      cancelHint();
      centerHint();
    };
    reducedMotion.addEventListener("change", stopForReducedMotion);
    return () => {
      clearTimeout(timer);
      reducedMotion.removeEventListener("change", stopForReducedMotion);
      clearHintSchedule();
    };
  }, [cancelHint, centerHint, clearHintSchedule, scheduleHint]);

  const replayHint = () => {
    setDecision(null);
    if (!task) setTaskIndex(0);
    scheduleHint();
  };

  const selectVariant = (nextVariant: HintVariant) => {
    setVariant(nextVariant);
    replayHint();
  };

  const selectLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    replayHint();
  };

  const swipe = useCallback(
    (keep: boolean) => {
      if (swipeExit || !task) return;
      cancelHint();
      setSwipeExit(keep ? 1 : -1);
      setDecision(keep ? "kept" : "skipped");
      setTimeout(() => {
        setSwipeExit(0);
        setDrag({ x: 0, rotation: 0, active: false });
        centerHint();
        setTaskIndex((index) => index + 1);
      }, 290);
    },
    [cancelHint, centerHint, swipeExit, task],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeExit || !task || (event.target as HTMLElement).closest("button")) return;
    cancelHint();
    const currentHint = hintRef.current;
    setDrag({ x: currentHint.x, rotation: currentHint.rotation, active: true });
    centerHint();
    dragOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      axis: "none",
      hintX: currentHint.x,
      hintRotation: currentHint.rotation,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (origin.axis === "none") {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragOriginRef.current = null;
        setDrag({ x: 0, rotation: 0, active: false });
        return;
      }
      origin.axis = "x";
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDrag({
      x: origin.hintX + dx,
      rotation: origin.hintRotation + dx * 0.04,
      active: true,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const lockedHorizontal = origin.axis === "x";
    dragOriginRef.current = null;
    setDrag({ x: 0, rotation: 0, active: false });
    if (!lockedHorizontal) return;
    if (dx > SWIPE_THRESHOLD) swipe(true);
    else if (dx < -SWIPE_THRESHOLD) swipe(false);
  };

  const resetTest = () => {
    setTaskIndex(0);
    setDecision(null);
    setSwipeExit(0);
    setDrag({ x: 0, rotation: 0, active: false });
    scheduleHint();
  };

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en", { weekday: "short", month: "short", day: "numeric" }).format(new Date()),
    [locale],
  );

  const cssVars = {
    "--ink": "#1E2127",
    "--ink2": "#565C66",
    "--ink3": "#959AA4",
    "--accent": theme.solid,
    "--accent-bg": theme.btn,
    "--soft": theme.softBg,
    "--soft-bd": theme.softBd,
  } as CSSProperties;

  const cardMotion = swipeExit ? { x: swipeExit * 430, rotation: swipeExit * 7 } : drag.active ? { x: drag.x, rotation: drag.rotation } : hint;
  const feedbackX = hintRunning ? hint.x : drag.active ? drag.x : 0;
  const feedbackDistance = hintRunning ? HINT_DISTANCE : SWIPE_THRESHOLD;
  const keepOpacity = Math.max(0, Math.min(1, feedbackX / feedbackDistance));
  const skipOpacity = Math.max(0, Math.min(1, -feedbackX / feedbackDistance));
  const localizedTask = task ? TEST_TASK_COPY[locale][task.id] : null;

  return (
    <div className="min-h-dvh overflow-x-hidden font-sans text-[var(--ink)] antialiased" style={{ ...cssVars, background: theme.bg }}>
      <main className="mx-auto w-full max-w-[430px] px-[22px] pb-16 pt-14">
        <header>
          <div className={`${localizedMonoClass(locale, "tracking-[0.18em]")} text-[10.5px] text-[var(--ink3)]`}>{dateLabel}</div>
          <h1 className="mt-[9px] text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">{testCopy.today}</h1>
          <p className="mt-5 max-w-[25ch] text-[18px] font-medium leading-[1.3] tracking-[-0.01em]">{testCopy.intro}</p>
        </header>

        <section aria-label={testCopy.controls} className="mt-5 rounded-[18px] border border-dashed border-[rgba(30,33,42,0.16)] bg-white/35 p-3.5">
          <div className={`${localizedMonoClass(locale, "tracking-[0.14em]")} text-[9.5px] text-[var(--ink3)]`}>{testCopy.controls}</div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={variant === option}
                onClick={() => selectVariant(option)}
                className="min-h-10 cursor-pointer rounded-[13px] px-2.5 py-2 text-[11.5px] font-medium leading-[1.25] text-[var(--ink2)]"
                style={{
                  background: variant === option ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.35)",
                  border: `1px solid ${variant === option ? "var(--soft-bd)" : "rgba(30,33,42,0.07)"}`,
                }}
              >
                {option === "A" ? testCopy.variantA : testCopy.variantB}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <div className="grid flex-1 grid-cols-2 gap-1 rounded-[13px] bg-white/35 p-1">
              {(["en", "zh-CN"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={locale === option}
                  onClick={() => selectLocale(option)}
                  className="h-9 cursor-pointer rounded-[10px] text-[11.5px] font-medium text-[var(--ink2)]"
                  style={{ background: locale === option ? "rgba(255,255,255,0.9)" : "transparent" }}
                >
                  {option === "en" ? "English" : "简体中文"}
                </button>
              ))}
            </div>
            <button type="button" onClick={replayHint} className="h-[44px] cursor-pointer rounded-[13px] border border-[var(--soft-bd)] bg-[var(--soft)] px-4 text-[12px] font-semibold text-[var(--ink2)]">
              {testCopy.replay}
            </button>
          </div>
        </section>

        <section className="mt-7" aria-labelledby="swipe-test-heading">
          <div className="mb-3 flex items-center justify-between">
            <span id="swipe-test-heading" className={`${localizedMonoClass(locale, "tracking-[0.16em]")} text-[10.5px] text-[var(--ink3)]`}>{t.morningPicks}</span>
            <span className="font-mono text-[10.5px] text-[var(--ink3)]">{Math.min(taskIndex + 1, TEST_TASKS.length)} {t.of} {TEST_TASKS.length}</span>
          </div>

          {task ? (
            <div className="relative">
              {taskIndex < TEST_TASKS.length - 1 && <div className="absolute -bottom-3 left-4 right-4 top-4 rounded-[26px] border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.32)]" />}
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="glass-card relative cursor-grab touch-pan-y select-none rounded-[26px] p-6 shadow-[0_22px_40px_-24px_rgba(42,50,68,0.45)] active:cursor-grabbing"
                style={{
                  transform: `translateX(${cardMotion.x}px) rotate(${cardMotion.rotation}deg)`,
                  opacity: swipeExit ? 0 : 1,
                  transition: swipeExit ? "transform 0.3s ease, opacity 0.3s ease" : hintRunning || drag.active ? "none" : "transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
                }}
              >
                <div
                  className={`pointer-events-none absolute right-5 top-5 z-30 rounded-[10px] border-2 px-2.5 py-1 ${localizedMonoClass(locale, "tracking-[0.12em]")} text-[12px] font-bold text-white`}
                  style={{ background: "var(--accent-bg)", borderColor: "rgba(255,255,255,0.7)", opacity: keepOpacity, transform: "rotate(8deg)" }}
                >
                  {t.keep}
                </div>
                <div
                  className={`pointer-events-none absolute left-5 top-5 z-30 rounded-[10px] border-2 border-[rgba(30,33,42,0.25)] bg-[rgba(30,33,42,0.55)] px-2.5 py-1 ${localizedMonoClass(locale, "tracking-[0.12em]")} text-[12px] font-bold text-white`}
                  style={{ opacity: skipOpacity, transform: "rotate(-8deg)" }}
                >
                  {t.skip}
                </div>

                {variant === "B" && hintRunning && (
                  <SwipeHintTouch x={hint.x} />
                )}

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <TaskBadge task={task} locale={locale} />
                    <span className="font-mono text-[10.5px] text-[var(--ink3)]">{formatMinutes(locale, task.min)}</span>
                  </div>
                  <div className="mt-[18px] text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] [text-wrap:pretty]">{localizedTask?.title ?? task.title}</div>
                  <div className="mt-[9px] text-[14.5px] font-light leading-[1.45] text-[var(--ink2)]">{localizedTask?.reason ?? task.reason}</div>
                  {variant === "B" && hintRunning && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-white/40" />
                  )}
                </div>
                <div className="mt-[26px] flex gap-2.5">
                  <button type="button" onClick={() => swipe(false)} className="h-[52px] flex-1 cursor-pointer rounded-[18px] bg-[var(--soft)] text-[14.5px] font-medium text-[var(--ink2)]" style={{ border: "1px solid var(--soft-bd)" }}>{t.notToday}</button>
                  <button type="button" onClick={() => swipe(true)} className="h-[52px] flex-[1.4] cursor-pointer rounded-[18px] border-none text-[14.5px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]" style={{ background: "var(--accent-bg)" }}>{t.keepToday}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-[26px] p-6 text-center shadow-[0_18px_34px_-22px_rgba(42,50,68,0.4)]">
              <div className="text-[19px] font-semibold">{testCopy.complete}</div>
              <p className="mt-1 text-[13.5px] font-light text-[var(--ink2)]">{testCopy.isolated}</p>
              <button type="button" onClick={resetTest} className="mt-[18px] h-[48px] w-full cursor-pointer rounded-[17px] border-none text-sm font-semibold text-white" style={{ background: "var(--accent-bg)" }}>{testCopy.reset}</button>
            </div>
          )}

          <p className="sr-only" aria-live="polite">{decision === "kept" ? testCopy.kept : decision === "skipped" ? testCopy.skipped : ""}</p>
        </section>
      </main>
    </div>
  );
}
