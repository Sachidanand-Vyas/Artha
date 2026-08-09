"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { newsService } from "@/lib/services/newsService";
import { useAsync } from "@/lib/hooks/useAsync";
import { timeAgo } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryBadge, SentimentBadge } from "@/components/ui/Badge";
import { ErrorState, SkeletonRows } from "@/components/ui/States";

export function NewsStrip() {
  const { data, loading, error, reload } = useAsync(() => newsService.getArticles("All"), []);

  return (
    <Card className="p-5">
      <CardHeader
        title="Latest News"
        subtitle="AI-summarised"
        right={
          <Link href="/news" className="btn-subtle -mr-2 text-xs text-gold">
            All news <ArrowRight size={13} />
          </Link>
        }
      />
      {error ? (
        <div className="mt-4">
          <ErrorState onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="mt-4">
          <SkeletonRows rows={4} />
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {(data ?? []).slice(0, 4).map((a) => (
            <Link
              key={a.id}
              href="/news"
              className="block rounded-xl border border-edge/60 bg-surface2/30 p-3 transition-all hover:border-edgestrong hover:bg-surface2/70"
            >
              <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{a.headline}</p>
              <div className="mt-2 flex items-center gap-2">
                <CategoryBadge category={a.category} />
                <SentimentBadge sentiment={a.sentiment} />
                <span className="ml-auto text-[10.5px] text-muted">{timeAgo(a.publishedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
