"use client";

/**
 * PORTFOLIO — the logged-in user's actual portfolio.
 *
 * No portfolio yet  -> setup prompt (virtual money / manual import).
 * With a portfolio  -> real summary, holdings, buy/sell ticket, manual import,
 *                      real transactions, and honest states for what Artha
 *                      does not track (goals, historical valuations).
 */

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAsync } from "@/lib/hooks/useAsync";
import {
  portfolioService,
  type OrderSide,
  type PortfolioState,
} from "@/lib/services/portfolioService";
import { stockService } from "@/lib/services/stockService";
import type { HistoryPoint, Holding, PortfolioSummary, Transaction } from "@/lib/types";
import { cn, inr, pct } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { TrendBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from "@/components/ui/States";
import { PerformanceChart } from "@/components/portfolio/PerformanceChart";
import { AssetAllocation } from "@/components/portfolio/AssetAllocation";
import { RiskMetrics } from "@/components/portfolio/RiskMetrics";
import { AIPortfolioAnalysis } from "@/components/portfolio/AIPortfolioAnalysis";
import { TradeTicket } from "@/components/portfolio/TradeTicket";
import { AddHoldingForm, PortfolioSetup } from "@/components/portfolio/PortfolioSetup";

type Flow = "virtual" | "manual" | "add";

const parseFlow = (v: string | null): Flow | null =>
  v === "virtual" || v === "manual" || v === "add" ? v : null;

interface PageData {
  state: PortfolioState;
  summary: PortfolioSummary | null;
  holdings: Holding[];
  transactions: Transaction[];
  history: HistoryPoint[] | null;
}

async function loadPortfolioData(): Promise<PageData> {
  const state = await portfolioService.getState();
  if (!state.exists) {
    return { state, summary: null, holdings: [], transactions: [], history: null };
  }
  const [summary, holdings, transactions, history] = await Promise.all([
    portfolioService.getSummary(),
    portfolioService.getHoldings(),
    portfolioService.getTransactions(),
    portfolioService.getCostBasisHistory(),
  ]);
  return { state, summary, holdings, transactions, history };
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Portfolio" subtitle="Everything you hold, how it is performing, and what the numbers mean." />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
      <div className="card p-5">
        <SkeletonRows rows={6} />
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PortfolioPageInner />
    </Suspense>
  );
}

/** Deep links from the dashboard: ?setup=virtual | manual | add */
function PortfolioPageInner() {
  const { data, loading, error, reload } = useAsync(loadPortfolioData, []);
  const { data: stocks, loading: loadingStocks } = useAsync(() => stockService.getStocks(), []);

  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<Flow | null>(() => parseFlow(searchParams.get("setup")));
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeSide, setTradeSide] = useState<OrderSide>("BUY");

  const allStocks = stocks ?? [];
  const holdings = data?.holdings ?? [];
  const owned = Object.fromEntries(holdings.map((h) => [h.symbol, h.qty]));

  // Default the ticket to a holding (sell-friendly) or the first tracked stock.
  const effectiveSymbol =
    tradeSymbol || holdings[0]?.symbol || allStocks[0]?.symbol || "";

  const finished = (nextFlow: Flow | null = null) => {
    setFlow(nextFlow);
    reload();
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Portfolio" subtitle="Everything you hold, how it is performing, and what the numbers mean." />
        <ErrorState message={error.message} onRetry={reload} />
      </div>
    );
  }

  if (loading || !data) {
    return <PageSkeleton />;
  }

  const summary = data.summary;

  /* ----------------------------- No portfolio yet ---------------------------- */
  if (!summary) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Portfolio"
          subtitle="Everything you hold, how it is performing, and what the numbers mean."
        />

        {flow === null && (
          <EmptyState
            title="Your portfolio isn't set up yet."
            message="Track your investments or practise with virtual money — real market prices, no real money."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => setFlow("virtual")} className="btn-primary">
                  Start with Virtual Money
                </button>
                <button onClick={() => setFlow("manual")} className="btn-ghost">
                  Add Existing Holdings
                </button>
              </div>
            }
          />
        )}

        {flow && flow !== "add" && (
          <div>
            <button onClick={() => setFlow(null)} className="btn-subtle mb-3 text-xs">
              ← Back
            </button>
            <PortfolioSetup onDone={() => finished(flow === "manual" ? "add" : null)} />
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------- Ready ---------------------------------- */
  const s = summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle="Everything you hold, how it is performing, and what the numbers mean."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFlow(flow === "add" ? null : "add")}
              className="btn-ghost !py-1.5 !px-3 text-xs"
            >
              + Add holding
            </button>
            <TrendBadge value={s.todayChange} pct={s.todayChangePct} />
          </div>
        }
      />

      {flow === "add" && (
        <div>
          <button onClick={() => setFlow(null)} className="btn-subtle mb-1 text-xs">
            ← Close
          </button>
          <AddHoldingForm stocks={allStocks} onDone={() => finished(null)} onCancel={() => setFlow(null)} />
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total Value", value: inr(s.totalValue), explain: "Current market value of your holdings at latest available prices, plus available cash." },
          { label: "Invested", value: inr(s.invested), explain: "Total cost basis of the shares you hold (quantity × average buy price)." },
          {
            label: "Overall Return",
            value: `${s.overallReturnPct >= 0 ? "+" : ""}${s.overallReturnPct.toFixed(1)}%`,
            tone: s.overallReturnPct >= 0 ? "text-pos" : "text-neg",
            explain: "Unrealised gain or loss versus total invested, in percentage terms.",
          },
          { label: "Available Cash", value: inr(s.availableCash), explain: "Virtual cash available for deployment or as a buffer." },
        ].map((stat) => (
          <div key={stat.label} className="card p-4" title={stat.explain}>
            <p className="text-[11px] font-medium text-muted">{stat.label}</p>
            <p className={cn("mt-1 text-lg font-bold tnum", stat.tone ?? "text-ink")}>{stat.value}</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{stat.explain}</p>
          </div>
        ))}
      </div>

      {!s.allPriced && (
        <p className="rounded-xl border border-gold/30 bg-goldsoft/50 px-4 py-2.5 text-[12.5px] text-secondary">
          Some holdings could not be priced from the data provider right now — they show as N/A instead of
          estimated values.
        </p>
      )}

      {/* Trade + holdings */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          {loadingStocks || !stocks ? (
            <div className="card p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : (
            <TradeTicket
              stocks={allStocks}
              cash={s.availableCash}
              owned={owned}
              symbol={effectiveSymbol}
              side={tradeSide}
              onSymbolChange={setTradeSymbol}
              onSideChange={setTradeSide}
              onDone={() => reload()}
            />
          )}
        </div>

        <Card className="p-5 xl:col-span-2">
          <CardHeader
            title="Holdings"
            subtitle="Priced at latest available market prices · click a holding to open its research page"
            right={<span className="chip">{holdings.length} positions</span>}
          />
          {holdings.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No holdings yet"
                message={
                  data.state.mode === "virtual"
                    ? "Use the trade panel to buy your first stock with virtual cash, or import holdings you already own."
                    : "Add the holdings you already own — quantity and average buy price."
                }
                action={
                  <button onClick={() => setFlow("add")} className="btn-ghost !py-1.5 text-xs">
                    Add a holding
                  </button>
                }
              />
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-edge text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-2 py-2.5">Asset</th>
                    <th className="px-2 py-2.5 text-right">Qty</th>
                    <th className="px-2 py-2.5 text-right">Avg Cost</th>
                    <th className="px-2 py-2.5 text-right">LTP</th>
                    <th className="px-2 py-2.5 text-right">Value</th>
                    <th className="px-2 py-2.5 text-right">Return</th>
                    <th className="px-2 py-2.5 text-right">Weight</th>
                    <th className="px-2 py-2.5 text-right">Trade</th>
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
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => {
                            setTradeSymbol(h.symbol);
                            setTradeSide("SELL");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="btn-ghost !px-2 !py-1 text-[11px]"
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Performance (real cost basis) + AI analysis */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PerformanceChart history={data.history} />
        </div>
        <AIPortfolioAnalysis />
      </div>

      {/* Allocation + risk */}
      <div className="grid gap-6 xl:grid-cols-3">
        <AssetAllocation />
        <div className="xl:col-span-2">
          <RiskMetrics holdings={holdings} summary={s} />
        </div>
      </div>

      {/* Transactions + goals */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Recent Transactions"
            subtitle="Your real activity log — virtual trades and manual imports (no broker integration)"
          />
          {data.transactions.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-edgestrong px-4 py-6 text-center text-xs text-muted">
              No transactions yet — your trades and imports will appear here.
            </p>
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
                  {data.transactions.map((t) => (
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
          <div className="mt-4">
            <EmptyState
              title="No goals yet"
              message="Goal tracking isn't set up, so nothing is shown here rather than sample goals you never entered."
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
