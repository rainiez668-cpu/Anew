import { describe, expect, it } from "vitest";
import { mergeCanonicalTasks, toCanonicalTask, toDisplayTask } from "./task-adapter";
import type { Task as CanonicalTask } from "./types";
import type { Task as DisplayTask } from "../app/lib/loop-data";

const displayTask: DisplayTask = {
  id: "task-1",
  title: "Ship a small fix",
  reason: "Keep momentum",
  min: 20,
  type: "Focus",
  energy: "Medium",
  steps: ["Open the file", "Make the change"],
  status: "candidate",
};

describe("task adapter", () => {
  it("maps display tasks to the canonical model", () => {
    const task = toCanonicalTask(displayTask);

    expect(task).toMatchObject({
      id: "task-1",
      type: "focus",
      status: "candidate",
      minutes: 20,
      energy: "medium",
    });
  });

  it("normalizes legacy canonical types to the plain-life model", () => {
    const legacy = { ...toCanonicalTask(displayTask), type: "build" as CanonicalTask["type"] };
    expect(toDisplayTask(legacy).type).toBe("Focus");

    const review = { ...toCanonicalTask(displayTask), type: "review" as CanonicalTask["type"] };
    expect(toDisplayTask(review).type).toBe("Quick");
  });

  it("maps completed canonical tasks back to done display tasks", () => {
    const canonical: CanonicalTask = {
      ...toCanonicalTask(displayTask),
      status: "completed",
      completedAt: "2026-06-12T12:00:00.000Z",
    };

    expect(toDisplayTask(canonical).status).toBe("done");
  });

  it("preserves creation and completion timestamps when state is persisted again", () => {
    const existing: CanonicalTask = {
      ...toCanonicalTask(displayTask),
      createdAt: "2026-06-10T12:00:00.000Z",
      completedAt: "2026-06-11T12:00:00.000Z",
      status: "completed",
    };
    const completedDisplay = { ...displayTask, status: "done" as const };

    const [merged] = mergeCanonicalTasks([completedDisplay], [existing]);

    expect(merged.createdAt).toBe(existing.createdAt);
    expect(merged.completedAt).toBe(existing.completedAt);
  });
});
