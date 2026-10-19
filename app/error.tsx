"use client";

import { useEffect, useState } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [isChinese] = useState(() =>
    typeof document !== "undefined" &&
    (document.documentElement.lang === "zh-CN" ||
      navigator.language.toLowerCase().startsWith("zh")),
  );
  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = isChinese
    ? {
        title: "出现了一点问题",
        body: "页面暂时无法正常显示，请尝试重新加载。如果问题持续出现，可以稍后再试。",
        retry: "重试",
      }
    : {
        title: "Something went wrong.",
        body: "This page could not be displayed right now. Try loading it again. If the problem continues, please try again later.",
        retry: "Try again",
      };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="glass-card max-w-sm rounded-[28px] p-8">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-3 text-sm text-[#666c76]">
          {copy.body}
        </p>
        <button
          type="button"
          onClick={unstable_retry}
          className="mt-6 rounded-full bg-[#1e2127] px-6 py-3 text-sm font-semibold text-white"
        >
          {copy.retry}
        </button>
      </div>
    </main>
  );
}
