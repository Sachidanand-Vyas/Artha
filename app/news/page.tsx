"use client";

/**
 * NEWS — REAL headlines aggregated by the FastAPI backend from trusted
 * publishers' official RSS feeds (Economic Times, Mint, Business Standard).
 *
 * - Every card shows the source near the headline and links to the ORIGINAL
 *   article on the publisher's site (opens in a new tab).
 * - No sentiment percentages, no AI summaries, no sample articles: if every
 *   provider fails the backend answers 503 and we render an honest
 *   unavailable state with a Retry button.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { NewsCategory } from "@/lib/types";
import { newsService } from "@/lib/services/newsService";
import { useAsync } from "@/lib/hooks/useAsync";
import { timeAgo } from "@/lib/utils";
import { ErrorState, PageHeader, SkeletonCard } from "@/components/ui/States";
import { CategoryBadge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";

const CATS: (NewsCategory | "All")[] = ["All", "Market", "Company", "Economy", "Global"];

export default function NewsPage() {
  const [cat, setCat] = useState<NewsCategory | "All">("All");
  const { data: feed, loading, error, reload } = useAsync(() => newsService.getFeed(cat), [cat]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="News"
        subtitle="Live headlines from trusted financial sources, fetched and deduplicated by the Artha backend. Every card opens the original article on the publisher's site."
        right={feed ? <span className="chip">Updated {timeAgo(feed.updatedAt)}</span> : undefined}
      />

      {/* Category tabs — applied to the REAL fetched articles */}
      <Tabs items={CATS.map((c) => ({ id: c, label: c }))} value={cat} onChange={setCat} />

      {error ? (
        /* 503 => "Live news is temporarily unavailable." (+ last successful
           update). Never a fallback to sample articles. */
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-44" />
          ))}
        </div>
      ) : (feed?.articles.length ?? 0) === 0 ? (
        <p className="rounded-2xl border border-dashed border-edgestrong p-10 text-center text-sm text-muted">
          No articles in this category right now.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {feed!.articles.map((a, i) => (
            <article
              key={a.id}
              className={`card card-hover p-4 ${i === 0 ? "lg:col-span-2" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <CategoryBadge category={a.category} />
                {/* Source is always visible next to the headline */}
                <span className="text-[11px] text-muted">
                  <span className="font-semibold text-gold">{a.source}</span> · {timeAgo(a.publishedAt)}
                </span>
              </div>

              <h3
                className={`mt-2.5 font-bold leading-snug text-ink ${
                  i === 0 ? "text-lg" : "text-[14.5px]"
                }`}
              >
                {a.title}
              </h3>

              {/* Publisher-provided excerpt — shown only when the feed has one */}
              {a.description && (
                <p
                  className={
                    i === 0
                      ? "mt-2 text-sm text-secondary"
                      : "mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-secondary"
                  }
                >
                  {a.description}
                </p>
              )}

              {/* Best-effort tracked-symbol association → real research pages */}
              {a.tickers && a.tickers.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {a.tickers.slice(0, 6).map((t) => (
                    <Link
                      key={t}
                      href={`/research/${t}`}
                      className="chip !text-[10px] transition-colors hover:border-gold/40 hover:text-gold"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-3 border-t border-edge/70 pt-2.5">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-gold transition-colors hover:text-goldbright"
                >
                  Read full article <ArrowUpRight size={13} />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
