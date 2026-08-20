import type { Article } from "@/lib/articles";

// 沒有站內文章詳情頁（卡片直接連回原文），所以用 ItemList 包 NewsArticle
// 標記整個列表頁，而不是逐篇文章各自的 JSON-LD。
export function ArticleListJsonLd({ articles }: { articles: Article[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "NewsArticle",
        headline: article.title,
        url: article.link,
        datePublished: article.published_at,
        ...(article.summary ? { description: article.summary } : {}),
        publisher: { "@type": "Organization", name: article.source },
      },
    })),
  };

  // Article titles/summaries come from external RSS feeds; escape "<" so a
  // literal "</script>" in feed content can't break out of the script tag.
  const safeJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson }} />
  );
}
