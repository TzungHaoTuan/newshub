import Parser from "rss-parser";

const CNA_TECH_FEED = "https://feeds.feedburner.com/rsscna/technology";

interface NormalizedArticle {
  source: string;
  category: string;
  title: string;
  summary: string | null;
  link: string;
  image_url: string | null;
  published_at: string; // ISO 8601
}

function stripHtml(text: string | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(/<[^>]+>/g, "").trim();
  return cleaned || null;
}

async function fetchCna(): Promise<NormalizedArticle[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(CNA_TECH_FEED);

  return (feed.items ?? []).map((item) => ({
    source: "中央社",
    category: "科技",
    title: item.title?.trim() ?? "",
    summary: stripHtml(item.contentSnippet ?? item.content),
    link: item.link ?? "",
    image_url: item.enclosure?.url ?? null,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
  }));
}

const articles = await fetchCna();
console.log(`fetched ${articles.length} articles from 中央社`);
console.log(JSON.stringify(articles.slice(0, 3), null, 2));
