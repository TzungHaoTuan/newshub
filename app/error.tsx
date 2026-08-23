"use client";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 border-b border-rule bg-ink px-4 py-2 font-mono text-xs text-paper sm:px-6">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-wire-red opacity-40" />
          連線中斷
        </span>
      </div>

      <header className="border-b border-rule px-4 py-5 sm:px-6">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-wire-red">
          Wire Service · 多來源聚合
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          NewsHub
        </h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center text-ink-muted sm:px-6">
        <p>目前無法載入新聞，請稍後再試。</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-3 rounded-sm border border-rule px-3 py-1 text-sm hover:border-ink"
        >
          重新載入
        </button>
      </div>
    </div>
  );
}
