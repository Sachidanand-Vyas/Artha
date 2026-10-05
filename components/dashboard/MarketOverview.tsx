"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { marketService } from "@/lib/services/marketService";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatClock, usePoll } from "@/lib/hooks/usePoll";
import { stockService } from "@/lib/services/stockService";
import { currencyOf } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { ErrorState, SkeletonCard } from "@/components/ui/States";

export function MarketOverview() {
  const { data, loading, error, reload } = useAsync(() => marketService.getIndices(), []);

  // Index value/refresh every 45s while visible — light quotes only.
  const symbols = (data ?? []).map((i) => i.symbol);
  const symbolsKey = symbols.join(",");
  const { data: quotes, lastUpdated, stale } = usePoll(
    () => stockService.getQuotes(symbols),
    [symbolsKey],
  );
  const quoteBySymbol = useMemo(
    () => new Map((quotes ?? []).map((q) => [q.symbol, q] as const)),
    [quotes],
  );

  return (
    <Card className="p-5">
      <CardHeader
        title="Market Overview"
        subtitle="Major indices — latest available prices"
        right={
          <Link href="/markets" className="btn-subtle -mr-2 text-xs text-gold">
            View all <ArrowRight size={13} />
          </Link>
        }
      />
      {error ? (
        <div className="mt-4">
          <ErrorState onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {data!.map((idx) => {
            const fmt = currencyOf(idx.currency);
            const live = quoteBySymbol.get(idx.symbol);
            const value = live?.price ?? idx.value;
            const change = live?.change ?? idx.change;
            const changePct = live?.changePercent ?? idx.changePct;
            return (
              <Link
                key={idx.symbol}
                href="/markets"
                className="group rounded-xl border border-edge bg-surface2/40 p-3.5 transition-all duration-150 hover:border-edgestrong hover:bg-surface2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">{idx.symbol}</span>
                  <span
                    className={
                      change >= 0 ? "text-[11px] font-semibold tnum text-pos" : "text-[11px] font-semibold tnum text-neg"
                    }
                  >
                    {change >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {idx.exchange}
                  {lastUpdated ? ` · updated ${formatClock(lastUpdated)}` : ""}
                  {stale ? " · stale" : ""}
                </p>
                <div className="mt-2 flex items-end justify-between gap-1">
                  <span className="text-sm font-bold text-ink tnum">{fmt(value)}</span>
                  <Sparkline data={idx.spark} positive={change >= 0} width={52} height={20} fill={false} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
