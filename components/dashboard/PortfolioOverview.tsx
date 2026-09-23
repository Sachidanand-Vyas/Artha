"use client";

/**
 * Dashboard portfolio overview — the logged-in user's REAL numbers.
 *
 * - No portfolio yet -> setup prompt (never fabricated values).
 * - With a portfolio -> value / invested / today's change / cash, all computed
 *   by the backend from live market prices.
 * - The chart plots the cost-basis curve derived from the user's own
 *   transactions. Artha does not store past portfolio valuations, so no
 *   invented performance line is ever drawn.
 */

import Link from "next/link";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { History, Wallet } from "lucide-react";
import { portfolioService, PortfolioNotSetupError } from "@/lib/services/portfolioService";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, inr, inrCompact } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import { TrendBadge } from "@/components/ui/Badge";

interface TipItem {
  name?: string | number;
  value?: unknown;
  stroke?: string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const labelTime = typeof label === "number" ? label : Number(label);
  const labelText = Number.isFinite(labelTime) && labelTime > 0
    ? new Date(labelTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : String(label);
  return (
    <div className="rounded-xl border border-edgestrong bg-surface3 px-3 py-2 text-xs shadow-xl shadow-black/50">
      <p className="mb-1 font-medium text-muted">{labelText}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 tnum">
          <span className="h-2 w-2 rounded-full" style={{ background: p.stroke || p.color }} />
          <span className="text-secondary">{String(p.name)}:</span>
          <span className="font-semibold text-ink">{inrCompact(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

type OverviewData =
  | { kind: "no-portfolio" }
  | {
      kind: "ready";
      summary: NonNullable<Awaited<ReturnType<typeof portfolioService.getSummary>>>;
      history: Awaited<ReturnType<typeof portfolioService.getCostBasisHistory>>;
    };

async function loadOverview(): Promise<OverviewData> {
  try {
    const [summary, history] = await Promise.all([
      portfolioService.getSummary(),
      portfolioService.getCostBasisHistory(),
    ]);
    return { kind: "ready", summary, history };
  } catch (e) {
    if (e instanceof PortfolioNotSetupError) return { kind: "no-portfolio" };
    throw e;
  }
}

function SetupPrompt() {
  return (
    <Card className="p-5">
      <CardHeader
        title="Your portfolio isn't set up yet."
        subtitle="Track your investments or practise with virtual money — real market prices, no real money."
      />
      <EmptyState
        title="Start in one click"
        message="Open a virtual portfolio with ₹1,00,000 of paper cash, or enter the holdings you already own. Both are valued at real, latest-available market prices."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/portfolio?setup=virtual" className="btn-primary">
              <Wallet size={15} /> Start Virtual Portfolio
            </Link>
            <Link href="/portfolio?setup=manual" className="btn-ghost">
              Add Existing Holdings
            </Link>
          </div>
        }
      />
    </Card>
  );
}

export function PortfolioOverview() {
  const { data, loading, error, reload } = useAsync(loadOverview, []);

  const chartData = useMemo(() => {
    if (data?.kind !== "ready" || !data.history) return [];
    return data.history.map((p) => ({ time: p.time, "Invested (cost basis)": p.value }));
  }, [data]);

  const fmtTick = (t: number) =>
    new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

  if (error) {
    return (
      <Card className="p-5">
        <ErrorState onRetry={reload} />
      </Card>
    );
  }

  if (loading || !data) {
    return (
      <Card className="p-5">
        <SkeletonRows rows={4} />
      </Card>
    );
  }

  if (data.kind === "no-portfolio") return <SetupPrompt />;

  const d = data.summary;
  const stats = [
    { label: "Total Portfolio Value", value: inr(d.totalValue), explain: "Current market value of your holdings at latest available prices, plus available cash." },
    { label: "Invested Amount", value: inr(d.invested), explain: "Total cost basis of the shares you hold (quantity × average buy price)." },
    { label: "Today's Change", value: `${d.todayChange >= 0 ? "+" : ""}${inr(Math.abs(d.todayChange))}`, tone: d.todayChange >= 0 ? "text-pos" : "text-neg", explain: "Change in your holdings' value since the previous market close (cash does not move)." },
    { label: "Available Cash", value: inr(d.availableCash), explain: "Uninvested virtual cash ready to deploy or keep as a buffer." },
  ];

  return (
    <Card className="p-5">
      <CardHeader
        title="Portfolio Overview"
        subtitle="Your actual portfolio · valued at latest available market prices"
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] text-muted">Overall return</p>
              <p
                className={cn(
                  "text-sm font-bold tnum",
                  d.overallReturnPct >= 0 ? "text-pos" : "text-neg",
                )}
              >
                {d.overallReturnPct >= 0 ? "+" : ""}
                {d.overallReturnPct.toFixed(1)}%
              </p>
            </div>
            <TrendBadge value={d.todayChange} pct={d.todayChangePct} />
          </div>
        }
      />

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-surface2/40 px-4 py-3">
            <p className="text-[11px] font-medium text-muted">{s.label}</p>
            <p className={cn("mt-1 text-lg font-bold tnum", s.tone ?? "text-ink")}>{s.value}</p>
          </div>
        ))}
      </div>

      {chartData.length >= 2 ? (
        <div className="mt-5 h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pf-gold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a94f" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#d4a94f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,168,196,0.07)" vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v: number) => fmtTick(Number(v))}
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickCount={5}
              />
              <YAxis
                tickFormatter={(v: number) => inrCompact(v)}
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="Invested (cost basis)"
                stroke="#d4a94f"
                strokeWidth={2}
                fill="url(#pf-gold)"
                name="Invested (cost basis)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-edgestrong bg-surface2/30 px-4 py-3.5">
          <History size={15} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-[12.5px] leading-relaxed text-muted">
            Historical performance isn&apos;t available yet — Artha values your holdings live but does not store
            past portfolio valuations, so no past performance line is drawn. The numbers above are real; this
            chart appears once you have a few transactions.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <Wallet size={12} />
        The line above is your invested cost basis, built only from your own transactions — not an estimate of
        past market value. Prices may be delayed, not live.
      </div>
    </Card>
  );
}
