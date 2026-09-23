"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { Technicals } from "@/lib/types";
import { InfoTooltip } from "@/components/ui/Tooltip";
import { StatusPill } from "@/components/ui/Badge";

/** 12,34,567 → 1.2Cr / 24,500,000 → 24.5M — one formatter for any currency's volume. */
const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function RsiGauge({ rsi }: { rsi: number }) {
  const zone = rsi >= 70 ? "Overbought" : rsi <= 30 ? "Oversold" : "Neutral";
  const color = rsi >= 70 ? "var(--neg)" : rsi <= 30 ? "var(--pos)" : "var(--gold)";
  return (
    <div className="rounded-xl border border-edge bg-surface2/40 p-4">
      <div className="flex items-center justify-between">
        <InfoTooltip
          label={<span className="text-[11px] font-medium">RSI (14)</span>}
          text="Relative Strength Index — measures the speed and size of recent price moves on a 0–100 scale. Above 70 is often called 'overbought', below 30 'oversold'. It describes momentum; it does not predict direction."
        />
        <span className="chip !py-0.5 text-[10px]" style={{ color }}>
          {zone}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-2xl font-bold tnum text-ink">{rsi.toFixed(1)}</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full">
          <div className="absolute inset-0 bg-gradient-to-r from-pos via-gold to-neg" />
          <div
            className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-ink ring-1 ring-bg"
            style={{ left: `calc(${Math.min(100, Math.max(0, rsi))}% - 2px)` }}
          />
        </div>
      </div>
    </div>
  );
}

export function TechnicalsPanel({ t }: { t: Technicals }) {
  const histData = t.macdHistogram.map((v, i) => ({ i, v }));
  const macdUp = t.macd >= t.macdSignal;

  const cards = [
    {
      label: "Support",
      value: t.support.toFixed(2),
      explain: "A price level where buyers have historically stepped in, slowing or reversing declines. Not a guarantee — just a level worth watching.",
    },
    {
      label: "Resistance",
      value: t.resistance.toFixed(2),
      explain: "A price level where sellers have historically appeared, capping advances. Breakouts above it are closely watched by traders.",
    },
    {
      label: "20-day MA",
      value: t.ma20.toFixed(2),
      explain: "Average closing price over the last 20 sessions. A short-term trend gauge — price above it suggests short-term strength.",
    },
    {
      label: "50-day MA",
      value: t.ma50.toFixed(2),
      explain: "Average closing price over the last 50 sessions. The 20/50 crossover is a commonly watched (but not predictive) trend signal.",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <RsiGauge rsi={t.rsi} />

      <div className="rounded-xl border border-edge bg-surface2/40 p-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <InfoTooltip
            label={<span className="text-[11px] font-medium">MACD (12, 26, 9)</span>}
            text="Moving Average Convergence Divergence — the gap between a fast and a slow moving average, smoothed further by a signal line. When MACD is above its signal, momentum is positive; below, negative. A trend gauge, not a forecast."
          />
          <StatusPill tone={macdUp ? "pos" : "neg"}>
            {macdUp ? "Above signal" : "Below signal"}
          </StatusPill>
        </div>
        <div className="mt-2 h-[110px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="i" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Bar dataKey="v" radius={[1, 1, 0, 0]}>
                {histData.map((d) => (
                  <Cell key={d.i} fill={d.v >= 0 ? "var(--pos)" : "var(--neg)"} fillOpacity={0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-edge bg-surface2/40 px-4 py-3">
          <InfoTooltip label={<span className="text-[11px] font-medium">{c.label}</span>} text={c.explain} />
          <p className="mt-1 text-base font-bold tnum text-ink">{c.value}</p>
        </div>
      ))}

      <div className="flex items-center gap-3 rounded-xl border border-edge bg-surface2/40 px-4 py-3 lg:col-span-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", t.sma20Above50 ? "bg-pos" : "bg-neg")} />
        <InfoTooltip
          label={<span className="text-xs font-medium">20-day vs 50-day MA</span>}
          text={t.sma20Above50 ? "Short-term average is above the longer-term average — this price series is in a short-term uptrend." : "Short-term average is below the longer-term average — this price series is in a short-term downtrend."}
        />
        <span className="ml-auto text-xs tnum text-secondary">
          {t.sma20Above50 ? "Bullish alignment" : "Bearish alignment"} · avg volume{" "}
          {compact.format(t.volumeAvg)}
        </span>
      </div>
    </div>
  );
}
