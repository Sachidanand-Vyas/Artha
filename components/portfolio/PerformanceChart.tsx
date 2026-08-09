"use client";

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
import { portfolioService } from "@/lib/services/portfolioService";
import { useAsync } from "@/lib/hooks/useAsync";
import { inrCompact } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, SkeletonCard } from "@/components/ui/States";

export function PerformanceChart() {
  const { data, loading, error, reload } = useAsync(() => portfolioService.getSummary(), []);

  const chartData = useMemo(
    () =>
      (data?.valueHistory ?? []).map((p) => ({
        label: new Date(p.time).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        Portfolio: Math.round(p.value),
        Benchmark: Math.round(p.benchmark),
      })),
    [data],
  );

  return (
    <Card className="p-5">
      <CardHeader
        title="Performance"
        subtitle="Portfolio vs benchmark (24 months)"
        right={
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="h-0.5 w-4 rounded bg-gold" /> Portfolio
            </span>
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="h-0.5 w-4 rounded bg-info" /> Benchmark
            </span>
          </div>
        }
      />
      {error ? (
        <div className="mt-4">
          <ErrorState onRetry={reload} />
        </div>
      ) : loading || !chartData.length ? (
        <div className="mt-4">
          <SkeletonCard className="h-[280px] !rounded-xl" />
        </div>
      ) : (
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,168,196,0.07)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
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
                formatter={(value, name) => [inrCompact(Number(value)), String(name)]}
              />
              <Line
                type="monotone"
                dataKey="Portfolio"
                stroke="#d4a94f"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Benchmark"
                stroke="#5b8def"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
