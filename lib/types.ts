// Canonical Anew data model.
//
// This is the clean, app-facing domain model that the prototype's mock types
// in `app/lib/loop-data.ts` will migrate onto as Anew becomes a real app.
// Every enum value is a stable, lowercase, serialization-friendly identifier
// (not a display label) so values are safe to persist and send over the wire.

/** What kind of work a task represents — plain-life categories, not tech tasks. */
export type TaskType =
  | "focus" // the one meaningful, deeper thing
  | "quick" // a small quick win
  | "errand" // out in the world / phone calls
  | "health" // movement, meds, rest, self-care
  | "admin" // email, paperwork, logistics
  | "life"; // home, tidying, personal

/** Lifecycle of a task through the daily loop. */
export type TaskStatus =
  | "candidate" // suggested, not yet pulled into a day
  | "today" // chosen for today
  | "skippedToday" // passed on for today (may resurface as a candidate)
  | "completed" // finished
  | "archived"; // removed from rotation

/** Rough effort cost, used to match a task to current energy. */
export type EnergyLevel = "low" | "medium" | "high";

/** A single unit of work in the daily loop. */
export interface Task {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  /** Why this task is worth doing — shown on the card. */
  reason?: string;
  /** Estimated effort in minutes. */
  minutes?: number;
  /** Rough energy cost. */
  energy?: EnergyLevel;
  /** Concrete steps to make starting frictionless. */
  steps?: string[];
  /** The single "one big thing" for the day. At most one task should have this. */
  primary?: boolean;
  /** ISO date (YYYY-MM-DD) this task is scheduled for, when status is "today". */
  scheduledFor?: string;
  /** Where the task came from, e.g. "ai-plan" | "manual". */
  source?: string;
  /** ISO timestamp the task was created. */
  createdAt: string;
  /** ISO timestamp of the most recent change. */
  updatedAt: string;
  /** ISO timestamp set when status becomes "completed". */
  completedAt?: string;
}

/** Free-text answers to the end-of-day review prompts — one record per day. */
export interface DailyReview {
  /** ISO date (YYYY-MM-DD); the unique key — one review per day. */
  date: string;
  /** Prompt → answer. The prompt text is the key so the set can evolve. */
  responses: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** A recurring daily basic (meds, water, …) and whether it's done for a day. */
export interface DailyBasic {
  id: string;
  label: string;
  done: boolean;
  /** ISO date (YYYY-MM-DD) this checkmark belongs to. */
  date: string;
}
