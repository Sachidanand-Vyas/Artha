"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Wallet } from "lucide-react";
import { portfolioService } from "@/lib/services/portfolioService";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, inr, inrCompact } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { TrendBadge } from "@/components/ui/Badge";

interface TipItem {
  name?: string | number;
  value?: unknown;
  stroke?: string;
  color?: string;
  dataKey?: string | number;
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
  return (
    <div className="rounded-xl border border-edgestrong bg-surface3 px-3 py-2 text-xs shadow-xl shadow-black/50">
      <p className="mb-1 font-medium text-muted">{String(label)}</p>
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

export function PortfolioOverview() {
  const { data, loading, error, reload } = useAsync(() => portfolioService.getSummary(), []);
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.valueHistory.map((p) => ({
      label: new Date(p.time).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      Portfolio: Math.round(p.value),
      "Benchmark (NIFTY)": Math.round(p.benchmark),
    }));
  }, [data]);

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

  const stats = [
    { label: "Total Portfolio Value", value: inr(data.totalValue), explain: "Current market value of your holdings at latest available prices, plus available cash." },
    { label: "Invested Amount", value: inr(data.invested), explain: "Total cost basis of the shares you hold (quantity × average buy price)." },
    { label: "Today's Change", value: `${data.todayChange >= 0 ? "+" : ""}${inr(Math.abs(data.todayChange))}`, tone: data.todayChange >= 0 ? "text-pos" : "text-neg", explain: "Change in your portfolio value since the previous market close." },
    { label: "Available Cash", value: inr(data.availableCash), explain: "Uninvested cash ready to deploy or keep as a buffer." },
  ];

  return (
    <Card className="p-5">
      <CardHeader
        title="Portfolio Overview"
        subtitle="Current value is real · 24-month shape vs a benchmark is illustrative"
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] text-muted">Overall return</p>
              <p
                className={cn(
                  "text-sm font-bold tnum",
                  data.overallReturnPct >= 0 ? "text-pos" : "text-neg",
                )}
              >
                {data.overallReturnPct >= 0 ? "+" : ""}
                {data.overallReturnPct.toFixed(1)}%
              </p>
            </div>
            <TrendBadge value={data.todayChange} pct={data.todayChangePct} />
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
              dataKey="label"
              tick={{ fill: "var(--text-3)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
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
              dataKey="Portfolio"
              stroke="#d4a94f"
              strokeWidth={2}
              fill="url(#pf-gold)"
              name="Portfolio"
            />
            <Line
              type="monotone"
              dataKey="Benchmark (NIFTY)"
              stroke="#5b8def"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              name="Benchmark (NIFTY)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <Wallet size={12} />
        Holdings valued at latest available market prices via the FastAPI backend. The historical line is
        illustrative — Artha does not store past portfolio values.
      </div>
    </Card>
  );
}
