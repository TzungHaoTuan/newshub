import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/lib/articles";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const result = await getArticles({
      category: params.get("category"),
      source: params.get("source"),
      tag: params.get("tag"),
      page: Number(params.get("page")) || undefined,
      pageSize: Number(params.get("pageSize")) || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
