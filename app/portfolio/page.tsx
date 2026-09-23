"use client";

import Link from "next/link";
import { useAsync } from "@/lib/hooks/useAsync";
import { portfolioService } from "@/lib/services/portfolioService";
import { cn, inr, inrCompact, pct } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { TrendBadge } from "@/components/ui/Badge";
import { PageHeader, SkeletonRows } from "@/components/ui/States";
import { ProgressBar } from "@/components/ui/Progress";
import { PerformanceChart } from "@/components/portfolio/PerformanceChart";
import { AssetAllocation } from "@/components/portfolio/AssetAllocation";
import { RiskMetrics } from "@/components/portfolio/RiskMetrics";
import { AIPortfolioAnalysis } from "@/components/portfolio/AIPortfolioAnalysis";

export default function PortfolioPage() {
  const { data: summary, loading: loadingSummary } = useAsync(() => portfolioService.getSummary(), []);
  const { data: holdings, loading: loadingHoldings } = useAsync(() => portfolioService.getHoldings(), []);
  const { data: transactions, loading: loadingTx } = useAsync(() => portfolioService.getTransactions(), []);
  const { data: goals, loading: loadingGoals } = useAsync(() => portfolioService.getGoals(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle="Everything you hold, how it is performing, and what the numbers mean."
        right={summary ? <TrendBadge value={summary.todayChange} pct={summary.todayChangePct} /> : undefined}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {loadingSummary || !summary
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse" />)
          : [
              { label: "Total Value", value: inr(summary.totalValue), explain: "Current market value of your holdings at latest available prices, plus available cash." },
              { label: "Invested", value: inr(summary.invested), explain: "Total cost basis of the shares you hold (quantity × average buy price)." },
              { label: "Overall Return", value: `${summary.overallReturnPct >= 0 ? "+" : ""}${summary.overallReturnPct.toFixed(1)}%`, tone: summary.overallReturnPct >= 0 ? "text-pos" : "text-neg", explain: "Unrealised gain or loss versus total invested, in percentage terms." },
              { label: "Available Cash", value: inr(summary.availableCash), explain: "Cash available for deployment or as a buffer." },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <p className="text-[11px] font-medium text-muted">{s.label}</p>
                <p className={cn("mt-1 text-lg font-bold tnum", s.tone ?? "text-ink")}>{s.value}</p>
              </div>
            ))}
      </div>

      {/* AI analysis + performance */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PerformanceChart />
        </div>
        <AIPortfolioAnalysis />
      </div>

      {/* Allocation + holdings */}
      <div className="grid gap-6 xl:grid-cols-3">
        <AssetAllocation />
        <Card className="p-5 xl:col-span-2">
          <CardHeader
            title="Holdings"
            subtitle="Priced at latest available market prices · click a holding to open its research page"
            right={
              <span className="chip">{holdings?.length ?? "—"} positions</span>
            }
          />
          {loadingHoldings || !holdings ? (
            <div className="mt-4">
              <SkeletonRows rows={6} />
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-edge text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-2 py-2.5">Asset</th>
                    <th className="px-2 py-2.5 text-right">Qty</th>
                    <th className="px-2 py-2.5 text-right">Avg Cost</th>
                    <th className="px-2 py-2.5 text-right">LTP</th>
                    <th className="px-2 py-2.5 text-right">Value</th>
                    <th className="px-2 py-2.5 text-right">Return</th>
                    <th className="px-2 py-2.5 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/60">
                  {holdings.map((h) => (
                    <tr key={h.symbol} className="transition-colors hover:bg-surface2/50">
                      <td className="px-2 py-3">
                        <Link href={`/research/${h.symbol}`} className="block">
                          <p className="font-semibold text-ink">{h.symbol}</p>
                          <p className="text-[11px] text-muted">{h.name}</p>
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-right tnum text-secondary">{h.qty}</td>
                      <td className="px-2 py-3 text-right tnum text-secondary">{inr(h.avgCost)}</td>
                      <td className="px-2 py-3 text-right font-semibold tnum text-ink">
                        {h.ltp != null ? inr(h.ltp) : "N/A"}
                      </td>
                      <td className="px-2 py-3 text-right font-semibold tnum text-ink">
                        {h.value != null ? inr(h.value) : "N/A"}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-3 text-right font-semibold tnum",
                          h.returnPct == null ? "text-muted" : h.returnPct >= 0 ? "text-pos" : "text-neg",
                        )}
                      >
                        {h.returnPct != null ? pct(h.returnPct) : "N/A"}
                      </td>
                      <td className="px-2 py-3 text-right tnum text-secondary">{h.weightPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Risk metrics */}
      <RiskMetrics />

      {/* Transactions + goals */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Recent Transactions" subtitle="Demo activity log (no broker integration at this stage)" />
          {loadingTx || !transactions ? (
            <div className="mt-4">
              <SkeletonRows rows={5} />
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-edge text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-2 py-2.5">Date</th>
                    <th className="px-2 py-2.5">Symbol</th>
                    <th className="px-2 py-2.5 text-right">Type</th>
                    <th className="px-2 py-2.5 text-right">Qty</th>
                    <th className="px-2 py-2.5 text-right">Price</th>
                    <th className="px-2 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/60">
                  {transactions.map((t) => (
                    <tr key={t.id} className="text-[13px]">
                      <td className="px-2 py-2.5 tnum text-muted">{t.date}</td>
                      <td className="px-2 py-2.5">
                        <span className="font-semibold text-ink">{t.symbol}</span>
                        <span className="ml-1.5 hidden text-[11px] text-muted sm:inline">{t.name}</span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                            t.type === "BUY" ? "bg-possoft text-pos" : "bg-negsoft text-neg",
                          )}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right tnum text-secondary">{t.qty}</td>
                      <td className="px-2 py-2.5 text-right tnum text-secondary">{inr(t.price)}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tnum text-ink">{inr(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <CardHeader title="Financial Goals" subtitle="Progress toward targets" />
          {loadingGoals || !goals ? (
            <div className="mt-4">
              <SkeletonRows rows={4} />
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-ink">{g.title}</span>
                    <span className="text-xs text-muted">
                      {g.deadline} · <span className="tnum text-gold">{g.pct}%</span>
                    </span>
                  </div>
                  <ProgressBar value={g.pct} tone={g.pct >= 60 ? "pos" : "gold"} />
                  <p className="mt-1 text-[11px] tnum text-muted">
                    {inrCompact(g.saved)} saved of {inrCompact(g.target)} ·{" "}
                    {inrCompact(Math.max(0, g.target - g.saved))} to go
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
