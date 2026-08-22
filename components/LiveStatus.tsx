"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ConnectionState = "connecting" | "live" | "offline";

// A maxDuration cutoff reconnects in a couple seconds — not worth flashing "offline" for.
// Only show it if we're still down after this long.
const OFFLINE_DEBOUNCE_MS = 5000;

export function LiveStatus() {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>("connecting");
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const source = new EventSource("/api/news/stream");
    let offlineTimer: ReturnType<typeof setTimeout> | undefined;

    source.onopen = () => {
      clearTimeout(offlineTimer);
      setState("live");
    };
    source.onerror = () => {
      clearTimeout(offlineTimer);
      offlineTimer = setTimeout(() => setState("offline"), OFFLINE_DEBOUNCE_MS);
    };
    source.addEventListener("news", (event) => {
      const articles = JSON.parse((event as MessageEvent).data) as unknown[];
      setNewCount((count) => count + articles.length);
    });

    return () => {
      clearTimeout(offlineTimer);
      source.close();
    };
  }, []);

  const handleRefresh = () => {
    setNewCount(0);
    router.refresh();
  };

  const label = state === "live" ? "LIVE 即時連線中" : state === "connecting" ? "連線中…" : "連線中斷";

  return (
    <div className="flex items-center gap-3 border-b border-rule bg-ink px-4 py-2 font-mono text-xs text-paper sm:px-6">
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full bg-wire-red ${state === "live" ? "animate-pulse-dot" : "opacity-40"}`} />
        {label}
      </span>
      {newCount > 0 && (
        <button
          type="button"
          onClick={handleRefresh}
          className="ml-auto rounded-sm border border-paper/40 px-2 py-0.5 text-paper transition-colors hover:bg-paper hover:text-ink"
        >
          {newCount} 則新新聞・點擊更新
        </button>
      )}
    </div>
  );
}
