"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="glass-card max-w-sm rounded-[28px] p-8">
        <h1 className="text-2xl font-semibold">The loop hit a snag.</h1>
        <p className="mt-3 text-sm text-[#666c76]">
          Your saved data is still on this device. Try loading this screen again.
        </p>
        <button
          type="button"
          onClick={unstable_retry}
          className="mt-6 rounded-full bg-[#1e2127] px-6 py-3 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
