"use client";

/**
 * Dashboard news strip — REAL headlines from GET /api/news (publisher RSS
 * aggregated by the backend). Each item links to the ORIGINAL article; the
 * source and publication time are always visible. Failures render the
 * backend's unavailable message with a Retry — never sample news.
 */

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { newsService } from "@/lib/services/newsService";
import { useAsync } from "@/lib/hooks/useAsync";
import { timeAgo } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryBadge } from "@/components/ui/Badge";
import { ErrorState, SkeletonRows } from "@/components/ui/States";

export function NewsStrip() {
  const { data: feed, loading, error, reload } = useAsync(() => newsService.getFeed("All", 5), []);

  return (
    <Card className="p-5">
      <CardHeader
        title="Latest News"
        subtitle={
          feed
            ? `Live headlines · updated ${timeAgo(feed.updatedAt)}`
            : "Live headlines from trusted sources"
        }
        right={
          <Link href="/news" className="btn-subtle -mr-2 text-xs text-gold">
            All news <ArrowRight size={13} />
          </Link>
        }
      />
      {error ? (
        <div className="mt-4">
          <ErrorState message={error.message} onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="mt-4">
          <SkeletonRows rows={4} />
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {(feed?.articles ?? []).slice(0, 4).map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-edge/60 bg-surface2/30 p-3 transition-all hover:border-edgestrong hover:bg-surface2/70"
            >
              <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{a.title}</p>
              <div className="mt-2 flex items-center gap-2">
                <CategoryBadge category={a.category} />
                <span className="text-[10.5px] text-muted">
                  <span className="font-semibold text-gold">{a.source}</span> · {timeAgo(a.publishedAt)}
                </span>
                <ArrowUpRight size={12} className="ml-auto shrink-0 text-muted" />
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
