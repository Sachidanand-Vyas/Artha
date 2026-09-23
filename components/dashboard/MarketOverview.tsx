"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { marketService } from "@/lib/services/marketService";
import { useAsync } from "@/lib/hooks/useAsync";
import { currencyOf } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { ErrorState, SkeletonCard } from "@/components/ui/States";

export function MarketOverview() {
  const { data, loading, error, reload } = useAsync(() => marketService.getIndices(), []);

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
                      idx.change >= 0 ? "text-[11px] font-semibold tnum text-pos" : "text-[11px] font-semibold tnum text-neg"
                    }
                  >
                    {idx.change >= 0 ? "+" : ""}
                    {idx.changePct.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">{idx.exchange}</p>
                <div className="mt-2 flex items-end justify-between gap-1">
                  <span className="text-sm font-bold text-ink tnum">{fmt(idx.value)}</span>
                  <Sparkline data={idx.spark} positive={idx.change >= 0} width={52} height={20} fill={false} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
