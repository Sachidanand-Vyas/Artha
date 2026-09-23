"use client";

/**
 * Performance chart — plots the REAL cost-basis curve derived from the user's
 * transactions. Artha does not store past portfolio valuations, so instead of
 * an illustrative line it either shows this measured curve or an honest
 * limited state.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { History } from "lucide-react";
import type { HistoryPoint } from "@/lib/types";
import { inrCompact } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";

export function PerformanceChart({ history }: { history: HistoryPoint[] | null }) {
  const chartData = useMemo(
    () => (history ?? []).map((p) => ({ time: p.time, Invested: p.value })),
    [history],
  );

  const fmtTick = (t: number) =>
    new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

  const hasData = chartData.length >= 2;

  return (
    <Card className="p-5">
      <CardHeader
        title="Invested Capital"
        subtitle="Cost basis built from your own transactions"
        right={
          hasData ? (
            <span className="flex items-center gap-1.5 text-[11px] text-secondary">
              <span className="h-0.5 w-4 rounded bg-gold" /> Invested (cost basis)
            </span>
          ) : undefined
        }
      />
      {hasData ? (
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
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
                width={72}
              />
              <Tooltip
                contentStyle={{
                  background: "#182130",
                  border: "1px solid rgba(150,168,196,0.22)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#e8eef6",
                }}
                labelFormatter={(v) => fmtTick(Number(v))}
                formatter={(value, name) => [inrCompact(Number(value)), String(name)]}
              />
              <Line
                type="monotone"
                dataKey="Invested"
                stroke="#d4a94f"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-edgestrong bg-surface2/30 px-4 py-4">
          <History size={15} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-[12.5px] leading-relaxed text-muted">
            Historical portfolio performance isn&apos;t available yet. Artha values your holdings live but does
            not store past portfolio valuations — rather than draw an invented line, this chart stays empty until
            your own transactions give it real points. Your current value, invested amount and P&amp;L on this page
            are real.
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        This line is net capital deployed (buys − sells) from your transaction log — not a valuation of the past.
      </p>
    </Card>
  );
}
