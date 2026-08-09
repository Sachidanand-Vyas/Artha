"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Star } from "lucide-react";
import type { Stock, TimeRange } from "@/lib/types";
import { stockService } from "@/lib/services/stockService";
import { useAsync } from "@/lib/hooks/useAsync";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn, currencyOf, istMarketOpen, pct, signed } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { RiskBadge, StatusPill } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState, ErrorState, SkeletonCard, SkeletonRows } from "@/components/ui/States";
import { StockPriceChart } from "@/components/research/StockPriceChart";
import { FundamentalGrid } from "@/components/research/FundamentalGrid";
import { TechnicalsPanel } from "@/components/research/TechnicalsPanel";
import { AskArthaPanel } from "@/components/research/AskArthaPanel";

const RANGES: TimeRange[] = ["1D", "1W", "1M", "6M", "1Y", "5Y"];

export default function ResearchPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params?.symbol ?? "RELIANCE").toUpperCase();
  const [range, setRange] = useState<TimeRange>("1M");

  const { data: stock, loading: loadingStock } = useAsync(
    () => stockService.getStock(symbol),
    [symbol],
  );
  const { data: candles, loading: loadingCandles, error: errCandles, reload: reloadCandles } = useAsync(
    () => stockService.getCandles(symbol, range),
    [symbol, range],
  );
  const { data: tech, loading: loadingTech, error: errTech, reload: reloadTech } = useAsync(
    () => stockService.getTechnicals(symbol),
    [symbol],
  );

  const watched = useAppStore((s) => s.watchlist.includes(symbol));
  const toggle = useAppStore((s) => s.toggleWatchlist);

  const loadPeers = useCallback(async (): Promise<Stock[]> => {
    if (!stock) return [];
    const all = await stockService.getStocks();
    return all.filter((s) => s.symbol !== symbol && s.sector === stock.sector);
  }, [stock, symbol]);
  const { data: peerList } = useAsync(loadPeers, [loadPeers]);

  if (loadingStock) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-[420px]" />
        <SkeletonCard className="h-40" />
      </div>
    );
  }

  if (!stock) {
    return (
      <EmptyState
        title={`No data for "${symbol}"`}
        message="This symbol is not in the sample universe. Try a known one like RELIANCE, TCS or NVDA."
        action={
          <Link href="/research/RELIANCE" className="btn-primary">
            Open sample stock
          </Link>
        }
      />
    );
  }

  const fmt = currencyOf(stock.currency);
  const rangePct = ((stock.price - stock.week52Low) / (stock.week52High - stock.week52Low)) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{stock.name}</h1>
            <span className="rounded-md border border-edge bg-surface2/70 px-2 py-0.5 font-mono text-xs font-semibold text-secondary">
              {stock.symbol} · {stock.exchange}
            </span>
            <RiskBadge risk={stock.risk} />
          </div>
          <p className="mt-1 text-[13px] text-secondary">{stock.summary}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-bold tracking-tight text-ink tnum">{fmt(stock.price)}</p>
            <p className="mt-0.5 text-sm tnum">
              <span className={stock.change >= 0 ? "text-pos" : "text-neg"}>
                {signed(stock.change, 2)} ({pct(stock.changePct)})
              </span>
              <span className="ml-2 text-muted">today</span>
            </p>
          </div>
          <button
            onClick={() => toggle(symbol)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border transition-all",
              watched
                ? "border-gold/40 bg-goldsoft text-gold"
                : "border-edge bg-surface2/60 text-muted hover:border-edgestrong hover:text-ink",
            )}
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star size={18} fill={watched ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 xl:col-span-2">
          {/* Price chart */}
          <Card className="p-5">
            <CardHeader
              title={`Price — ${range}`}
              subtitle="Candlestick chart, sample data"
              right={
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
                    <span className="h-2 w-2 rounded-sm bg-pos" /> Up
                    <span className="ml-1 h-2 w-2 rounded-sm bg-neg" /> Down
                  </span>
                  <StatusPill>{istMarketOpen() ? "Market open" : "Market closed"}</StatusPill>
                </div>
              }
            />
            <div className="mt-4 flex justify-end">
              <Tabs
                items={RANGES.map((r) => ({ id: r, label: r }))}
                value={range}
                onChange={setRange}
                size="sm"
              />
            </div>
            <div className="mt-4">
              {errCandles ? (
                <ErrorState onRetry={reloadCandles} />
              ) : loadingCandles || !candles ? (
                <SkeletonCard className="h-[360px] !rounded-xl" />
              ) : (
                <StockPriceChart candles={candles} range={range} showMAs={range !== "1D"} height={360} />
              )}
            </div>
            {!loadingCandles && candles && (
              <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
                <span>
                  Open <span className="tnum text-secondary">{fmt(candles[0].open)}</span>
                </span>
                <span>
                  High <span className="tnum text-pos">{fmt(Math.max(...candles.map((c) => c.high)))}</span>
                </span>
                <span>
                  Low <span className="tnum text-neg">{fmt(Math.min(...candles.map((c) => c.low)))}</span>
                </span>
                <span className="ml-auto">
                  Illustrative — not live market data
                </span>
              </div>
            )}
          </Card>

          {/* Fundamentals */}
          <Card className="p-5">
            <CardHeader
              title="Fundamental Analysis"
              subtitle="Hover any metric to learn what it means"
            />
            <div className="mt-4">
              <FundamentalGrid stock={stock} />
            </div>
          </Card>

          {/* Technicals */}
          <Card className="p-5">
            <CardHeader
              title="Technical Analysis"
              subtitle="Computed from the sample series — momentum gauges, not signals"
              right={<StatusPill tone="info">Illustrative</StatusPill>}
            />
            <div className="mt-4">
              {errTech ? (
                <ErrorState onRetry={reloadTech} />
              ) : loadingTech || !tech ? (
                <SkeletonRows rows={4} />
              ) : (
                <TechnicalsPanel t={tech} />
              )}
            </div>
          </Card>

          {/* Peers */}
          <Card className="p-5">
            <CardHeader title="Sector Peers" subtitle={`Other sample stocks in ${stock.sector}`} />
            <div className="mt-3 flex flex-wrap gap-2">
              {(peerList ?? []).map((p) => (
                <Link
                  key={p.symbol}
                  href={`/research/${p.symbol}`}
                  className="chip card-hover !rounded-lg !px-3 !py-2 transition-colors hover:text-ink"
                >
                  <span className="font-mono text-xs font-semibold text-ink">{p.symbol}</span>
                  <span className="tnum text-secondary">{fmt(p.price)}</span>
                  <span className={p.changePct >= 0 ? "tnum text-pos" : "tnum text-neg"}>
                    {pct(p.changePct)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <AskArthaPanel key={stock.symbol} stock={stock} />

          <Card className="p-5">
            <CardHeader title="Key Statistics" />
            <div className="mt-3 space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">Market cap</span>
                <span className="font-semibold tnum text-ink">
                  {stock.currency === "INR"
                    ? `₹${(stock.marketCap / 1e7).toFixed(0)} Cr`
                    : `$${(stock.marketCap / 1e9).toFixed(1)}B`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Beta</span>
                <span className="font-semibold tnum text-ink">{stock.beta.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Sector</span>
                <span className="font-semibold text-ink">{stock.sector}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Risk label</span>
                <RiskBadge risk={stock.risk} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted">52-week range</span>
                  <span className="tnum text-secondary">
                    {fmt(stock.week52Low)} – {fmt(stock.week52High)}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-surface3">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold/60 to-gold" style={{ width: `${rangePct}%` }} />
                  <div
                    className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-ink"
                    style={{ left: `calc(${rangePct}% - 2px)` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
