"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import { marketService } from "@/lib/services/marketService";
import { stockService } from "@/lib/services/stockService";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, currencyOf, pct, signed } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusPill } from "@/components/ui/Badge";
import { ErrorState, PageHeader, SkeletonCard, SkeletonRows } from "@/components/ui/States";

export default function MarketsPage() {
  const { data: indices, loading: loadingIdx, error: errIdx, reload: reloadIdx } = useAsync(() => marketService.getIndices(), []);
  const { data: breadth, loading: loadingBreadth, error: errBreadth, reload: reloadBreadth } = useAsync(() => marketService.getBreadth(), []);
  const { data: sectors, loading: loadingSectors, error: errSectors, reload: reloadSectors } = useAsync(() => marketService.getSectorPerformance(), []);
  const { data: stocks, loading: loadingStocks, error: errStocks, reload: reloadStocks } = useAsync(() => stockService.getStocks(), []);

  const movers = useMemo(() => {
    if (!stocks) return { gainers: [], losers: [] };
    const sorted = [...stocks].sort((a, b) => b.changePct - a.changePct);
    return { gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() };
  }, [stocks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Markets"
        subtitle="Indices, breadth and sector moves — latest available data from the market-data provider (may be delayed, not live)."
        right={<StatusPill tone="info">Latest available</StatusPill>}
      />

      {/* Indices */}
      {errIdx ? (
        <ErrorState onRetry={reloadIdx} />
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(indices ?? Array.from({ length: 6 })).map((idx, i) =>
          loadingIdx ? (
            <SkeletonCard key={i} className="h-28" />
          ) : (
            <Card key={idx.symbol} hover className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{idx.symbol}</p>
                  <p className="text-[11px] text-muted">
                    {idx.name} · {idx.exchange}
                  </p>
                </div>
                <Sparkline data={idx.spark} positive={idx.change >= 0} width={72} height={26} />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xl font-bold text-ink tnum">
                  {currencyOf(idx.currency)(idx.value)}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tnum",
                    idx.change >= 0 ? "text-pos" : "text-neg",
                  )}
                >
                  {pct(idx.changePct)}
                  <span className="ml-1 text-[11px] font-medium opacity-80">{signed(idx.change, 0)}</span>
                </span>
              </div>
            </Card>
          ),
        )}
      </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Breadth */}
        <Card className="p-5">
          <CardHeader title="Market Breadth" subtitle="Advancers vs decliners" />
          {errBreadth ? (
            <div className="mt-4">
              <ErrorState onRetry={reloadBreadth} />
            </div>
          ) : loadingBreadth ? (
            <div className="mt-4">
              <SkeletonRows rows={3} />
            </div>
          ) : !breadth!.available || breadth!.advances == null || breadth!.declines == null ? (
            /* Provider cannot supply advance/decline counts -> show N/A, never invented numbers. */
            <div className="mt-4 rounded-xl border border-edge bg-surface2/40 px-4 py-8 text-center">
              <p className="text-lg font-bold text-muted tnum">N/A</p>
              <p className="mx-auto mt-1.5 max-w-[240px] text-[12px] leading-relaxed text-muted">
                {breadth!.note ||
                  "Advance/decline breadth is not available from the current market-data provider."}
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                <div className="bg-pos" style={{ width: `${(breadth!.advances! / (breadth!.advances! + breadth!.declines!)) * 100}%` }} />
                <div className="bg-neg" style={{ width: `${(breadth!.declines! / (breadth!.advances! + breadth!.declines!)) * 100}%` }} />
              </div>
              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-secondary">
                    <span className="h-2 w-2 rounded-full bg-pos" /> Advances
                  </span>
                  <span className="font-semibold tnum text-pos">{breadth!.advances!.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-secondary">
                    <span className="h-2 w-2 rounded-full bg-neg" /> Declines
                  </span>
                  <span className="font-semibold tnum text-neg">{breadth!.declines!.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="h-2 w-2 rounded-full bg-muted" /> Unchanged
                  </span>
                  <span className="font-semibold tnum text-secondary">
                    {breadth!.unchanged != null ? breadth!.unchanged.toLocaleString("en-IN") : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Sector performance */}
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Sector Performance" subtitle="Average daily move of tracked large caps, grouped by sector" />
          {errSectors ? (
            <div className="mt-4">
              <ErrorState onRetry={reloadSectors} />
            </div>
          ) : loadingSectors ? (
            <div className="mt-4">
              <SkeletonRows rows={8} />
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {sectors!.map((s) => {
                const max = Math.max(...sectors!.map((x) => Math.abs(x.changePct)));
                const width = (Math.abs(s.changePct) / max) * 100;
                const up = s.changePct >= 0;
                return (
                  <div key={s.sector} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-medium text-secondary">{s.sector}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface3">
                      <div
                        className={cn("absolute inset-y-0 rounded-full", up ? "left-1/2 bg-pos" : "right-1/2 bg-neg")}
                        style={{ width: `${width / 2}%` }}
                      />
                    </div>
                    <span className={cn("w-16 shrink-0 text-right text-xs font-semibold tnum", up ? "text-pos" : "text-neg")}>
                      {pct(s.changePct)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Movers */}
      <div className="grid gap-6 md:grid-cols-2">
        {(["gainers", "losers"] as const).map((side) => (
          <Card key={side} className="p-5">
            <CardHeader
              title={side === "gainers" ? "Top Gainers" : "Top Losers"}
              subtitle="By % change (latest available)"
              right={<Activity size={15} className={side === "gainers" ? "text-pos" : "text-neg"} />}
            />
            {errStocks ? (
              <div className="mt-4">
                <ErrorState onRetry={reloadStocks} />
              </div>
            ) : loadingStocks ? (
              <div className="mt-4">
                <SkeletonRows rows={5} />
              </div>
            ) : (
              <div className="mt-2 divide-y divide-edge/60">
                {movers[side].map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{s.symbol}</p>
                      <p className="text-[11px] text-muted">{s.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold tnum text-ink">
                        {currencyOf(s.currency)(s.price)}
                      </p>
                      <p className={cn("text-[11px] font-semibold tnum", s.changePct >= 0 ? "text-pos" : "text-neg")}>
                        {pct(s.changePct)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
