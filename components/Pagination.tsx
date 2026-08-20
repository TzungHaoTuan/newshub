import Link from "next/link";
import { withParams } from "@/lib/queryString";

export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="flex items-center justify-center gap-4 py-6 font-mono text-sm" aria-label="分頁">
      <Link
        href={withParams(searchParams, { page: hasPrev ? page - 1 : undefined })}
        aria-disabled={!hasPrev}
        className={`rounded-sm border border-rule px-3 py-1 ${hasPrev ? "hover:border-ink" : "pointer-events-none opacity-30"}`}
      >
        ‹ 上一頁
      </Link>
      <span className="text-ink-muted">
        {page} / {totalPages}
      </span>
      <Link
        href={withParams(searchParams, { page: hasNext ? page + 1 : undefined })}
        aria-disabled={!hasNext}
        className={`rounded-sm border border-rule px-3 py-1 ${hasNext ? "hover:border-ink" : "pointer-events-none opacity-30"}`}
      >
        下一頁 ›
      </Link>
    </nav>
  );
}
