import Parser from "rss-parser";
import { supabase } from "../lib/supabase";
import { SOURCES } from "../lib/sources";
import { stripHtml, titleSimilarity, DUPLICATE_THRESHOLD } from "./normalize";

interface NormalizedArticle {
  source: string;
  category: string;
  title: string;
  summary: string | null;
  link: string;
  published_at: string;
}

const RECENT_WINDOW_HOURS = 48;

async function fetchSource(
  parser: Parser,
  source: (typeof SOURCES)[number],
): Promise<NormalizedArticle[]> {
  const feed = await parser.parseURL(source.feedUrl);
  return (feed.items ?? []).map((item) => ({
    source: source.name,
    category: source.category,
    title: item.title?.trim() ?? "",
    summary: stripHtml(item.contentSnippet ?? item.content ?? item.summary),
    link: item.link ?? "",
    published_at: item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()),
  }));
}

// Fetch every source in parallel (each is a distinct domain); one source failing must not stop the rest.
const parser = new Parser({
  headers: { "User-Agent": "NewsHub/1.0 (+https://github.com/TzungHaoTuan/newshub; personal non-commercial side project)" },
});
const allArticles: NormalizedArticle[] = [];

const results = await Promise.allSettled(SOURCES.map((source) => fetchSource(parser, source)));
results.forEach((result, i) => {
  const source = SOURCES[i];
  if (result.status === "fulfilled") {
    allArticles.push(...result.value);
    console.log(`${source.name}: fetched ${result.value.length} articles`);
  } else {
    console.error(`${source.name}: fetch failed —`, result.reason instanceof Error ? result.reason.message : result.reason);
  }
});

if (allArticles.length === 0) {
  console.log("no articles fetched from any source, nothing to upsert");
  process.exit(0);
}

const { data: upserted, error: upsertError } = await supabase
  .from("articles")
  .upsert(allArticles, { onConflict: "link" })
  .select("id, title, published_at, link");
if (upsertError) throw upsertError;

console.log(`upserted ${upserted.length} rows into articles`);

// Semantic dedup: only compare each article against the recent time window,
// so the comparison cost stays flat regardless of how much history accumulates.
const since = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
const { data: recent, error: recentError } = await supabase
  .from("articles")
  .select("id, title, published_at")
  .gte("published_at", since);
if (recentError) throw recentError;

const pool = recent
  .filter((row) => !upserted.some((u) => u.id === row.id))
  .map((row) => ({ id: row.id, title: row.title }));

const chronological = [...upserted].sort(
  (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
);

let duplicateCount = 0;
for (const article of chronological) {
  const match = pool.find((candidate) => titleSimilarity(article.title, candidate.title) >= DUPLICATE_THRESHOLD);
  if (match) {
    const { error } = await supabase.from("articles").update({ duplicate_of: match.id }).eq("id", article.id);
    if (error) throw error;
    duplicateCount++;
  }
  pool.push({ id: article.id, title: article.title });
}

console.log(`marked ${duplicateCount} near-duplicate articles`);
