"use client";

import { useMemo, useState } from "react";
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
import { randomWalk } from "@/lib/utils";
import { fmtLakh, NumField, ResultRow } from "@/components/tools/shared";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Badge";

function niftySeries(years: number) {
  // Synthetic weekly NIFTY-like path (deterministic) ending near today's value.
  const weeks = years * 52;
  const raw = randomWalk(2026, weeks, 18500, 0.0011, 0.02);
  const last = raw[raw.length - 1];
  const scale = 24862.35 / last;
  return raw.map((v, i) => ({ t: i, v: v * scale }));
}

export function BacktestTool() {
  const [years, setYears] = useState(5);
  const [monthly, setMonthly] = useState(10000);

  const result = useMemo(() => {
    const series = niftySeries(years);
    const n = series.length;
    const invested = monthly * n;
    // SIP: buy monthly at the prevailing level (normalised so unit price = index)
    let units = 0;
    const lumpInvested = invested;
    const lumpUnits = lumpInvested / series[0].v;
    const end = series[n - 1].v;
    // Track running accumulated SIP units so the chart matches the final result
    const chart: { label: string; "SIP value": number; "Lump sum value": number; Invested: number }[] = [];
    for (let i = 0; i < n; i++) {
      units += monthly / series[i].v;
      chart.push({
        label: `${i + 1}w`,
        "SIP value": units * series[i].v,
        "Lump sum value": lumpUnits * series[i].v,
        Invested: monthly * (i + 1),
      });
    }
    const sipValue = units * end;
    const lumpValue = lumpUnits * end;
    const cagr = Math.pow(sipValue / invested, 1 / years) - 1;
    return { sipValue, lumpValue, invested, cagr, chart };
  }, [years, monthly]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">SIP vs Lump Sum</p>
          <StatusPill tone="info">Synthetic series</StatusPill>
        </div>
        <NumField label="Monthly investment" value={monthly} onChange={setMonthly} suffix="₹" step={1000} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary">Look-back period</span>
          <div className="flex gap-1.5">
            {[3, 5, 10].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  years === y ? "bg-surface3 text-ink" : "text-muted hover:text-secondary"
                }`}
              >
                {y}Y
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-edge bg-surface2/40 p-4">
          <ResultRow label="Total invested" value={fmtLakh(result.invested)} />
          <ResultRow label="SIP end value" value={fmtLakh(result.sipValue)} tone="pos" />
          <ResultRow label="Lump sum end value" value={fmtLakh(result.lumpValue)} tone="gold" />
          <ResultRow label="SIP CAGR (approx)" value={`${(result.cagr * 100).toFixed(1)}%`} explain="Annualised growth of the SIP stream — approximate, not an XIRR." />
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          The “NIFTY-like” series is a deterministic synthetic path generated for this demo — it is <strong>not</strong>{" "}
          actual NIFTY history. The exercise demonstrates the mechanics of averaging; conclusions about real markets
          need real data (connect a market-data provider via marketService).
        </p>
      </Card>

      <Card className="p-5">
        <p className="section-label mb-3">Value over time</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.chart} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="bt-sip" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a94f" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#d4a94f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,168,196,0.07)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(result.chart.length / 8))} />
              <YAxis tickFormatter={(v: number) => fmtLakh(v)} tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip
                formatter={(value, name) => [fmtLakh(Number(value)), String(name)]}
                contentStyle={{ background: "#182130", border: "1px solid rgba(150,168,196,0.22)", borderRadius: 12, fontSize: 12, color: "#e8eef6" }}
              />
              <Area type="monotone" dataKey="SIP value" stroke="#d4a94f" strokeWidth={2} fill="url(#bt-sip)" />
              <Line type="monotone" dataKey="Lump sum value" stroke="#5b8def" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              <Line type="monotone" dataKey="Invested" stroke="#5f6d80" strokeWidth={1} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Gold = SIP value · blue = lump sum · grey = total invested
        </p>
      </Card>
    </div>
  );
}
