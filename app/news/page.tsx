"use client";

import { useMemo, useState } from "react";
import { Newspaper } from "lucide-react";
import type { NewsCategory } from "@/lib/types";
import { newsService } from "@/lib/services/newsService";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, timeAgo } from "@/lib/utils";
import { ErrorState, PageHeader, SkeletonCard } from "@/components/ui/States";
import { CategoryBadge, SentimentBadge, StatusPill } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";

const CATS: (NewsCategory | "All")[] = ["All", "Market", "Company", "Economy", "Global"];

export default function NewsPage() {
  const [cat, setCat] = useState<NewsCategory | "All">("All");
  const { data: articles, loading, error, reload } = useAsync(() => newsService.getArticles(cat), [cat]);
  const { data: sentiment } = useAsync(() => newsService.getSentimentSummary(), []);
  const [expanded, setExpanded] = useState<string | null>(null);

  const featured = useMemo(() => (articles ?? []).find((a) => a.featured), [articles]);
  const rest = useMemo(() => (articles ?? []).filter((a) => a.id !== featured?.id), [articles, featured]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="News"
        subtitle="AI-summarised financial news. Content is sample/mock — connect a news API through newsService for live feeds."
        right={<StatusPill tone="info">Mock content</StatusPill>}
      />

      {/* Sentiment overview */}
      <div className="card flex flex-wrap items-center gap-6 p-4">
        <span className="section-label flex items-center gap-1.5">
          <Newspaper size={12} />
          Sentiment mix
        </span>
        {sentiment ? (
          <div className="flex h-2.5 flex-1 min-w-40 max-w-md overflow-hidden rounded-full">
            <div className="bg-pos" style={{ width: `${sentiment.positive}%` }} title={`Positive ${sentiment.positive}%`} />
            <div className="bg-info" style={{ width: `${sentiment.neutral}%` }} title={`Neutral ${sentiment.neutral}%`} />
            <div className="bg-neg" style={{ width: `${sentiment.negative}%` }} title={`Negative ${sentiment.negative}%`} />
          </div>
        ) : (
          <div className="h-2.5 w-40 animate-pulse rounded-full bg-surface3" />
        )}
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-secondary"><span className="h-2 w-2 rounded-full bg-pos" />Positive {sentiment?.positive ?? "–"}%</span>
          <span className="flex items-center gap-1.5 text-secondary"><span className="h-2 w-2 rounded-full bg-info" />Neutral {sentiment?.neutral ?? "–"}%</span>
          <span className="flex items-center gap-1.5 text-secondary"><span className="h-2 w-2 rounded-full bg-neg" />Negative {sentiment?.negative ?? "–"}%</span>
        </div>
      </div>

      {/* Category tabs */}
      <Tabs
        items={CATS.map((c) => ({ id: c, label: c }))}
        value={cat}
        onChange={(c) => setCat(c)}
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-44" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {featured && (
            <article
              onClick={() => setExpanded((e) => (e === featured.id ? null : featured.id))}
              className="card card-hover cursor-pointer p-5 lg:col-span-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="gold">Featured</StatusPill>
                <CategoryBadge category={featured.category} />
                <SentimentBadge sentiment={featured.sentiment} />
                <span className="ml-auto text-[11px] text-muted">
                  {featured.source} · {timeAgo(featured.publishedAt)}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold leading-snug text-ink">{featured.headline}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-secondary">{featured.aiSummary}</p>
              {expanded === featured.id && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {featured.related.map((r) => (
                    <span key={r} className="chip !text-[10px]">{r}</span>
                  ))}
                </div>
              )}
            </article>
          )}

          {rest.map((a) => (
            <article key={a.id} className="card card-hover p-4">
              <div className="flex items-center gap-2">
                <CategoryBadge category={a.category} />
                <SentimentBadge sentiment={a.sentiment} />
              </div>
              <h3 className="mt-2.5 text-[14.5px] font-bold leading-snug text-ink">{a.headline}</h3>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface2/50 p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gold">AI summary</span>
                <p className="line-clamp-2 flex-1 text-[11.5px] leading-relaxed text-secondary">{a.aiSummary}</p>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                <span>
                  {a.source} · {timeAgo(a.publishedAt)}
                </span>
                {a.related.length > 0 && (
                  <button
                    onClick={() => setExpanded((e) => (e === a.id ? null : a.id))}
                    className={cn("font-medium text-gold", expanded === a.id && "text-goldbright")}
                  >
                    {expanded === a.id ? "Hide tickers" : `Tickers ${a.related.length}`}
                  </button>
                )}
              </div>
              {expanded === a.id && a.related.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-edge pt-2.5">
                  {a.related.map((r) => (
                    <span key={r} className="chip !text-[10px]">{r}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && articles?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-edgestrong p-10 text-center text-sm text-muted">
          No articles in this category yet.
        </p>
      )}
    </div>
  );
}
