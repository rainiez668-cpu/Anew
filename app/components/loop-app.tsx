"use client";

// Anew — ADHD-friendly daily planning loop.
// Pick → Focus → Done → Review, three tabs, localStorage only.
// Visuals ported from the design handoff:
// frosted-glass cards over a cool→warm gradient, two coupled themes.

import { useCallback, useEffect, useRef, useState } from "react";
import packageInfo from "@/package.json";
import { useSpeechRecognition } from "../hooks/use-speech-recognition";
import {
  dictionaries,
  resolveLocale,
  reviewPrompts,
  taskTypeLabel,
  themeMeta,
  type Locale,
} from "../lib/i18n";
import {
  BASICS,
  normalizeTaskType,
  SEED_CANDIDATES,
  Task,
  TaskType,
  THEME_NAMES,
  THEMES,
  ThemeName,
  TYPE_COLORS,
} from "../lib/loop-data";
import type { Task as PlannedTask } from "@/lib/types";
import {
  clearLegacyData,
  getDailyBasics,
  getReviews,
  getTasks,
  importLegacyData,
  LEGACY_LOOP_STORAGE_KEY,
  LOOP_STORAGE_KEY,
  parseLegacyExport,
  saveTasks,
} from "@/lib/storage";
import { mergeCanonicalTasks, toDisplayTask } from "@/lib/task-adapter";

type Tab = "today" | "build" | "review";

// One turn in the evening Review conversation. "user" bubbles are what you
// type; "assistant" bubbles are Anew's short replies from /api/review-chat.
type ReviewMsg = { role: "user" | "assistant"; text: string };

interface Persisted {
  day: string;
  theme: ThemeName;
  locale: Locale;
  candidates: Task[];
  swiped: number;
  basicsDone: Record<string, boolean>;
  stepsDone: Record<string, boolean>;
  msgs: ReviewMsg[];
  generated: boolean;
  // The user's own daily-basics checklist. Persisted (so it repeats every day);
  // only the per-day `basicsDone` ticks reset at rollover.
  basics: { id: string; label: string }[];
}

// Older saves stored msgs as a plain string[] (user lines only). Upgrade them
// to typed turns so existing journals keep rendering after this change.
function migrateMsgs(raw: unknown): ReviewMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m): ReviewMsg | null => {
      if (typeof m === "string") return { role: "user", text: m };
      if (m && typeof m === "object" && typeof (m as ReviewMsg).text === "string") {
        const r = (m as ReviewMsg).role;
        return { role: r === "assistant" ? "assistant" : "user", text: (m as ReviewMsg).text };
      }
      return null;
    })
    .filter((m): m is ReviewMsg => m !== null);
}

const STORAGE_KEY = LOOP_STORAGE_KEY;
// Legacy blob key; migrated to STORAGE_KEY on first load.
const LEGACY_STORAGE_KEY = LEGACY_LOOP_STORAGE_KEY;
// The prototype nudged after 18s for demo purposes; in real use a gentle
// re-entry after 5 minutes is supportive without being annoying.
const NUDGE_SECONDS = 300;
const RING_R = 64;
const RING_C = 2 * Math.PI * RING_R;

// Map the canonical (lowercase) task model used by the storage layer / AI
// planner back to the prototype's display-style enums, for tasks mirrored into
// Today's deck.
const NEW_TO_OLD_TYPE: Record<string, TaskType> = {
  focus: "Focus",
  quick: "Quick",
  errand: "Errand",
  health: "Health",
  admin: "Admin",
  life: "Life",
  // Legacy canonical types, mapped so any older AI/plan output still renders.
  build: "Focus",
  github: "Focus",
  learning: "Focus",
  "skill-test": "Focus",
  review: "Quick",
};
const NEW_TO_OLD_ENERGY: Record<string, "Low" | "Medium" | "High"> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const defaultPersisted = (): Persisted => ({
  day: todayKey(),
  theme: "Daybreak",
  locale: resolveLocale(undefined),
  candidates: SEED_CANDIDATES,
  swiped: 0,
  basicsDone: {},
  stepsDone: {},
  msgs: [],
  generated: false,
  basics: BASICS.map((b) => ({ id: b.id, label: b.label })),
});

// New day: completed one-off tasks never reappear, skipped/today cards return
// to the deck as candidates, and basics, the loop and the review reset. Tasks
// from the AI planner are already candidates, so they simply carry over.
function rollover(p: Persisted): Persisted {
  const day = todayKey();
  if (p.day === day) return p;
  const kept: Task[] = p.candidates
    .filter((c) => c.status !== "done")
    .map((c) => (c.status === "skippedToday" || c.status === "today" ? { ...c, status: "candidate" } : c));
  return {
    ...p,
    day,
    candidates: kept,
    swiped: 0,
    basicsDone: {},
    generated: false,
    msgs: [],
  };
}

/* ---------- small shared pieces ---------- */

function localizedMonoClass(locale: Locale, englishTracking: string) {
  return locale === "zh-CN"
    ? "font-sans tracking-[0.04em]"
    : `font-mono uppercase ${englishTracking}`;
}

function MonoLabel({
  children,
  locale,
  className = "",
}: {
  children: React.ReactNode;
  locale: Locale;
  className?: string;
}) {
  return (
    <span className={`${localizedMonoClass(locale, "tracking-[0.16em]")} text-[10.5px] text-[var(--ink3)] ${className}`}>
      {children}
    </span>
  );
}

function TypeBadge({ type, label = type, locale }: { type: TaskType; label?: string; locale: Locale }) {
  const [c, bg] = TYPE_COLORS[type];
  return (
    <span
      className={`rounded-full px-[11px] py-[6px] ${localizedMonoClass(locale, "tracking-[0.12em]")} text-[10px]`}
      style={{ background: bg, color: c }}
    >
      {label}
    </span>
  );
}

function Sheet({
  onClose,
  label,
  locale,
  children,
}: {
  onClose: () => void;
  label?: string;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(20,24,32,0.34)] animate-ts-fade" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 z-[51] max-h-[88dvh] w-full max-w-[430px] -translate-x-1/2 overflow-y-auto rounded-t-[28px] bg-[#F4F7FA] px-[22px] pt-[14px] pb-9 shadow-[0_-18px_40px_-20px_rgba(30,35,25,0.4)] animate-ts-rise">
        <div className="mx-auto mb-4 h-1 w-[38px] rounded-sm bg-[rgba(30,33,42,0.14)]" />
        {label && <MonoLabel locale={locale}>{label}</MonoLabel>}
        {children}
      </div>
    </>
  );
}

/* ---------- the app ---------- */

export default function LoopApp() {
  const [loaded, setLoaded] = useState(false);
  const [p, setP] = useState<Persisted>(defaultPersisted);

  // ephemeral UI state
  const [tab, setTab] = useState<Tab>("today");
  const [swipeExit, setSwipeExit] = useState(0);
  // After a card flies off, the next one is "entering": it must snap to center
  // (no slide) and fade in from behind the deck rather than sliding in from the
  // swipe direction.
  const [entering, setEntering] = useState(false);
  // Tinder-style drag: dx is horizontal offset in px, active while a finger/
  // pointer is down. dragRef holds the pointer's start so move/up can measure.
  const [drag, setDrag] = useState<{ dx: number; active: boolean }>({ dx: 0, active: false });
  // axis: which direction the gesture locked into once it moved enough — "none"
  // until decided, "x" for a horizontal swipe, "y" once we bail to let the page
  // scroll. y/x is also where we store the pointer start so move/up can measure.
  const dragRef = useRef<{ x: number; y: number; id: number; axis: "none" | "x" | "y" } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [quickText, setQuickText] = useState("");
  const [quickType, setQuickType] = useState<TaskType>("Quick");
  const [buildIdx, setBuildIdx] = useState(0);
  const [timer, setTimer] = useState<{
    sel: number | "Custom";
    custom: number;
    left: number | null;
    total: number;
    running: boolean;
  }>({ sel: 25, custom: 35, left: null, total: 0, running: false });
  const [nudge, setNudge] = useState(false);
  const [nudgeHidden, setNudgeHidden] = useState(false);
  const [celebrate, setCelebrate] = useState<{ on: boolean; sub: string }>({ on: false, sub: "" });
  const [draft, setDraft] = useState("");
  const [editingBasics, setEditingBasics] = useState(false);
  const [newBasic, setNewBasic] = useState("");
  const [replying, setReplying] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<{ id: string; title: string; type: string; minutes: number }[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);

  const secRef = useRef(0);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const celebT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const importRef = useRef<HTMLInputElement>(null);

  /* ---------- persistence ---------- */

  useEffect(() => {
    // localStorage is client-only: load after mount so the server-rendered
    // splash and the first client render match.
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        // One-time migration from the legacy blob key.
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy !== null) {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          raw = legacy;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        // Older saves predate custom basics — fall back to the seed list.
        const basics =
          Array.isArray(parsed.basics) && parsed.basics.length
            ? parsed.basics.filter((b) => b && typeof b.id === "string" && typeof b.label === "string")
            : defaultPersisted().basics;
        const storedTasks = getTasks();
        const rawCandidates = storedTasks.length
          ? storedTasks.map(toDisplayTask)
          : parsed.candidates ?? defaultPersisted().candidates;
        // Heal any legacy task types saved by older versions so color/label
        // lookups never hit an undefined entry.
        const candidates = rawCandidates.map((c) => ({
          ...c,
          type: normalizeTaskType(c.type),
        }));
        const merged = {
          ...defaultPersisted(),
          ...parsed,
          theme:
            parsed.theme && THEME_NAMES.includes(parsed.theme)
              ? parsed.theme
              : defaultPersisted().theme,
          locale: resolveLocale(parsed.locale),
          candidates,
          msgs: migrateMsgs(parsed.msgs),
          basics,
        };
        setP(rollover(merged));
      } else {
        const initial = defaultPersisted();
        saveTasks(mergeCanonicalTasks(initial.candidates, []));
      }
    } catch {
      // corrupted storage — start fresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      const { candidates, ...uiState } = p;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(uiState));
      saveTasks(mergeCanonicalTasks(candidates, getTasks()));
    } catch {
      // storage unavailable — run in-memory
    }
  }, [p, loaded]);

  useEffect(() => {
    document.documentElement.lang = p.locale;
  }, [p.locale]);

  /* ---------- feedback ---------- */

  const toast = useCallback((t: string) => {
    clearTimeout(toastT.current);
    setToastText(t);
    toastT.current = setTimeout(() => setToastText(null), 1900);
  }, []);

  const handleVoiceError = useCallback(
    (error: string) => {
      const messages = dictionaries[p.locale];
      if (error === "unsupported") toast(messages.voiceUnsupported);
      else if (error === "not-allowed" || error === "service-not-allowed") {
        toast(messages.microphoneDenied);
      } else if (error === "no-speech") toast(messages.noSpeech);
      else toast(messages.voiceError);
    },
    [p.locale, toast],
  );

  const updateDraftFromVoice = useCallback((text: string) => setDraft(text), []);
  const {
    listening: voiceListening,
    supported: voiceSupported,
    stop: stopVoice,
    toggle: toggleVoice,
  } = useSpeechRecognition({
    lang: p.locale === "zh-CN" ? "zh-CN" : "en-US",
    value: draft,
    onChange: updateDraftFromVoice,
    onError: handleVoiceError,
  });

  useEffect(() => {
    if (tab !== "review") stopVoice();
  }, [tab, stopVoice]);

  const celebrateNow = useCallback((sub: string) => {
    clearTimeout(celebT.current);
    setCelebrate({ on: true, sub });
    celebT.current = setTimeout(() => setCelebrate((c) => ({ ...c, on: false })), 1600);
  }, []);

  useEffect(() => () => {
    clearTimeout(toastT.current);
    clearTimeout(celebT.current);
  }, []);

  /* ---------- derived ---------- */

  const theme = THEMES[p.theme];
  const accent = theme.solid;
  // The one big thing floats to the front, so it is the first card to focus on
  // and the first row in the plan.
  const byPrimary = (a: Task, b: Task) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0);
  const deck = p.candidates.filter((c) => c.status === "candidate");
  const sel = p.candidates
    .filter((c) => c.status === "today" || c.status === "done")
    .sort(byPrimary);
  const pending = p.candidates.filter((c) => c.status === "today").sort(byPrimary);
  const doneCount = sel.filter((c) => c.status === "done").length;
  const cur = pending.length ? pending[Math.min(buildIdx, pending.length - 1)] : null;
  const allComplete = sel.length > 0 && pending.length === 0 && deck.length === 0;

  /* ---------- timer + nudge ticks ---------- */

  useEffect(() => {
    if (!timer.running) return;
    const iv = setInterval(() => {
      setTimer((t) => {
        if (!t.running || t.left == null) return t;
        const left = t.left - 1;
        if (left <= 0) {
          queueMicrotask(() => toast("Focus block done. Nice."));
          return { ...t, left: null, running: false };
        }
        return { ...t, left };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [timer.running, toast]);

  const nudgeEligible = tab === "build" && !!cur && !nudge && !nudgeHidden && !celebrate.on;
  useEffect(() => {
    if (!nudgeEligible) return;
    const iv = setInterval(() => {
      secRef.current += 1;
      if (secRef.current >= NUDGE_SECONDS) setNudge(true);
    }, 1000);
    return () => clearInterval(iv);
  }, [nudgeEligible]);

  /* ---------- actions ---------- */

  const goTab = (k: Tab) => {
    secRef.current = 0;
    setTab(k);
    setNudge(false);
    setNudgeHidden(false);
  };

  const swipe = (keep: boolean) => {
    if (swipeExit || !deck.length) return;
    const id = deck[0].id;
    setSwipeExit(keep ? 1 : -1);
    setTimeout(() => {
      setSwipeExit(0);
      setEntering(true);
      setP((s) => ({
        ...s,
        swiped: s.swiped + 1,
        candidates: s.candidates.map((c) =>
          c.id === id ? { ...c, status: keep ? "today" : "skippedToday" } : c
        ),
      }));
      // Let the next card settle at center (instant), then re-enable the normal
      // transform transition once it's done fading in.
      setTimeout(() => setEntering(false), 260);
    }, 290);
  };

  // Drag gestures for the morning-swipe card. Pointer events cover both touch
  // and mouse; past SWIPE_THRESHOLD a release commits the same keep/skip the
  // buttons do, otherwise the card springs back to center.
  const SWIPE_THRESHOLD = 90;
  // How far a finger must travel before we decide the gesture is a horizontal
  // swipe vs. a vertical scroll. Until then the card stays put and the page can
  // scroll normally, so brushing the card while scrolling never flings it away.
  const AXIS_LOCK = 10;
  const onCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeExit || !deck.length) return;
    // Let the in-card buttons handle their own taps — don't hijack as a drag.
    if ((e.target as HTMLElement).closest("button")) return;
    // Record the start but DON'T capture the pointer or move the card yet —
    // we wait for the move handler to confirm a horizontal intent. That keeps
    // vertical scrolls (which share the same pointerdown) with the browser.
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: "none" };
  };
  const onCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.axis === "none") {
      // Not enough movement to tell scroll from swipe yet.
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical wins: this is a scroll. Release the gesture so the browser
        // scrolls and we never commit a swipe.
        dragRef.current = null;
        return;
      }
      // Horizontal wins: lock in, capture the pointer, start the Tinder drag.
      d.axis = "x";
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDrag({ dx, active: true });
  };
  const onCardPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const lockedHorizontal = d.axis === "x";
    dragRef.current = null;
    setDrag({ dx: 0, active: false });
    // Only commit if the gesture actually locked into a horizontal swipe.
    if (!lockedHorizontal) return;
    if (dx > SWIPE_THRESHOLD) swipe(true);
    else if (dx < -SWIPE_THRESHOLD) swipe(false);
  };

  const completeTask = (id: string, fromBuild: boolean) => {
    const remaining = pending.filter((c) => c.id !== id).length;
    setP((s) => ({
      ...s,
      candidates: s.candidates.map((c) => (c.id === id ? { ...c, status: "done" } : c)),
    }));
    setNudge(false);
    secRef.current = 0;
    if (fromBuild) {
      setTimer((t) => ({ ...t, left: null, running: false }));
      celebrateNow(remaining > 0 ? `${remaining} to go today` : "today's loop is built — review tonight");
    } else {
      setTimer((t) => ({ ...t, running: false }));
      toast(remaining > 0 ? `Done — ${remaining} to go` : "All done for today");
    }
  };

  // The "one big thing": at most one task carries `primary`. Tapping the star on
  // a task promotes it and demotes whatever held it before; tapping the current
  // primary clears it.
  const setPrimary = (id: string) => {
    setP((s) => {
      const wasPrimary = s.candidates.find((c) => c.id === id)?.primary === true;
      return {
        ...s,
        candidates: s.candidates.map((c) => ({
          ...c,
          primary: c.id === id ? !wasPrimary : false,
        })),
      };
    });
  };

  // One plan row, shared by the "one big thing" card and the smaller "also
  // today" list. `big` gives the primary task a larger, ringed treatment.
  const renderPlanRow = (task: Task, big: boolean) => {
    const done = task.status === "done";
    const [dot] = TYPE_COLORS[task.type];
    const isPrimary = !!task.primary;
    const d = dictionaries[p.locale];
    return (
      <div
        key={task.id}
        className="glass-card flex items-center gap-[13px] rounded-[20px] shadow-[0_12px_24px_-18px_rgba(42,50,68,0.4)]"
        style={{
          padding: big ? "18px 14px 18px 20px" : "14px 14px 14px 18px",
          border: isPrimary ? `1.5px solid ${accent}` : undefined,
        }}
      >
        <span
          className="flex-none rounded-full"
          style={{ background: dot, width: big ? 11 : 9, height: big ? 11 : 9 }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="font-semibold tracking-[-0.01em] transition-colors duration-200"
            style={{
              fontSize: big ? 18 : 15.5,
              color: done ? "var(--ink3)" : "var(--ink)",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {task.title}
          </div>
          <div className={`${localizedMonoClass(p.locale, "tracking-[0.1em]")} mt-[3px] text-[9.5px] text-[var(--ink3)]`}>
            {taskTypeLabel(p.locale, task.type)} · {task.min} min
          </div>
        </div>
        <button
          onClick={() => setPrimary(task.id)}
          title={d.makeBig}
          aria-label={d.makeBig}
          aria-pressed={isPrimary}
          className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-full text-[15px] transition-all duration-200"
          style={{
            background: "transparent",
            border: "none",
            color: isPrimary ? accent : "rgba(30,33,42,0.22)",
          }}
        >
          {isPrimary ? "★" : "☆"}
        </button>
        <button
          onClick={() => !done && completeTask(task.id, false)}
          title={d.markComplete}
          className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-full text-sm transition-all duration-200"
          style={{
            background: done ? accent : "#fff",
            border: `1px solid ${done ? accent : "rgba(30,33,42,0.14)"}`,
            color: done ? "#fff" : "rgba(30,33,42,0.35)",
          }}
        >
          ✓
        </button>
      </div>
    );
  };

  const quickAdd = (toToday: boolean) => {
    const t = quickText.trim();
    if (!t) {
      toast(dictionaries[p.locale].typeTaskFirst);
      return;
    }
    const task: Task = {
      id: `q${Date.now()}`,
      title: t,
      reason: "Quick added",
      min: 15,
      type: quickType,
      energy: "Low",
      steps: ["Just do the thing"],
      status: toToday ? "today" : "candidate",
    };
    setP((s) => ({ ...s, candidates: [...s.candidates, task] }));
    setQuickOpen(false);
    setQuickText("");
    toast(toToday ? "Added to today" : "Added to morning picks");
  };

  // AI Planner: turn tonight's review + context into tomorrow's candidates.
  const generatePlan = async () => {
    if (planning) return;
    setPlanning(true);
    try {
      const res = await fetch("/api/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewText: p.msgs.filter((m) => m.role === "user").map((m) => m.text).join("\n"),
          currentTasks: p.candidates
            .filter((c) => c.status === "candidate" || c.status === "today")
            .map((c) => c.title),
          completedTasks: p.candidates.filter((c) => c.status === "done").map((c) => c.title),
          dailyBasics: p.basics.map((b) => ({ label: b.label, done: !!p.basicsDone[b.id] })),
        }),
      });
      const data = (await res.json()) as { tasks?: PlannedTask[] };
      const tasks = data.tasks ?? [];
      if (tasks.length === 0) throw new Error("empty plan");

      // Convert the API model into the card model used by Today's swipe deck.
      const mirrored: Task[] = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        reason: t.reason || "From tonight's review",
        min: t.minutes ?? 20,
        type: NEW_TO_OLD_TYPE[t.type] ?? "Focus",
        energy: NEW_TO_OLD_ENERGY[t.energy ?? "medium"] ?? "Medium",
        steps: ["Make a small start"],
        status: "candidate",
      }));
      setP((s) => ({ ...s, candidates: [...s.candidates, ...mirrored], generated: true }));
      setPlan(tasks.map((t) => ({ id: t.id, title: t.title, type: t.type, minutes: t.minutes ?? 20 })));
      toast("Tomorrow's candidates are ready");
    } catch {
      toast("Couldn't generate — try again");
    } finally {
      setPlanning(false);
    }
  };

  // Drop a single proposed task before accepting it: remove it from the plan
  // preview, from Today's mirrored candidates, and from the canonical store.
  const dropPlanItem = (id: string) => {
    setPlan((rows) => rows.filter((r) => r.id !== id));
    setP((s) => ({ ...s, candidates: s.candidates.filter((c) => c.id !== id) }));
    toast("Removed from tomorrow's plan");
  };

  // Throw away the whole proposed plan and ask for a fresh one. Clears every
  // AI-mirrored candidate first so a regenerate replaces rather than stacks.
  const regeneratePlan = () => {
    setPlan([]);
    const dropIds = new Set(plan.map((r) => r.id));
    setP((s) => ({
      ...s,
      candidates: s.candidates.filter((c) => !dropIds.has(c.id)),
      generated: false,
    }));
    void generatePlan();
  };

  // Send a review line, then fetch Anew's short spoken reply. The user
  // bubble shows immediately; the assistant bubble appears once the API
  // returns. On any failure we still drop in a gentle reply so the chat never
  // stalls silently.
  const send = async () => {
    stopVoice();
    const t = draft.trim();
    if (!t || replying) return;
    const userMsg: ReviewMsg = { role: "user", text: t };
    const history = [...p.msgs, userMsg];
    setP((s) => ({ ...s, msgs: history }));
    setDraft("");
    setReplying(true);
    try {
      const res = await fetch("/api/review-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await res.json()) as { reply?: string };
      const reply = (data.reply ?? "").trim();
      setP((s) => ({
        ...s,
        msgs: [...s.msgs, { role: "assistant", text: reply || "Thanks for sharing that." }],
      }));
    } catch {
      setP((s) => ({
        ...s,
        msgs: [...s.msgs, { role: "assistant", text: "I'm having trouble replying right now — but it's noted. Keep going." }],
      }));
    } finally {
      setReplying(false);
    }
  };

  const setTheme = (theme: ThemeName) => setP((state) => ({ ...state, theme }));
  const setLocale = (locale: Locale) => setP((state) => ({ ...state, locale }));

  /* ---------- daily basics (user-editable, repeat every day) ---------- */

  const addBasic = () => {
    const label = newBasic.trim().slice(0, 40);
    if (!label) return;
    const id = `b-${Date.now()}`;
    setP((s) => ({ ...s, basics: [...s.basics, { id, label }] }));
    setNewBasic("");
  };

  const removeBasic = (id: string) => {
    setP((s) => {
      const { [id]: _drop, ...restDone } = s.basicsDone;
      void _drop;
      return { ...s, basics: s.basics.filter((b) => b.id !== id), basicsDone: restDone };
    });
  };

  const renameBasic = (id: string, label: string) => {
    setP((s) => ({
      ...s,
      basics: s.basics.map((b) => (b.id === id ? { ...b, label: label.slice(0, 40) } : b)),
    }));
  };

  const exportLocalData = () => {
    const { candidates: _candidates, ...loopState } = p;
    void _candidates;
    const now = new Date().toISOString();
    const currentBasics = p.basics.map((basic) => ({
      id: basic.id,
      label: basic.label,
      done: !!p.basicsDone[basic.id],
      date: p.day,
    }));
    const storedReviews = getReviews();
    const currentReviews =
      p.msgs.length > 0 && !storedReviews.some((review) => review.date === p.day)
        ? [
            ...storedReviews,
            {
              date: p.day,
              responses: {
                conversation: p.msgs
                  .map((message) => `${message.role}: ${message.text}`)
                  .join("\n"),
              },
              createdAt: now,
              updatedAt: now,
            },
          ]
        : storedReviews;
    const data = {
      app: "Anew",
      exportedAt: now,
      version: packageInfo.version,
      tasks: getTasks(),
      reviews: currentReviews,
      dailyBasics: currentBasics.length > 0 ? currentBasics : getDailyBasics(),
      loopState,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anew-export-${now.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast(dictionaries[p.locale].exported);
  };

  const importLocalData = async (file: File) => {
    setImportError(null);
    try {
      const data = parseLegacyExport(await file.text());
      if (!confirm(dictionaries[p.locale].importConfirm)) {
        return;
      }
      importLegacyData(data);
      location.reload();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : dictionaries[p.locale].invalidImport);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  // Clear app storage keys and legacy aliases without touching unrelated storage.
  const resetAll = () => {
    if (!confirm(dictionaries[p.locale].resetConfirm)) {
      return;
    }
    try {
      clearLegacyData();
    } catch {
      // Storage unavailable — reload still re-seeds from defaults.
    }
    location.reload();
  };

  /* ---------- render helpers ---------- */

  if (!loaded) {
    return <div className="min-h-dvh" style={{ background: THEMES.Daybreak.bg }} />;
  }

  const now = new Date();
  const t = dictionaries[p.locale];
  const dateLocale = p.locale === "zh-CN" ? "zh-CN" : "en-US";
  const dateLabel = new Intl.DateTimeFormat(dateLocale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(now)
    .toUpperCase();
  const h = now.getHours();
  const greeting = h < 12 ? t.greetingMorning : h < 18 ? t.greetingAfternoon : t.greetingEvening;

  const curSteps = cur?.steps ?? [];

  let statusLabel = t.notStarted;
  let statusColor = "#959AA4";
  if (sel.length > 0 && pending.length === 0 && p.generated) {
    statusLabel = t.completed;
    statusColor = "#5AA075";
  } else if (sel.length > 0 && pending.length === 0) {
    statusLabel = t.readyReview;
    statusColor = "#4E8AA8";
  } else if (sel.length > 0) {
    statusLabel = t.inProgress;
    statusColor = accent;
  } else if (p.swiped > 0) {
    statusLabel = t.picking;
    statusColor = "#C29A3A";
  }

  const segData: [string, boolean][] = [
    [t.pick, sel.length > 0],
    [t.build, doneCount > 0],
    [t.review, p.generated],
  ];
  const segCount = segData.filter(([, on]) => on).length;

  const basicsDoneCount = p.basics.filter((b) => p.basicsDone[b.id]).length;
  const top = deck[0];
  const exiting = swipeExit !== 0;
  const deckDone = deck.length === 0 && p.swiped > 0;

  const startLen = timer.sel === "Custom" ? timer.custom : timer.sel;
  const timerActive = timer.left != null;
  const timerDisplay = timerActive
    ? `${String(Math.floor((timer.left as number) / 60)).padStart(2, "0")}:${String((timer.left as number) % 60).padStart(2, "0")}`
    : "00:00";
  const timerPct =
    timerActive && timer.total ? Math.round(100 * (1 - (timer.left as number) / timer.total)) : 0;
  const loopClosed = p.generated && allComplete;

  const tabColor = (k: Tab) => (tab === k ? accent : "#959AA4");

  const cssVars = {
    "--ink": "#1E2127",
    "--ink2": "#565C66",
    "--ink3": "#959AA4",
    "--accent": accent,
    "--accent-bg": theme.btn,
    "--soft": theme.softBg,
    "--soft-bd": theme.softBd,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-dvh font-sans text-[var(--ink)] antialiased"
      style={{ ...cssVars, background: theme.bg }}
    >
      <main className="mx-auto w-full max-w-[430px]">
        {/* ============ TODAY ============ */}
        {tab === "today" && (
          <div className="animate-ts-fade px-[22px] pt-14">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-[9px]">
                <span className={`${localizedMonoClass(p.locale, "tracking-[0.18em]")} text-[10.5px] text-[var(--ink3)]`}>
                  {dateLabel}
                </span>
                <h1 className="text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">{greeting}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setImportError(null);
                    setSettingsOpen(true);
                  }}
                  title={t.settings}
                  aria-label={t.openSettings}
                  className="glass-pill flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full text-[var(--ink2)] shadow-[0_8px_18px_-10px_rgba(42,50,68,0.45)]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
                  </svg>
                </button>
                <button
                  onClick={() => setQuickOpen(true)}
                  title={t.quickAdd}
                  className="glass-pill flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full pb-0.5 text-2xl font-light leading-none text-[var(--ink)] shadow-[0_10px_22px_-10px_rgba(42,50,68,0.45)]"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className={`glass-pill inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] ${localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[10px] text-[var(--ink2)]`}>
                <span
                  className="h-[7px] w-[7px] rounded-full transition-colors duration-300"
                  style={{ background: statusColor }}
                />
                {statusLabel}
              </span>
            </div>

            <p className="mt-5 max-w-[24ch] text-[18px] font-medium leading-[1.3] tracking-[-0.01em]">
              {t.shipOneLoop}
            </p>

            <div className="mt-[18px] flex items-end gap-2.5">
              {segData.map(([label, on]) => (
                <div key={label} className="flex-1">
                  <div
                    className={`mb-1.5 ${localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[9.5px] transition-colors duration-300`}
                    style={{ color: on ? "var(--ink)" : "var(--ink3)" }}
                  >
                    {label}
                  </div>
                  <div
                    className="h-1 rounded-sm transition-colors duration-300"
                    style={{ background: on ? accent : "rgba(30,33,42,0.1)" }}
                  />
                </div>
              ))}
              <span className="translate-y-[4px] font-mono text-[11px] text-[var(--ink3)]">{segCount}/3</span>
            </div>

            {/* daily basics — user-editable, repeats every day */}
            <div className="mt-7">
              <div className="mb-2.5 flex items-center justify-between">
                <MonoLabel locale={p.locale}>{t.dailyBasics}</MonoLabel>
                <div className="flex items-center gap-2.5">
                  {!editingBasics && (
                    <span className={`${p.locale === "zh-CN" ? "font-sans tracking-[0.04em]" : "font-mono"} text-[10.5px] text-[var(--ink3)]`}>
                      {basicsDoneCount}/{p.basics.length} · {t.resetsTomorrow}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditingBasics((e) => !e);
                      setNewBasic("");
                    }}
                    className={`${localizedMonoClass(p.locale, "tracking-[0.08em]")} text-[10.5px] text-[var(--accent)] underline underline-offset-2`}
                  >
                    {editingBasics ? t.done : t.edit}
                  </button>
                </div>
              </div>

              {editingBasics ? (
                <div className="flex flex-col gap-2">
                  {p.basics.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <input
                        value={b.label}
                        onChange={(e) => renameBasic(b.id, e.target.value)}
                        placeholder={t.basicName}
                        className="min-w-0 flex-1 rounded-[14px] border border-[rgba(30,33,42,0.1)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
                      />
                      <button
                        onClick={() => removeBasic(b.id)}
                        title={t.deleteBasic}
                        aria-label={`Delete ${b.label}`}
                        className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border border-[rgba(30,33,42,0.12)] bg-white text-[15px] leading-none text-[var(--ink2)]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="mt-0.5 flex items-center gap-2">
                    <input
                      value={newBasic}
                      onChange={(e) => setNewBasic(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addBasic()}
                      placeholder={t.addDailyBasic}
                      className="min-w-0 flex-1 rounded-[14px] border border-[rgba(30,33,42,0.1)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
                    />
                    <button
                      onClick={addBasic}
                      title={t.addBasic}
                      aria-label={t.addBasic}
                      className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-none pb-0.5 text-[18px] font-light leading-none text-white"
                      style={{ background: "var(--accent-bg)" }}
                    >
                      +
                    </button>
                  </div>
                  {p.basics.length === 0 && (
                    <div className="text-[12.5px] font-light text-[var(--ink2)]">
                      No basics yet — add a few above. They&apos;ll repeat every day.
                    </div>
                  )}
                </div>
              ) : (
                <div className="ts-scroll -mx-[22px] flex gap-2 overflow-x-auto px-[22px] pb-2 pt-0.5">
                  {p.basics.map((b) => {
                    const on = !!p.basicsDone[b.id];
                    const dn = theme.done;
                    return (
                      <button
                        key={b.id}
                        onClick={() =>
                          setP((s) => ({
                            ...s,
                            basicsDone: { ...s.basicsDone, [b.id]: !s.basicsDone[b.id] },
                          }))
                        }
                        className="flex flex-none cursor-pointer items-center gap-2 rounded-full py-[9px] pl-2.5 pr-3.5 text-[13px] font-medium shadow-[0_8px_18px_-12px_rgba(42,50,68,0.35)] transition-all duration-200"
                        style={{
                          background: on ? dn.bg : "#fff",
                          border: `1px solid ${on ? dn.bd : "rgba(30,33,42,0.06)"}`,
                          color: on ? dn.label : "var(--ink2)",
                        }}
                      >
                        <span
                          className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] text-white transition-all duration-200"
                          style={{
                            background: on ? dn.check : "#fff",
                            border: `1px solid ${on ? dn.check : "rgba(30,33,42,0.18)"}`,
                          }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        {b.label}
                      </button>
                    );
                  })}
                  {p.basics.length === 0 && (
                    <span className="py-[9px] text-[13px] font-light text-[var(--ink3)]">
                      No basics — tap Edit to add some.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* morning swipe planner */}
            {deck.length > 0 && top && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <MonoLabel locale={p.locale}>{t.morningPicks}</MonoLabel>
                  <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                    {Math.min(p.swiped + 1, p.swiped + deck.length)} of {p.swiped + deck.length}
                  </span>
                </div>
                <div className="relative">
                  {deck.length > 1 && (
                    <div className="absolute -bottom-3 left-4 right-4 top-4 rounded-[26px] border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.32)]" />
                  )}
                  <div
                    onPointerDown={onCardPointerDown}
                    onPointerMove={onCardPointerMove}
                    onPointerUp={onCardPointerUp}
                    onPointerCancel={onCardPointerUp}
                    className="glass-card relative cursor-grab touch-pan-y select-none rounded-[26px] p-6 shadow-[0_22px_40px_-24px_rgba(42,50,68,0.45)] active:cursor-grabbing"
                    style={{
                      transform: exiting
                        ? `translateX(${swipeExit * 430}px) rotate(${swipeExit * 7}deg)`
                        : `translateX(${drag.dx}px) rotate(${drag.dx * 0.04}deg)`,
                      opacity: exiting ? 0 : 1,
                      transition: exiting
                        ? "transform 0.3s ease, opacity 0.3s ease"
                        : entering
                        ? // snap to center with no transform slide; just fade in
                          "opacity 0.25s ease"
                        : drag.active
                        ? "none"
                        : "transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
                    }}
                  >
                    {/* drag feedback — fade in as the card is pulled past center */}
                    <div
                      className={`pointer-events-none absolute right-5 top-5 rounded-[10px] border-2 px-2.5 py-1 ${localizedMonoClass(p.locale, "tracking-[0.12em]")} text-[12px] font-bold text-white`}
                      style={{
                        background: "var(--accent-bg)",
                        borderColor: "rgba(255,255,255,0.7)",
                        opacity: Math.max(0, Math.min(1, drag.dx / SWIPE_THRESHOLD)),
                        transform: "rotate(8deg)",
                      }}
                    >
                      {t.keep}
                    </div>
                    <div
                      className={`pointer-events-none absolute left-5 top-5 rounded-[10px] border-2 border-[rgba(30,33,42,0.25)] bg-[rgba(30,33,42,0.55)] px-2.5 py-1 ${localizedMonoClass(p.locale, "tracking-[0.12em]")} text-[12px] font-bold text-white`}
                      style={{
                        opacity: Math.max(0, Math.min(1, -drag.dx / SWIPE_THRESHOLD)),
                        transform: "rotate(-8deg)",
                      }}
                    >
                      {t.skip}
                    </div>
                    <div className="flex items-center justify-between">
                      <TypeBadge type={top.type} label={taskTypeLabel(p.locale, top.type)} locale={p.locale} />
                      <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                        {top.min} min
                      </span>
                    </div>
                    <div className="mt-[18px] text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] [text-wrap:pretty]">
                      {top.title}
                    </div>
                    <div className="mt-[9px] text-[14.5px] font-light leading-[1.45] text-[var(--ink2)]">
                      {top.reason}
                    </div>
                    <div className="mt-[26px] flex gap-2.5">
                      <button
                        onClick={() => swipe(false)}
                        className="h-[52px] flex-1 cursor-pointer rounded-[18px] bg-[var(--soft)] text-[14.5px] font-medium text-[var(--ink2)]"
                        style={{ border: "1px solid var(--soft-bd)" }}
                      >
                        {t.notToday}
                      </button>
                      <button
                        onClick={() => swipe(true)}
                        className="h-[52px] flex-[1.4] cursor-pointer rounded-[18px] border-none text-[14.5px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                        style={{ background: "var(--accent-bg)" }}
                      >
                        {t.keepToday}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* no more candidates — loop ring */}
            {deckDone && (
              <div className="glass-card mt-6 animate-ts-rise rounded-[26px] p-[22px] shadow-[0_18px_34px_-22px_rgba(42,50,68,0.4)]">
                <div className="mb-1 flex items-center justify-between">
                  <span className={`${localizedMonoClass(p.locale, "tracking-[0.16em]")} text-[11px] text-[var(--ink3)]`}>
                    {t.loop}
                  </span>
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[rgba(30,33,42,0.1)] text-xs text-[var(--ink3)]">
                    ›
                  </span>
                </div>
                <div className="flex justify-center pb-1.5 pt-2.5">
                  <div className="relative h-[150px] w-[150px]">
                    <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
                      <circle cx="75" cy="75" r={RING_R} fill="none" stroke="rgba(30,33,42,0.08)" strokeWidth="8" />
                      <circle
                        cx="75"
                        cy="75"
                        r={RING_R}
                        fill="none"
                        stroke={accent}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - (sel.length ? doneCount / sel.length : 0))}
                        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[44px] font-light leading-none tracking-[-0.02em]">{doneCount}</span>
                      <span className={`mt-1 ${p.locale === "zh-CN" ? "font-sans tracking-[0.04em]" : "font-mono"} text-[11px] text-[var(--ink3)]`}>
                        {t.of} {sel.length}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 text-center text-[19px] font-semibold tracking-[-0.01em]">
                  {t.noMoreCandidates}
                </div>
                <div className="mt-1 text-center text-[13.5px] font-light text-[var(--ink2)]">
                  {t.loopReady}
                </div>
                <button
                  onClick={() => goTab("build")}
                  className="mt-[18px] h-[54px] w-full cursor-pointer rounded-[18px] border-none text-[15px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                  style={{ background: "var(--accent-bg)" }}
                >
                  {t.startBuilding}
                </button>
              </div>
            )}

            {/* today's plan — one big thing, then the smaller rest */}
            {sel.length > 0 && (() => {
              const primaryTask = sel.find((c) => c.primary);
              const rest = sel.filter((c) => !c.primary);
              return (
                <div className="mt-[26px]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <MonoLabel locale={p.locale}>{t.todayPlan}</MonoLabel>
                    <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                      {doneCount}/{sel.length} done
                    </span>
                  </div>

                  {primaryTask && (
                    <div className="mb-4">
                      <div className={`mb-1.5 flex items-center gap-1.5 ${localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[9.5px]`} style={{ color: accent }}>
                        <span>★</span>
                        <span>{t.oneBigThing}</span>
                      </div>
                      {renderPlanRow(primaryTask, true)}
                    </div>
                  )}

                  {rest.length > 0 && (
                    <>
                      {primaryTask && (
                        <div className={`mb-1.5 ${localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[9.5px] text-[var(--ink3)]`}>
                          {t.alsoToday}
                        </div>
                      )}
                      <div className="flex flex-col gap-2.5">
                        {rest.map((task) => renderPlanRow(task, false))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {allComplete && (
              <div className="mt-6 rounded-[26px] border border-[rgba(90,160,117,0.32)] bg-[rgba(227,240,231,0.42)] p-6 text-center shadow-[0_18px_34px_-22px_rgba(42,50,68,0.4)] backdrop-blur-[26px] backdrop-saturate-[1.4]">
                <div className="text-[19px] font-semibold">{t.allDone}</div>
                <button
                  onClick={() => goTab("review")}
                  className="mt-3.5 cursor-pointer rounded-full border-none bg-[#E3F0E7] px-[22px] py-[13px] text-sm font-semibold text-[#3E7A56]"
                >
                  {t.closeLoopTonight} ›
                </button>
              </div>
            )}

            <div className="h-[130px]" />
          </div>
        )}

        {/* ============ BUILD ============ */}
        {tab === "build" && (
          <div className="animate-ts-fade px-[22px] pt-12">
            <span className={`${localizedMonoClass(p.locale, "tracking-[0.18em]")} text-[10.5px] text-[var(--ink3)]`}>
              {t.focusMode}
            </span>
            <h1 className="mt-[9px] text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">
              {t.oneThing}
            </h1>

            {!cur && (
              <div className="glass-card mt-[26px] rounded-[26px] px-6 py-[34px] text-center shadow-[0_18px_34px_-22px_rgba(42,50,68,0.4)]">
                <div className="mx-auto mb-3.5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[var(--soft)]">
                  <svg width="18" height="18" viewBox="0 0 22 22">
                    <path d="M11 2 L20 11 L11 20 L2 11 Z" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
                  </svg>
                </div>
                <div className="text-[19px] font-semibold">
                  {allComplete ? t.allBuilt : t.nothingPicked}
                </div>
                <div className="mt-[5px] text-[13.5px] font-light text-[var(--ink2)]">
                  {allComplete ? t.closeWithReview : t.chooseTasks}
                </div>
                <button
                  onClick={() => goTab("today")}
                  className="mt-[18px] cursor-pointer rounded-full border-none px-[26px] py-3.5 text-sm font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                  style={{ background: "var(--accent-bg)" }}
                >
                  {t.backToToday}
                </button>
              </div>
            )}

            {cur && (
              <>
                <div className="mb-2.5 mt-6 flex items-center justify-between">
                  <MonoLabel locale={p.locale}>
                    {t.nowBuilding} · {Math.min(buildIdx, pending.length - 1) + 1}/{pending.length}
                  </MonoLabel>
                  {pending.length > 1 && (
                    <button
                      onClick={() => {
                        secRef.current = 0;
                        setNudge(false);
                        setBuildIdx((i) => (i + 1) % pending.length);
                      }}
                      className={`cursor-pointer border-none bg-transparent py-1 ${localizedMonoClass(p.locale, "tracking-[0.1em]")} text-[10.5px] text-[var(--ink2)]`}
                    >
                      {t.switchTask} ›
                    </button>
                  )}
                </div>

                <div className="glass-card rounded-[26px] p-6 shadow-[0_22px_40px_-24px_rgba(42,50,68,0.45)]">
                  <div className="flex items-center justify-between">
                    <TypeBadge type={cur.type} label={taskTypeLabel(p.locale, cur.type)} locale={p.locale} />
                    <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                      {cur.min} min
                    </span>
                  </div>
                  {cur.primary && (
                    <div className={`mt-3 flex items-center gap-1.5 ${localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[9.5px]`} style={{ color: accent }}>
                      <span>★</span>
                      <span>{t.oneBigThing}</span>
                    </div>
                  )}
                  <div className="mt-4 text-[27px] font-semibold leading-[1.16] tracking-[-0.02em] [text-wrap:pretty]">
                    {cur.title}
                  </div>

                  <div className="mt-[22px] border-t border-[rgba(30,33,42,0.06)] pt-4">
                    <div className="mb-2.5 flex justify-between">
                      <span className={`${localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[10px] text-[var(--ink3)]`}>
                        {t.smallSteps}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--ink3)]">
                        {curSteps.filter((_, i) => p.stepsDone[`${cur.id}:${i}`]).length}/{curSteps.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {curSteps.map((label, i) => {
                        const key = `${cur.id}:${i}`;
                        const on = !!p.stepsDone[key];
                        return (
                          <button
                            key={key}
                            onClick={() =>
                              setP((s) => ({
                                ...s,
                                stepsDone: { ...s.stepsDone, [key]: !s.stepsDone[key] },
                              }))
                            }
                            className="flex cursor-pointer items-center gap-[11px] border-none bg-transparent py-[7px] text-left"
                          >
                            <span
                              className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] text-white transition-all duration-200"
                              style={{
                                background: on ? accent : "#fff",
                                border: `1px solid ${on ? accent : "rgba(30,33,42,0.18)"}`,
                              }}
                            >
                              {on ? "✓" : ""}
                            </span>
                            <span
                              className="text-[14.5px] transition-colors duration-200"
                              style={{
                                color: on ? "var(--ink3)" : "var(--ink)",
                                textDecoration: on ? "line-through" : "none",
                              }}
                            >
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* gentle nudge */}
                {nudge && (
                  <div className="mt-3.5 flex animate-ts-rise items-center gap-3 rounded-[20px] border border-[rgba(194,154,58,0.25)] bg-[#F7F1E2] px-[18px] py-4">
                    <div className="flex-1">
                      <div className="text-[14.5px] font-semibold">{t.stillOnThis}</div>
                      <div className="mt-0.5 text-[12.5px] font-light text-[var(--ink2)]">
                        {t.noRush}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        secRef.current = 0;
                        setNudge(false);
                        setNudgeHidden(true);
                      }}
                      className="cursor-pointer rounded-full border border-[rgba(30,33,42,0.08)] bg-white px-3.5 py-[9px] text-[12.5px] font-semibold text-[var(--ink)]"
                    >
                      {t.stillOnIt}
                    </button>
                    <button
                      onClick={() => {
                        secRef.current = 0;
                        setNudge(false);
                        setBuildIdx((i) => (i + 1) % Math.max(pending.length, 1));
                      }}
                      className="cursor-pointer border-none bg-transparent px-3.5 py-[9px] text-[12.5px] font-medium text-[var(--ink2)]"
                    >
                      {t.switchTask}
                    </button>
                  </div>
                )}

                {/* focus timer */}
                <div className="glass-card mt-3.5 rounded-[26px] px-[22px] py-5 shadow-[0_16px_30px_-22px_rgba(42,50,68,0.4)]">
                  <div className="flex items-center justify-between">
                    <span className={`${localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[10px] text-[var(--ink3)]`}>
                      {t.focusTimer}
                    </span>
                    <span
                      className={`rounded-full px-[9px] py-1 ${localizedMonoClass(p.locale, "tracking-[0.1em]")} text-[9.5px] text-[var(--ink2)]`}
                      style={{ background: "var(--soft)", border: "1px solid var(--soft-bd)" }}
                    >
                      {t.optional}
                    </span>
                  </div>

                  {!timerActive && (
                    <>
                      <div className="mt-3 text-[13.5px] font-light leading-[1.45] text-[var(--ink2)]">
                        {t.timerHelp}
                      </div>
                      <div className="mt-3.5 flex gap-2">
                        {([15, 25, 45, "Custom"] as const).map((c) => {
                          const on = timer.sel === c;
                          return (
                            <button
                              key={c}
                              onClick={() => setTimer((t) => ({ ...t, sel: c }))}
                              className={`flex-1 cursor-pointer rounded-[14px] py-[11px] ${p.locale === "zh-CN" ? "font-sans tracking-[0.04em]" : "font-mono"} text-[11.5px] transition-all duration-150`}
                              style={{
                                background: on ? theme.done.bg : "rgba(255,255,255,0.6)",
                                border: `1px solid ${on ? theme.done.bd : "rgba(122,108,92,0.14)"}`,
                                color: on ? theme.done.label : "var(--ink2)",
                                fontWeight: on ? 600 : 400,
                              }}
                            >
                              {c === "Custom" ? t.custom : `${c} min`}
                            </button>
                          );
                        })}
                      </div>
                      {timer.sel === "Custom" && (
                        <div className="mt-3 flex items-center justify-center gap-[18px]">
                          <button
                            onClick={() => setTimer((t) => ({ ...t, custom: Math.max(5, t.custom - 5) }))}
                            className="h-9 w-9 cursor-pointer rounded-full border border-[rgba(122,108,92,0.16)] bg-[rgba(255,255,255,0.7)] text-[17px] text-[var(--ink)]"
                          >
                            −
                          </button>
                          <span className="min-w-16 text-center font-mono text-sm text-[var(--ink)]">
                            {timer.custom} min
                          </span>
                          <button
                            onClick={() => setTimer((t) => ({ ...t, custom: Math.min(120, t.custom + 5) }))}
                            className="h-9 w-9 cursor-pointer rounded-full border border-[rgba(122,108,92,0.16)] bg-[rgba(255,255,255,0.7)] text-[17px] text-[var(--ink)]"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() =>
                          setTimer((t) => ({ ...t, left: startLen * 60, total: startLen * 60, running: true }))
                        }
                        className="mt-3.5 h-12 w-full cursor-pointer rounded-2xl border-none text-sm font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                        style={{ background: "var(--accent-bg)" }}
                      >
                        {t.startFocus} · {startLen} min
                      </button>
                    </>
                  )}

                  {timerActive && (
                    <>
                      <div className="mt-4 text-center font-mono text-[44px] font-medium tracking-[0.04em]">
                        {timerDisplay}
                      </div>
                      <div className="mt-3.5 h-[5px] overflow-hidden rounded-[3px] bg-[rgba(122,108,92,0.14)]">
                        <div
                          className="h-[5px] rounded-[3px] transition-[width] duration-1000 ease-linear"
                          style={{ background: "#5AA075", width: `${timerPct}%` }}
                        />
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setTimer((t) => ({ ...t, running: !t.running }))}
                          className="h-[46px] flex-1 cursor-pointer rounded-[15px] text-[13.5px] font-semibold"
                          style={{
                            background: "var(--soft)",
                            border: "1px solid var(--soft-bd)",
                            color: theme.done.label,
                          }}
                        >
                          {timer.running ? t.pause : t.resume}
                        </button>
                        <button
                          onClick={() => setTimer((t) => ({ ...t, left: null, running: false }))}
                          className="h-[46px] flex-1 cursor-pointer rounded-[15px] border border-[rgba(122,108,92,0.16)] bg-[rgba(255,255,255,0.7)] text-[13.5px] font-medium text-[var(--ink2)]"
                        >
                          {t.stopTimer}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => completeTask(cur.id, true)}
                  className="mt-[18px] h-14 w-full cursor-pointer rounded-[19px] border-none text-[15.5px] font-semibold text-white shadow-[0_16px_30px_-12px_var(--accent)]"
                  style={{ background: "var(--accent-bg)" }}
                >
                  {t.markComplete}
                </button>
              </>
            )}

            <div className="h-[130px]" />
          </div>
        )}


        {/* ============ REVIEW ============ */}
        {tab === "review" && (
          <div className="animate-ts-fade px-[22px] pt-12">
            <span className={`${localizedMonoClass(p.locale, "tracking-[0.18em]")} text-[10.5px] text-[var(--ink3)]`}>
              {t.eveningReview}
            </span>
            <h1 className="mt-[9px] text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">
              {t.closeTheLoop}
            </h1>
            <p className="mt-3 text-sm font-light leading-normal text-[var(--ink2)]">
              {t.reviewIntro}
            </p>

            <div className="mt-[18px] flex flex-wrap gap-2">
              {reviewPrompts[p.locale].map((pr) => (
                <button
                  key={pr}
                  onClick={() => setDraft(`${pr}: `)}
                  className={`glass-pill cursor-pointer rounded-full px-3.5 py-[9px] ${p.locale === "zh-CN" ? "font-sans tracking-[0.04em]" : "font-mono"} text-[11px] text-[var(--ink2)] shadow-[0_8px_18px_-14px_rgba(42,50,68,0.4)]`}
                >
                  {pr}
                </button>
              ))}
            </div>

            <div className="mt-[22px] flex flex-col gap-2.5">
              {p.msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="glass-pill max-w-[84%] animate-ts-rise rounded-[20px] rounded-br-md px-4 py-[13px] text-sm leading-[1.45] text-[var(--ink)] shadow-[0_10px_22px_-16px_rgba(42,50,68,0.4)]">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[84%] animate-ts-rise rounded-[20px] rounded-bl-md border border-[var(--soft-bd)] bg-[var(--soft)] px-4 py-[13px] text-sm leading-[1.45] text-[var(--ink)] shadow-[0_10px_22px_-16px_rgba(42,50,68,0.4)]">
                      {m.text}
                    </div>
                  </div>
                ),
              )}
              {replying && (
                <div className="flex justify-start">
                  <div className="animate-ts-rise rounded-[20px] rounded-bl-md border border-[var(--soft-bd)] bg-[var(--soft)] px-4 py-[15px] shadow-[0_10px_22px_-16px_rgba(42,50,68,0.4)]">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ink3)] [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ink3)] [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ink3)]" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {p.msgs.some((m) => m.role === "user") && !p.generated && (
              <button
                onClick={generatePlan}
                disabled={planning}
                className="mt-[18px] h-[54px] w-full cursor-pointer rounded-[18px] border-none text-[14.5px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)] disabled:opacity-60"
                style={{ background: "var(--accent-bg)" }}
              >
                {planning ? t.generating : t.generateTomorrow}
              </button>
            )}

            {p.generated && (
              <div className="mt-5 animate-ts-rise rounded-3xl border border-[rgba(90,160,117,0.32)] bg-[rgba(227,240,231,0.42)] p-[22px] shadow-[0_16px_30px_-22px_rgba(42,50,68,0.4)] backdrop-blur-[26px] backdrop-saturate-[1.4]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#5AA075] text-xs text-white">
                    ✓
                  </span>
                  <span className="text-[16.5px] font-semibold">{t.tomorrowReady}</span>
                </div>
                <div className="mt-4 flex flex-col gap-[9px]">
                  {plan.map((g) => (
                    <div key={g.id} className="group flex items-center gap-[11px]">
                      <span
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ background: TYPE_COLORS[NEW_TO_OLD_TYPE[g.type] ?? "Focus"][0] }}
                      />
                      <span className="flex-1 text-[13.5px] font-medium">{g.title}</span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[var(--ink3)]">
                        {g.minutes} min
                      </span>
                      <button
                        onClick={() => dropPlanItem(g.id)}
                        title={t.removeTask}
                        aria-label={`Remove ${g.title}`}
                        className="flex h-[22px] w-[22px] flex-none cursor-pointer items-center justify-center rounded-full border border-[rgba(30,33,42,0.12)] bg-white/70 text-[13px] leading-none text-[var(--ink2)]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {plan.length === 0 && (
                    <div className="text-[13px] font-light text-[var(--ink2)]">
                      {t.noTasksLeft}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2.5">
                  <button
                    onClick={regeneratePlan}
                    disabled={planning}
                    className="h-[46px] flex-1 cursor-pointer rounded-[15px] border-none text-[13.5px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)] disabled:opacity-60"
                    style={{ background: "var(--accent-bg)" }}
                  >
                    {planning ? t.regenerating : t.regenerate}
                  </button>
                </div>
                {plan.length > 0 && (
                  <div className="mt-3.5 font-mono text-[10px] tracking-[0.08em] text-[var(--ink3)]">
                    added to your Morning picks ↑
                  </div>
                )}
              </div>
            )}

            {loopClosed && (
              <div className="mt-4 pt-[22px] text-center">
                <svg width="20" height="20" viewBox="0 0 22 22" className="mx-auto">
                  <path d="M11 0 L13 9 L22 11 L13 13 L11 22 L9 13 L0 11 L9 9 Z" fill="#5AA075" />
                </svg>
                <div className="mt-2.5 text-lg font-semibold">{t.loopClosed}</div>
                <div className={`mt-1 ${p.locale === "zh-CN" ? "font-sans tracking-[0.04em]" : "font-mono"} text-[11px] text-[var(--ink3)]`}>{t.seeTomorrow}</div>
              </div>
            )}

            <div className="h-[210px]" />
          </div>
        )}
      </main>

      {/* review input bar */}
      {tab === "review" && (
        <div className="fixed bottom-[106px] left-1/2 z-[35] flex w-[calc(100%-28px)] max-w-[402px] -translate-x-1/2 items-center gap-2 rounded-[22px] border border-[rgba(30,33,42,0.07)] bg-[rgba(255,255,255,0.95)] p-2 shadow-[0_18px_36px_-18px_rgba(42,50,68,0.5)] backdrop-blur-[14px]">
          <button
            type="button"
            onClick={toggleVoice}
            title={
              voiceListening
                ? t.stopListening
                : voiceSupported
                  ? t.startListening
                  : t.voiceUnsupported
            }
            aria-label={
              voiceListening
                ? t.stopListening
                : voiceSupported
                  ? t.startListening
                  : t.voiceUnsupported
            }
            aria-pressed={voiceListening}
            className={`flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border transition-all ${
              voiceListening
                ? "animate-pulse border-transparent text-white"
                : "border-[rgba(30,33,42,0.06)] bg-[#EAEEF3] text-[#565C66]"
            }`}
            style={voiceListening ? { background: "var(--accent-bg)" } : undefined}
          >
            <svg width="15" height="15" viewBox="0 0 22 22">
              <rect x="8" y="2" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M5 11 a6 6 0 0 0 12 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="11" y1="17.5" x2="11" y2="20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          {voiceListening && (
            <span className="sr-only" aria-live="polite">
              {t.listening}
            </span>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t.reviewPlaceholder}
            className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
          />
          <button
            onClick={send}
            title={t.send}
            className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border-none pb-0.5 text-[17px] text-white"
            style={{ background: "var(--accent-bg)" }}
          >
            ↑
          </button>
        </div>
      )}

      {/* bottom tab bar — adaptive frosted glass */}
      <nav
        className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-3 gap-1 px-3.5 pt-[11px] backdrop-blur-[28px] backdrop-saturate-[1.7]"
        style={{
          background: theme.navBg,
          borderTop: `1px solid ${theme.navBorder}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 -10px 26px -18px rgba(30,33,42,0.45)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        {(
          [
            ["today", t.today, <path key="i" d="M11 1 L13 9 L21 11 L13 13 L11 21 L9 13 L1 11 L9 9 Z" fill="currentColor" />],
            ["build", t.build, <path key="i" d="M11 2 L20 11 L11 20 L2 11 Z" fill="currentColor" />],
            [
              "review",
              t.review,
              <g key="i" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="11" cy="11" r="8" />
                <polyline points="7.6,11.3 10,13.7 14.6,8.7" strokeLinecap="round" strokeLinejoin="round" />
              </g>,
            ],
          ] as [Tab, string, React.ReactNode][]
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => goTab(k)}
            className={`flex cursor-pointer flex-col items-center gap-1.5 border-none bg-transparent py-1.5 ${p.locale === "zh-CN" ? "font-sans tracking-normal" : localizedMonoClass(p.locale, "tracking-[0.14em]")} text-[9.5px] transition-colors duration-200`}
            style={{ color: tabColor(k) }}
          >
            <svg width="21" height="21" viewBox="0 0 22 22">
              {icon}
            </svg>
            {label}
          </button>
        ))}
      </nav>

      {/* quick add sheet */}
      {quickOpen && (
        <Sheet onClose={() => setQuickOpen(false)} label={t.quickAdd} locale={p.locale}>
          <input
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd(true)}
            placeholder={t.quickAddPlaceholder}
            autoFocus
            className="mt-3 h-[52px] w-full rounded-2xl border border-[rgba(30,33,42,0.08)] bg-white px-4 text-[15px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {(["Focus", "Quick", "Errand", "Health", "Admin", "Life"] as TaskType[]).map((tp) => {
              const on = quickType === tp;
              const [tc, tb] = TYPE_COLORS[tp];
              return (
                <button
                  key={tp}
                  onClick={() => setQuickType(tp)}
                  className={`cursor-pointer rounded-full px-[13px] py-2 ${localizedMonoClass(p.locale, "tracking-[0.1em]")} text-[10px] transition-all duration-150`}
                  style={{
                    background: on ? tb : "#fff",
                    border: `1px solid ${on ? tc : "rgba(30,33,42,0.08)"}`,
                    color: on ? tc : "var(--ink3)",
                  }}
                >
                  {taskTypeLabel(p.locale, tp)}
                </button>
              );
            })}
          </div>
          <div className="mt-[18px] flex gap-2.5">
            <button
              onClick={() => quickAdd(false)}
              className="h-[52px] flex-1 cursor-pointer rounded-[17px] bg-[var(--soft)] text-sm font-medium text-[var(--ink2)]"
              style={{ border: "1px solid var(--soft-bd)" }}
            >
              {t.addCandidate}
            </button>
            <button
              onClick={() => quickAdd(true)}
              className="h-[52px] flex-[1.3] cursor-pointer rounded-[17px] border-none text-sm font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
              style={{ background: "var(--accent-bg)" }}
            >
              {t.addToday}
            </button>
          </div>
        </Sheet>
      )}

      {settingsOpen && (
        <Sheet onClose={() => setSettingsOpen(false)} label={t.settings} locale={p.locale}>
          <div className="mt-4">
            <MonoLabel locale={p.locale}>{t.appearance}</MonoLabel>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {THEME_NAMES.map((themeName) => {
                const selected = p.theme === themeName;
                const meta = themeMeta[p.locale][themeName];
                return (
                  <button
                    key={themeName}
                    onClick={() => setTheme(themeName)}
                    className="rounded-[17px] bg-white p-3 text-left"
                    style={{
                      border: `1px solid ${selected ? accent : "rgba(30,33,42,0.08)"}`,
                    }}
                  >
                    <span
                      className="relative block h-14 overflow-hidden rounded-[11px]"
                      style={{ background: THEMES[themeName].bg }}
                    >
                      <span
                        className="absolute bottom-2 left-2 right-2 h-3 rounded-full shadow-sm"
                        style={{ background: THEMES[themeName].btn }}
                      />
                    </span>
                    <span className="mt-2 block text-[13px] font-semibold">
                      {meta.name}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] leading-[1.35] text-[var(--ink3)]">
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <MonoLabel locale={p.locale}>{t.language}</MonoLabel>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {(
                [
                  ["en", t.english],
                  ["zh-CN", t.chinese],
                ] as [Locale, string][]
              ).map(([locale, label]) => (
                <button
                  key={locale}
                  onClick={() => setLocale(locale)}
                  className="h-[46px] rounded-[15px] text-[13px] font-semibold"
                  style={{
                    background: p.locale === locale ? "var(--soft)" : "#fff",
                    border: `1px solid ${
                      p.locale === locale ? "var(--soft-bd)" : "rgba(30,33,42,0.08)"
                    }`,
                    color: p.locale === locale ? "var(--accent)" : "var(--ink2)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[18px] border border-[rgba(30,33,42,0.07)] bg-white/60 p-4">
            <MonoLabel locale={p.locale}>{t.aboutAi}</MonoLabel>
            <div className="mt-2 text-[16px] font-semibold">{t.localFirstTitle}</div>
            <p className="mt-1.5 text-[12.5px] font-light leading-[1.55] text-[var(--ink2)]">
              {t.localFirstBody}
            </p>
            <div className={`mt-3 flex flex-col gap-1.5 ${localizedMonoClass(p.locale, "tracking-[0.08em]")} text-[9.5px] text-[var(--ink3)]`}>
              <span>{t.mockAi}</span>
              <span>{t.selfHostAi}</span>
              <span>{t.cloudPlanned}</span>
              <span>{t.voicePrivacy}</span>
            </div>
          </div>

          <div className="mt-5">
            <MonoLabel locale={p.locale}>{t.data}</MonoLabel>
            <div className="mt-1.5 text-[11.5px] text-[var(--ink3)]">
              {t.dataSummary(getTasks().length, getReviews().length)}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <button
              onClick={exportLocalData}
              className="h-[48px] cursor-pointer rounded-[16px] border border-[rgba(30,33,42,0.08)] bg-white text-[13px] font-semibold text-[var(--ink)]"
            >
              {t.exportJson}
            </button>
            <button
              onClick={() => importRef.current?.click()}
              className="h-[48px] cursor-pointer rounded-[16px] border border-[rgba(30,33,42,0.08)] bg-white text-[13px] font-semibold text-[var(--ink)]"
            >
              {t.importJson}
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importLocalData(file);
            }}
          />
          {importError && (
            <div className="mt-3 rounded-[14px] bg-[#F5E2DD] px-3.5 py-3 text-[12.5px] leading-normal text-[#8C493F]">
              {importError}
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={resetAll}
              className="h-[46px] w-full cursor-pointer rounded-[16px] border border-[rgba(154,98,92,0.2)] bg-transparent text-[13px] font-semibold text-[#9A625C]"
            >
              {t.resetLocalData}
            </button>
          </div>
          </div>

          <div className="mt-3 text-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--ink3)]">
            Anew v{packageInfo.version}
          </div>
        </Sheet>
      )}

      {/* completion overlay */}
      {celebrate.on && (
        <div className="fixed inset-0 z-[60] flex animate-ts-fade flex-col items-center justify-center gap-4 bg-[rgba(243,246,250,0.93)] backdrop-blur-[10px]">
          <div
            className="flex h-[92px] w-[92px] animate-ts-pop items-center justify-center rounded-full shadow-[0_26px_50px_-18px_var(--accent)]"
            style={{ background: "var(--accent-bg)" }}
          >
            <svg width="36" height="36" viewBox="0 0 22 22">
              <polyline
                points="5,11.5 9.5,16 17,7"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-[22px] font-semibold tracking-[-0.01em] text-[#1E2127]">{t.oneLoopCloser}</div>
          <div className={`${p.locale === "zh-CN" ? "font-sans tracking-[0.04em]" : "font-mono tracking-[0.08em]"} text-[11px] text-[#959AA4]`}>{celebrate.sub}</div>
        </div>
      )}

      {/* toast */}
      {toastText && (
        <div className={`fixed bottom-[118px] left-1/2 z-[55] max-w-[86%] -translate-x-1/2 animate-ts-rise overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-[rgba(30,33,42,0.09)] bg-[rgba(248,248,247,0.94)] px-[18px] py-2.5 ${p.locale === "zh-CN" ? "font-sans" : "font-mono"} text-[11px] tracking-[0.04em] text-[#555A62] shadow-[0_12px_28px_-16px_rgba(30,33,42,0.28)] backdrop-blur-[14px]`}>
          {toastText}
        </div>
      )}
    </div>
  );
}
