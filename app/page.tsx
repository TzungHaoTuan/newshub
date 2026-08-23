import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { LiveStatus } from "@/components/LiveStatus";
import { ArticleFeed } from "@/components/ArticleFeed";
import { ArticleRowSkeleton } from "@/components/ArticleRowSkeleton";

export async function generateMetadata(props: PageProps<"/">): Promise<Metadata> {
  const params = await props.searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;

  return {
    // Root layout's title.template doesn't apply here — layout.tsx and page.tsx
    // are the same route segment, so we build the full title string ourselves.
    ...(category ? { title: `${category} 新聞 | NewsHub` } : {}),
    description: category
      ? `NewsHub「${category}」分類最新新聞，中央社、自由時報、公視新聞網多來源聚合。`
      : "中央社、自由時報、公視新聞網即時聚合，分類篩選、多家媒體重複報導自動偵測。",
    alternates: { canonical: category ? `/?category=${encodeURIComponent(category)}` : "/" },
  };
}

export default async function Home(props: PageProps<"/">) {
  const params = await props.searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;

  const linkParams: Record<string, string | undefined> = { category };

  return (
    <>
      <LiveStatus />
      <header className="border-b border-rule px-4 py-5 sm:px-6">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-wire-red">Wire Service · 多來源聚合</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">NewsHub</h1>
      </header>
      <CategoryTabs current={category} searchParams={linkParams} />
      <Suspense
        key={`${category ?? ""}-${page}`}
        fallback={
          <main className="flex-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArticleRowSkeleton key={i} />
            ))}
          </main>
        }
      >
        <ArticleFeed category={category} page={page} linkParams={linkParams} />
      </Suspense>
    </>
  );
}
