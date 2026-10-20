import { notFound } from "next/navigation";

import { TodaySwipeTest } from "./today-swipe-test";

export default function TodaySwipeTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <TodaySwipeTest />;
}
