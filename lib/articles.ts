import { supabase } from "./supabase";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface Article {
  id: string;
  source: string;
  category: string | null;
  tags: string[];
  title: string;
  summary: string | null;
  link: string;
  published_at: string;
}

export interface ArticleQuery {
  category?: string | null;
  source?: string | null;
  tag?: string | null;
  page?: number;
  pageSize?: number;
}

export async function getArticles({ category, source, tag, page = 1, pageSize = DEFAULT_PAGE_SIZE }: ArticleQuery) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  let query = supabase
    .from("articles")
    .select("id, source, category, tags, title, summary, link, published_at", { count: "exact" })
    .is("duplicate_of", null); // 只回傳非重複文章，語意重複的合併顯示留給未來的前端擴充

  if (category) query = query.eq("category", category);
  if (source) query = query.eq("source", source);
  if (tag) query = query.contains("tags", [tag]);

  const { data, error, count } = await query
    .order("published_at", { ascending: false })
    .range(offset, offset + safePageSize - 1);

  if (error) throw error;

  return { articles: data, page: safePage, pageSize: safePageSize, total: count ?? 0 };
}
