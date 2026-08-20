import Link from "next/link";
import { SOURCES } from "@/lib/sources";
import { withParams } from "@/lib/queryString";

const CATEGORIES = Array.from(new Set(SOURCES.map((s) => s.category)));

export function CategoryTabs({
  current,
  searchParams,
}: {
  current?: string;
  searchParams: Record<string, string | undefined>;
}) {
  const tabs: Array<{ label: string; value?: string }> = [
    { label: "全部", value: undefined },
    ...CATEGORIES.map((category) => ({ label: category, value: category })),
  ];

  return (
    <nav className="flex gap-1 border-b border-rule px-4 sm:px-6 overflow-x-auto" aria-label="分類篩選">
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <Link
            key={tab.label}
            href={withParams(searchParams, { category: tab.value, page: undefined })}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 -mb-px px-3 py-2.5 font-body text-sm transition-colors ${
              active ? "border-wire-red font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
