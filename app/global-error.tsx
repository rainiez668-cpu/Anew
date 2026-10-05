"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#e5e8ec",
          color: "#1e2127",
          fontFamily: '"Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif',
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <title>Anew error</title>
            <h1>Anew could not load.</h1>
            <p>Your local data has not been cleared.</p>
            <button type="button" onClick={unstable_retry}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
