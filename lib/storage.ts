// localStorage-backed persistence for the canonical Anew model.
//
// Each entity gets its own key so reads and writes stay small and independent.
// Every accessor is SSR-safe: on the server (no `window`) reads return empty
// defaults and writes are no-ops, so these helpers can be imported anywhere and
// called freely from client components after mount.
//
// Storage keeps historical key prefixes so existing browser data and backups
// remain readable. New code should treat these as legacy storage identifiers.

import type { DailyBasic, DailyReview, Task } from "./types";

export const KEYS = {
  tasks: "hamloop:tasks",
  reviews: "hamloop:reviews",
  dailyBasics: "hamloop:dailyBasics",
} as const;

export const LOOP_STORAGE_KEY = "hamloop_loop_v1";
export const LEGACY_LOOP_STORAGE_KEY = "taostack_loop_v1";

// Legacy pre-Anew key → current key. Data under a legacy key is copied to
// its new key on first access, then the legacy key is removed.
const LEGACY_KEYS: Record<string, string> = {
  "taostack:tasks": KEYS.tasks,
  "taostack:reviews": KEYS.reviews,
  "taostack:dailyBasics": KEYS.dailyBasics,
};

export const LEGACY_STORAGE_KEYS = [
  LOOP_STORAGE_KEY,
  LEGACY_LOOP_STORAGE_KEY,
  ...Object.values(KEYS),
  ...Object.keys(LEGACY_KEYS),
] as const;

export interface LegacyExport {
  app: "HamLoop" | "Anew";
  exportedAt: string;
  version?: string;
  tasks: Task[];
  reviews: DailyReview[];
  dailyBasics: DailyBasic[];
  loopState?: Record<string, unknown>;
}

const isBrowser = typeof window !== "undefined";

let migrated = false;

/** One-time copy of legacy storage data to the current legacy-compatible keys. */
function ensureMigrated(): void {
  if (migrated || !isBrowser) return;
  migrated = true;
  try {
    for (const [legacyKey, newKey] of Object.entries(LEGACY_KEYS)) {
      if (window.localStorage.getItem(newKey) === null) {
        const value = window.localStorage.getItem(legacyKey);
        if (value !== null) {
          window.localStorage.setItem(newKey, value);
          window.localStorage.removeItem(legacyKey);
        }
      }
    }
  } catch {
    // Storage unavailable — nothing to migrate.
  }
}

/** Read and JSON-parse a key, returning `fallback` on miss, SSR, or corruption. */
function read<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  ensureMigrated();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Missing, unavailable, or corrupted storage — fall back cleanly.
    return fallback;
  }
}

/** JSON-serialize and write a key. No-op on the server or if storage is blocked/full. */
function write<T>(key: string, value: T): void {
  if (!isBrowser) return;
  ensureMigrated();
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota exceeded) — degrade to in-memory.
  }
}

/* ---------- Tasks ---------- */

export function getTasks(): Task[] {
  return read<Task[]>(KEYS.tasks, []);
}

export function saveTasks(tasks: Task[]): void {
  write(KEYS.tasks, tasks);
}

/* ---------- Daily reviews ---------- */

export function getReviews(): DailyReview[] {
  return read<DailyReview[]>(KEYS.reviews, []);
}

/**
 * Upsert a single day's review. Reviews are keyed by `date` (one per day), so
 * saving an existing date replaces that day's review rather than duplicating it.
 */
export function saveReview(review: DailyReview): void {
  const reviews = getReviews();
  const idx = reviews.findIndex((r) => r.date === review.date);
  if (idx >= 0) reviews[idx] = review;
  else reviews.push(review);
  write(KEYS.reviews, reviews);
}

/* ---------- Daily basics ---------- */

export function getDailyBasics(): DailyBasic[] {
  return read<DailyBasic[]>(KEYS.dailyBasics, []);
}

export function saveDailyBasics(basics: DailyBasic[]): void {
  write(KEYS.dailyBasics, basics);
}

/* ---------- Backup, restore, and reset ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isArrayOfRecords(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isTask(value: Record<string, unknown>): boolean {
  // New plain-life types plus legacy types, so older backups still import;
  // legacy types are normalized on display.
  const types = [
    "focus", "quick", "errand", "health", "admin", "life",
    "build", "github", "skill-test", "learning", "review",
  ];
  const statuses = ["candidate", "today", "skippedToday", "completed", "archived"];
  const energies = ["low", "medium", "high"];
  return (
    ["id", "title", "createdAt", "updatedAt"].every((key) => isString(value[key])) &&
    isString(value.type) &&
    types.includes(value.type) &&
    isString(value.status) &&
    statuses.includes(value.status) &&
    (value.energy === undefined || (isString(value.energy) && energies.includes(value.energy))) &&
    (value.steps === undefined ||
      (Array.isArray(value.steps) && value.steps.every((step) => isString(step))))
  );
}

function isReview(value: Record<string, unknown>): boolean {
  if (!isString(value.date) || !isString(value.createdAt) || !isString(value.updatedAt)) {
    return false;
  }
  return (
    isRecord(value.responses) &&
    Object.values(value.responses).every((response) => isString(response))
  );
}

function isDailyBasic(value: Record<string, unknown>): boolean {
  return (
    isString(value.id) &&
    isString(value.label) &&
    typeof value.done === "boolean" &&
    isString(value.date)
  );
}

function isBooleanRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function isLoopState(value: Record<string, unknown>): boolean {
  const themes = [
    "Daybreak",
    "Tide",
    "Glacier",
    "Sakura",
    "Sunset",
    "Stone",
  ];
  return (
    isString(value.day) &&
    isString(value.theme) &&
    themes.includes(value.theme) &&
    (value.locale === undefined || value.locale === "en" || value.locale === "zh-CN") &&
    typeof value.swiped === "number" &&
    isBooleanRecord(value.basicsDone) &&
    isBooleanRecord(value.stepsDone) &&
    typeof value.generated === "boolean" &&
    isArrayOfRecords(value.basics) &&
    value.basics.every((basic) => isString(basic.id) && isString(basic.label)) &&
    isArrayOfRecords(value.msgs) &&
    value.msgs.every(
      (message) =>
        (message.role === "user" || message.role === "assistant") && isString(message.text),
    )
  );
}

export function parseLegacyExport(raw: string): LegacyExport {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  if (!isRecord(value) || (value.app !== "HamLoop" && value.app !== "Anew")) {
    throw new Error("That does not look like an Anew export.");
  }

  const collections = [
    ["tasks", value.tasks, isTask],
    ["reviews", value.reviews, isReview],
    ["dailyBasics", value.dailyBasics, isDailyBasic],
  ] as const;

  for (const [label, collection, validator] of collections) {
    if (!isArrayOfRecords(collection) || !collection.every(validator)) {
      throw new Error(`The ${label} data in this export is invalid.`);
    }
  }

  if (
    value.loopState !== undefined &&
    (!isRecord(value.loopState) || !isLoopState(value.loopState))
  ) {
    throw new Error("The app state in this export is invalid.");
  }

  return {
    app: value.app,
    exportedAt: isString(value.exportedAt) ? value.exportedAt : new Date().toISOString(),
    version: isString(value.version) ? value.version : undefined,
    tasks: value.tasks as unknown as Task[],
    reviews: value.reviews as unknown as DailyReview[],
    dailyBasics: value.dailyBasics as unknown as DailyBasic[],
    loopState: value.loopState,
  };
}

export function importLegacyData(data: LegacyExport): void {
  if (!isBrowser) return;

  const previous = new Map(
    LEGACY_STORAGE_KEYS.map((key) => [key, window.localStorage.getItem(key)]),
  );
  try {
    window.localStorage.setItem(KEYS.tasks, JSON.stringify(data.tasks));
    window.localStorage.setItem(KEYS.reviews, JSON.stringify(data.reviews));
    window.localStorage.setItem(KEYS.dailyBasics, JSON.stringify(data.dailyBasics));

    if (data.loopState) {
      window.localStorage.setItem(LOOP_STORAGE_KEY, JSON.stringify(data.loopState));
    } else {
      window.localStorage.removeItem(LOOP_STORAGE_KEY);
    }

    for (const legacyKey of [LEGACY_LOOP_STORAGE_KEY, ...Object.keys(LEGACY_KEYS)]) {
      window.localStorage.removeItem(legacyKey);
    }
  } catch (error) {
    for (const [key, oldValue] of previous) {
      if (oldValue === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, oldValue);
    }
    throw error;
  }
}

export function clearLegacyData(): void {
  if (!isBrowser) return;
  for (const key of LEGACY_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
