// Static data + design tokens for the Anew app.
// Mock data only; no backend, no API calls.

export type TaskType =
  | "Focus"
  | "Quick"
  | "Errand"
  | "Health"
  | "Admin"
  | "Life";

export const TASK_TYPES: TaskType[] = ["Focus", "Quick", "Errand", "Health", "Admin", "Life"];

// Legacy display types map to the plain-life types, so older saved tasks still
// render instead of crashing a color lookup.
const LEGACY_TASK_TYPE: Record<string, TaskType> = {
  Build: "Focus",
  GitHub: "Focus",
  Learning: "Focus",
  "Skill Test": "Focus",
  Review: "Quick",
};

export function normalizeTaskType(type: string): TaskType {
  if ((TASK_TYPES as string[]).includes(type)) return type as TaskType;
  return LEGACY_TASK_TYPE[type] ?? "Quick";
}

export type TaskStatus = "candidate" | "today" | "skippedToday" | "done";

export interface Task {
  id: string;
  title: string;
  reason: string;
  min: number;
  type: TaskType;
  energy: "Low" | "Medium" | "High";
  steps: string[];
  /** The single "one big thing" for the day. */
  primary?: boolean;
  status: TaskStatus;
}

export type ThemeName =
  | "Daybreak"
  | "Tide"
  | "Glacier"
  | "Sakura"
  | "Sunset"
  | "Stone";

export const THEME_NAMES: ThemeName[] = [
  "Daybreak",
  "Tide",
  "Glacier",
  "Sakura",
  "Sunset",
  "Stone",
];

export interface Theme {
  bg: string;
  btn: string;
  solid: string;
  softBg: string;
  softBd: string;
  done: { bg: string; bd: string; label: string; check: string };
  navBg: string;
  navBorder: string;
}

// Each theme couples a background, matching gradient button, solid accent
// (dots / ring / bars / active tab), and adaptive frosted bottom-bar tint.
export const THEMES: Record<ThemeName, Theme> = {
  Daybreak: {
    bg: "linear-gradient(180deg, #E2ECF8 0%, #EFEAE8 52%, #FBEEDE 100%)",
    btn: "linear-gradient(135deg, #84A4E8 0%, #F0A88E 100%)",
    solid: "#C76A56",
    softBg: "#F4E7DC",
    softBd: "rgba(176,108,80,0.18)",
    done: { bg: "#F6E7DD", bd: "rgba(199,106,86,0.40)", label: "#A85138", check: "#C76A56" },
    navBg: "linear-gradient(180deg, rgba(238,234,232,0.52) 0%, rgba(251,238,222,0.80) 100%)",
    navBorder: "rgba(224,130,94,0.30)",
  },
  Tide: {
    bg: "linear-gradient(180deg, #DEEDF0 0%, #ECEDE6 52%, #F8EFE2 100%)",
    btn: "linear-gradient(135deg, #64BFAD 0%, #DDB969 100%)",
    solid: "#5E9277",
    softBg: "#E7EEE9",
    softBd: "rgba(70,120,100,0.18)",
    done: { bg: "#E3F0E7", bd: "rgba(90,160,117,0.40)", label: "#3E7A56", check: "#5AA075" },
    navBg: "linear-gradient(180deg, rgba(236,237,230,0.52) 0%, rgba(248,239,226,0.80) 100%)",
    navBorder: "rgba(62,155,139,0.30)",
  },
  Glacier: {
    bg: "linear-gradient(180deg, #DCEEF7 0%, #E8F1F2 52%, #F4EEE4 100%)",
    btn: "linear-gradient(135deg, #5B9FC8 0%, #79C7B7 100%)",
    solid: "#397FA5",
    softBg: "#E1EFF4",
    softBd: "rgba(57,127,165,0.20)",
    done: { bg: "#DDEEF2", bd: "rgba(57,127,165,0.38)", label: "#2E6E8E", check: "#397FA5" },
    navBg: "linear-gradient(180deg, rgba(232,241,242,0.55) 0%, rgba(244,238,228,0.82) 100%)",
    navBorder: "rgba(57,127,165,0.28)",
  },
  Sakura: {
    bg: "linear-gradient(180deg, #F5E3EA 0%, #F3E9E7 52%, #F7F0DE 100%)",
    btn: "linear-gradient(135deg, #D47E9B 0%, #E3AC76 100%)",
    solid: "#B95F80",
    softBg: "#F5E6EC",
    softBd: "rgba(185,95,128,0.19)",
    done: { bg: "#F3E2E9", bd: "rgba(185,95,128,0.38)", label: "#984766", check: "#B95F80" },
    navBg: "linear-gradient(180deg, rgba(243,233,231,0.55) 0%, rgba(247,240,222,0.82) 100%)",
    navBorder: "rgba(185,95,128,0.27)",
  },
  Sunset: {
    bg: "linear-gradient(180deg, #F7E4D5 0%, #F3E5E1 50%, #E9E5F4 100%)",
    btn: "linear-gradient(135deg, #E18B62 0%, #9B82CE 100%)",
    solid: "#C16B50",
    softBg: "#F6E7DE",
    softBd: "rgba(193,107,80,0.20)",
    done: { bg: "#F5E3DA", bd: "rgba(193,107,80,0.40)", label: "#9F513B", check: "#C16B50" },
    navBg: "linear-gradient(180deg, rgba(243,229,225,0.55) 0%, rgba(233,229,244,0.82) 100%)",
    navBorder: "rgba(155,130,206,0.28)",
  },
  Stone: {
    bg: "linear-gradient(180deg, #E5E8EA 0%, #ECEAE5 52%, #F3E9DE 100%)",
    btn: "linear-gradient(135deg, #748894 0%, #B78D72 100%)",
    solid: "#657985",
    softBg: "#E8ECEE",
    softBd: "rgba(101,121,133,0.20)",
    done: { bg: "#E4EAEC", bd: "rgba(101,121,133,0.38)", label: "#506570", check: "#657985" },
    navBg: "linear-gradient(180deg, rgba(236,234,229,0.55) 0%, rgba(243,233,222,0.82) 100%)",
    navBorder: "rgba(101,121,133,0.26)",
  },
};

// [text, badge background] per task type
export const TYPE_COLORS: Record<TaskType, [string, string]> = {
  Focus: ["#BE5E37", "#F4E4DA"],
  Quick: ["#4E8AA8", "#E1EEF4"],
  Errand: ["#5C6657", "#E8EBE2"],
  Health: ["#3E9B8B", "#DFF0EC"],
  Admin: ["#8A8E84", "#ECEDE8"],
  Life: ["#C29A3A", "#F6EED8"],
};

export const SEED_CANDIDATES: Task[] = [
  { id: "c1", title: "The one thing that matters today", reason: "Start with a single clear focus", min: 30, type: "Focus", energy: "High", steps: ["Name the one thing", "Clear your space", "Make a small start"], primary: true, status: "candidate" },
  { id: "c2", title: "Do one small errand you keep putting off", reason: "Close a nagging open loop", min: 10, type: "Errand", energy: "Low", steps: ["Pick the smallest one", "Do it now"], status: "candidate" },
  { id: "c3", title: "Reply to two messages", reason: "Clear the deck", min: 15, type: "Admin", energy: "Low", steps: ["Inbox — top two only"], status: "candidate" },
  { id: "c4", title: "Write a short daily review", reason: "Feed tomorrow's plan", min: 5, type: "Quick", energy: "Low", steps: ["Open the Review tab", "One line per prompt"], status: "candidate" },
  { id: "c5", title: "Go for a walk or run", reason: "Reset energy and mental health", min: 30, type: "Health", energy: "Medium", steps: ["Shoes on", "Out the door"], status: "candidate" },
  { id: "c6", title: "Read or learn one small thing", reason: "Sharpen without overwhelm", min: 20, type: "Focus", energy: "Low", steps: ["Pick one page", "Read it", "Save one idea"], status: "candidate" },
  { id: "c7", title: "Plan tomorrow in three lines", reason: "Leave tomorrow a lighter start", min: 15, type: "Quick", energy: "Medium", steps: ["One big thing", "Two small things"], status: "candidate" },
  { id: "c8", title: "Drink water and stretch", reason: "Small reset for body and focus", min: 5, type: "Health", energy: "Low", steps: ["Fill a glass", "Stretch for two minutes"], status: "candidate" },
  { id: "c9", title: "Tidy one surface for ten minutes", reason: "Lighter space, lighter head", min: 10, type: "Life", energy: "Low", steps: ["Set a ten minute window", "Surfaces only"], status: "candidate" },
  { id: "c10", title: "Take a real break", reason: "Rest is part of the plan", min: 15, type: "Life", energy: "Low", steps: ["Step away from screens", "Do something kind for yourself"], status: "candidate" },
];

export const BASICS = [
  { id: "b1", label: "Morning meds" },
  { id: "b2", label: "Drink water" },
  { id: "b3", label: "Stretch / move" },
  { id: "b4", label: "Review the plan" },
] as const;
