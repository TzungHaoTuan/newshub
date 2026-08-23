import { getArticles } from "@/lib/articles";
import { ArticleRow } from "@/components/ArticleRow";
import { Pagination } from "@/components/Pagination";
import { ArticleListJsonLd } from "@/components/ArticleListJsonLd";

export async function ArticleFeed({
  category,
  page,
  linkParams,
}: {
  category?: string;
  page: number;
  linkParams: Record<string, string | undefined>;
}) {
  const { articles, pageSize, total } = await getArticles({ category, page });

  return (
    <>
      <ArticleListJsonLd articles={articles} />
      <main className="flex-1">
        {articles.length === 0 ? (
          <p className="px-4 py-10 text-center text-ink-muted sm:px-6">目前沒有符合條件的新聞。</p>
        ) : (
          articles.map((article) => <ArticleRow key={article.id} article={article} />)
        )}
      </main>
      <Pagination page={page} pageSize={pageSize} total={total} searchParams={linkParams} />
    </>
  );
}
