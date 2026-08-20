import type { Article } from "@/lib/articles";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function ArticleRow({ article }: { article: Article }) {
  return (
    <article className="group border-b border-rule px-4 sm:px-6 py-4 transition-colors hover:bg-paper-raised">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded-sm border border-wire-navy/30 px-1.5 py-0.5 font-mono text-xs text-wire-navy">
          {article.source}
        </span>
        {article.category && <span className="font-body text-xs text-ink-muted">{article.category}</span>}
      </div>
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block">
        <h2 className="font-headline text-lg font-semibold leading-snug text-ink transition-colors group-hover:text-wire-red">
          {article.title}
        </h2>
      </a>
      {article.summary && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{article.summary}</p>}
      <time dateTime={article.published_at} className="mt-2 block font-mono text-xs text-ink-muted/70">
        {formatDateTime(article.published_at)}
      </time>
    </article>
  );
}
