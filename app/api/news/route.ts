import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const source = params.get("source");
  const tag = params.get("tag");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("articles")
    .select("id, source, category, tags, title, summary, link, published_at", { count: "exact" })
    .is("duplicate_of", null); // 只回傳非重複文章，語意重複的合併顯示留給前端 Phase 5 處理

  if (category) query = query.eq("category", category);
  if (source) query = query.eq("source", source);
  if (tag) query = query.contains("tags", [tag]);

  const { data, error, count } = await query
    .order("published_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ articles: data, page, pageSize, total: count ?? 0 });
}
