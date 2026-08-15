import Parser from "rss-parser";
import { supabase } from "./supabase.ts";

const CNA_TECH_FEED = "https://feeds.feedburner.com/rsscna/technology";

interface NormalizedArticle {
  source: string;
  category: string;
  title: string;
  summary: string | null;
  link: string;
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
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
  }));
}

const articles = await fetchCna();
console.log(`fetched ${articles.length} articles from 中央社`);

const { error, count } = await supabase
  .from("articles")
  .upsert(articles, { onConflict: "link", count: "exact" });

if (error) throw error;
console.log(`upserted ${count} rows into articles`);
