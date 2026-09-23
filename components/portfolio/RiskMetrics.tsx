"use client";

/**
 * Portfolio analytics — every metric is derived from the user's actual
 * holdings and the backend's real valuations. Metrics that would require
 * fabricated inputs (Sharpe, VaR, alpha…) are NOT shown: they need historical
 * portfolio valuations Artha does not store, so they would be guesses.
 */

import { useMemo } from "react";
import type { Holding, PortfolioSummary } from "@/lib/types";
import { cn, pct } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/Tooltip";

interface MetricDef {
  label: string;
  value: string | number | null; // null -> N/A
  explain: string;
  tone?: "pos" | "neg";
}

export function RiskMetrics({
  holdings,
  summary,
}: {
  holdings: Holding[];
  summary: PortfolioSummary;
}) {
  const metrics = useMemo<MetricDef[]>(() => {
    const valued = holdings.filter((h) => h.available && h.value != null);
    const equity = valued.reduce((a, h) => a + (h.value ?? 0), 0);

    const top = valued.length
      ? [...valued].sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))[0]
      : null;

    const sectorBuckets = new Map<string, number>();
    for (const h of valued) {
      const key = h.sector || "Other";
      sectorBuckets.set(key, (sectorBuckets.get(key) ?? 0) + (h.value ?? 0));
    }
    const topSector = [...sectorBuckets.entries()].sort((a, b) => b[1] - a[1])[0];
    const topSectorPct = topSector && equity > 0 ? (topSector[1] / equity) * 100 : null;
    const cashPct =
      summary.totalValue > 0 ? (summary.availableCash / summary.totalValue) * 100 : null;

    return [
      {
        label: "Overall return",
        value: pct(summary.overallReturnPct, 1),
        tone: summary.overallReturnPct >= 0 ? "pos" : "neg",
        explain:
          "Unrealised gain or loss of your current holdings versus their cost basis, in percentage terms.",
      },
      {
        label: "Today's change",
        value: pct(summary.todayChangePct, 2),
        tone: summary.todayChangePct >= 0 ? "pos" : "neg",
        explain:
          "Change in your holdings' total value since the previous market close, using each stock's latest daily move.",
      },
      {
        label: "Positions",
        value: holdings.length,
        explain:
          "Number of distinct stocks you hold. More positions usually means less company-specific risk — beyond ~15–20 it adds little.",
      },
      {
        label: "Sectors held",
        value: valued.length ? sectorBuckets.size : null,
        explain:
          "Distinct sectors across your priced holdings. Sector spread removes single-industry shocks that diversification is meant to avoid.",
      },
      {
        label: "Largest position",
        value: top ? `${top.symbol} · ${top.weightPct.toFixed(1)}%` : null,
        explain:
          "Weight of your biggest single stock in priced equity. Above ~15–20% the portfolio behaves like a stock pick.",
      },
      {
        label: "Largest sector",
        value: topSectorPct != null && topSector ? `${topSector[0]} · ${topSectorPct.toFixed(1)}%` : null,
        explain:
          "Share of priced equity in your biggest sector — where a sector-wide fall would hit you hardest.",
      },
      {
        label: "Cash share",
        value: cashPct != null ? `${cashPct.toFixed(1)}%` : null,
        explain:
          "Uninvested virtual cash as a share of total portfolio value — dry powder, or money not yet at work.",
      },
      {
        label: "Unpriced holdings",
        value: holdings.length - valued.length,
        explain:
          "Holdings the data provider could not price right now. They are excluded from valuations and shown as N/A — never estimated.",
      },
    ];
  }, [holdings, summary]);

  return (
    <Card className="p-5">
      <CardHeader
        title="Analytics & Risk"
        subtitle="Derived from your actual holdings — each metric explains what it measures"
      />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-edge bg-surface2/40 p-3.5">
            <InfoTooltip label={<span className="text-[11px] font-medium">{m.label}</span>} text={m.explain} />
            <p
              className={cn(
                "mt-1.5 text-lg font-bold tnum",
                m.value === null ? "text-muted" : m.tone === "neg" ? "text-neg" : m.tone === "pos" ? "text-pos" : "text-ink",
              )}
            >
              {m.value === null ? "N/A" : m.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-edge pt-3 text-[11px] leading-relaxed text-muted">
        Sharpe, VaR, drawdown and similar backtest-style metrics need historical portfolio valuations, which Artha
        does not store — so they are left out instead of estimated. Educational — not financial advice.
      </p>
    </Card>
  );
}
