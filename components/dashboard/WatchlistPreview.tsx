"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Star } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatClock, usePoll } from "@/lib/hooks/usePoll";
import { stockService } from "@/lib/services/stockService";
import { currencyOf } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { RiskBadge, TrendBadge } from "@/components/ui/Badge";
import { ErrorState, SkeletonRows } from "@/components/ui/States";

export function WatchlistPreview() {
  const watchlist = useAppStore((s) => s.watchlist);
  const { data, loading, error, reload } = useAsync(() => stockService.getStocks(), []);

  // Light quote refresh (45s while visible) — only the previewed symbols.
  const watchKey = watchlist.join(",");
  const { data: quotes, lastUpdated, stale } = usePoll(
    () => stockService.getQuotes(watchlist.slice(0, 5)),
    [watchKey],
  );
  const quoteBySymbol = useMemo(() => {
    const map = new Map((quotes ?? []).map((q) => [q.symbol, q] as const));
    return map;
  }, [quotes]);

  const rows = (data ?? [])
    .filter((s) => watchlist.includes(s.symbol))
    .slice(0, 5)
    .map((s) => {
      const q = quoteBySymbol.get(s.symbol);
      if (!q || q.price == null) return s;
      return {
        ...s,
        price: q.price,
        change: q.change ?? s.change,
        changePct: q.changePercent ?? s.changePct,
      };
    });

  return (
    <Card className="p-5">
      <CardHeader
        title="Watchlist"
        subtitle="Tracked assets"
        right={
          <Link href="/watchlist" className="btn-subtle -mr-2 text-xs text-gold">
            Manage <ArrowRight size={13} />
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
        <div className="mt-3 divide-y divide-edge/60">
          {rows.map((s) => {
            const fmt = currencyOf(s.currency);
            return (
              <Link
                key={s.symbol}
                href={`/research/${s.symbol}`}
                className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface2/50"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    {s.symbol}
                    <RiskBadge risk={s.risk} />
                  </p>
                  <p className="truncate text-[11px] text-muted">{s.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold tnum text-ink">{fmt(s.price)}</p>
                  <TrendBadge value={s.change} pct={s.changePct} className="mt-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
        <Star size={11} className="text-gold" />
        <span>
          {watchlist.length} assets tracked
          {lastUpdated ? ` · updated ${formatClock(lastUpdated)}` : ""}
          {stale ? " · refresh failed, last known values" : ""}
        </span>
      </div>
    </Card>
  );
}
