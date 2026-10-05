import type { Task as CanonicalTask, TaskStatus as CanonicalStatus } from "./types";
import type {
  Task as DisplayTask,
  TaskStatus as DisplayStatus,
  TaskType as DisplayType,
} from "../app/lib/loop-data";

const DISPLAY_TO_CANONICAL_TYPE = {
  Focus: "focus",
  Quick: "quick",
  Errand: "errand",
  Health: "health",
  Admin: "admin",
  Life: "life",
} as const;

const CANONICAL_TO_DISPLAY_TYPE: Record<CanonicalTask["type"], DisplayType> = {
  focus: "Focus",
  quick: "Quick",
  errand: "Errand",
  health: "Health",
  admin: "Admin",
  life: "Life",
};

// Legacy canonical types map to the plain-life model, so older persisted tasks
// still map to a valid display type instead of `undefined`.
const LEGACY_CANONICAL_TYPE: Record<string, CanonicalTask["type"]> = {
  build: "focus",
  github: "focus",
  learning: "focus",
  "skill-test": "focus",
  review: "quick",
};

function normalizeCanonicalType(type: string): CanonicalTask["type"] {
  if (type in CANONICAL_TO_DISPLAY_TYPE) return type as CanonicalTask["type"];
  return LEGACY_CANONICAL_TYPE[type] ?? "quick";
}

const DISPLAY_TO_CANONICAL_STATUS: Record<DisplayStatus, CanonicalStatus> = {
  candidate: "candidate",
  today: "today",
  skippedToday: "skippedToday",
  done: "completed",
};

function toDisplayStatus(status: CanonicalStatus): DisplayStatus {
  if (status === "completed") return "done";
  if (status === "today" || status === "skippedToday") return status;
  return "candidate";
}

export function toCanonicalTask(task: DisplayTask, previous?: CanonicalTask): CanonicalTask {
  const now = new Date().toISOString();
  const status = DISPLAY_TO_CANONICAL_STATUS[task.status];
  return {
    id: task.id,
    title: task.title,
    reason: task.reason,
    type: DISPLAY_TO_CANONICAL_TYPE[task.type],
    minutes: task.min,
    energy: task.energy.toLowerCase() as CanonicalTask["energy"],
    steps: task.steps,
    primary: task.primary,
    status,
    source: previous?.source ?? "local",
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    completedAt:
      status === "completed" ? previous?.completedAt ?? now : undefined,
  };
}

export function toDisplayTask(task: CanonicalTask): DisplayTask {
  return {
    id: task.id,
    title: task.title,
    reason: task.reason ?? "Saved task",
    min: task.minutes ?? 20,
    type: CANONICAL_TO_DISPLAY_TYPE[normalizeCanonicalType(task.type)],
    energy:
      task.energy === "low" ? "Low" : task.energy === "high" ? "High" : "Medium",
    steps: task.steps?.length ? task.steps : ["Make a small start"],
    primary: task.primary,
    status: toDisplayStatus(task.status),
  };
}

export function mergeCanonicalTasks(
  displayTasks: DisplayTask[],
  existing: CanonicalTask[],
): CanonicalTask[] {
  const existingById = new Map(existing.map((task) => [task.id, task]));
  return displayTasks.map((task) =>
    toCanonicalTask(task, existingById.get(task.id)),
  );
}
