"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analyticsService } from "@/lib/services/analyticsService";
import { fmtLakh, NumField, ResultRow, SliderField } from "@/components/tools/shared";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Badge";

export function MonteCarloSim() {
  const [initial, setInitial] = useState(500000);
  const [monthly, setMonthly] = useState(15000);
  const [years, setYears] = useState(20);
  const [mean, setMean] = useState(11);
  const [vol, setVol] = useState(14);

  const [result, setResult] = useState<Awaited<ReturnType<typeof analyticsService.runMonteCarlo>> | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResult(null);
    const r = await analyticsService.runMonteCarlo({
      initial,
      monthly,
      years,
      meanReturn: mean / 100,
      volatility: vol / 100,
      iterations: 400,
      seed: Math.floor(Math.random() * 1e6),
    });
    setResult(r);
    setRunning(false);
  };

  const histogram = useMemo(() => {
    if (!result) return [];
    const sims = result.simulations;
    const min = Math.min(...sims);
    const max = Math.max(...sims);
    const buckets = 18;
    const width = (max - min) / buckets || 1;
    const counts = new Array(buckets).fill(0);
    for (const v of sims) {
      const idx = Math.min(buckets - 1, Math.floor((v - min) / width));
      counts[idx]++;
    }
    return counts.map((c, i) => ({
      label: `${fmtLakh(min + width * i)}`,
      count: c,
      median: min + width * i <= result.median && min + width * (i + 1) >= result.median,
    }));
  }, [result]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <NumField label="Starting amount" value={initial} onChange={setInitial} suffix="₹" step={50000} explain="Your current corpus at the start of the simulation." />
          <NumField label="Monthly contribution" value={monthly} onChange={setMonthly} suffix="₹" step={1000} />
          <SliderField label="Time horizon" value={years} onChange={setYears} min={5} max={40} step={1} suffix=" yrs" />
          <SliderField label="Expected annual return" value={mean} onChange={setMean} min={4} max={18} step={0.5} suffix="%" />
          <SliderField label="Annual volatility" value={vol} onChange={setVol} min={5} max={40} step={1} suffix="%" explain="How much yearly returns bounce. Equity ~15–20%, debt ~4–6%." />
          <button onClick={() => void run()} disabled={running} className="btn-primary w-full">
            {running ? "Running 400 simulations…" : "Run simulation"}
          </button>
          <p className="text-[11px] text-muted">
            Uses geometric Brownian motion — the standard model in portfolio math. 400 random paths, real computation,
            sample parameters.
          </p>
        </Card>

        <Card className="p-5">
          {!result ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-4xl">🎲</p>
              <p className="text-sm font-semibold text-ink">Outcome distribution</p>
              <p className="max-w-xs text-xs text-muted">
                Run the simulation to see 400 possible futures as a distribution — the spread between good and bad
                outcomes is the risk.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="section-label">400 outcomes</p>
                <StatusPill tone="info">P10–P90 band</StatusPill>
              </div>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogram} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,168,196,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--text-3)", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value) => [`${value} paths`, "Outcomes"]}
                      labelFormatter={(l) => `~${l}`}
                      contentStyle={{ background: "#182130", border: "1px solid rgba(150,168,196,0.22)", borderRadius: 12, fontSize: 12, color: "#e8eef6" }}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {histogram.map((h, i) => (
                        <Cell key={i} fill={h.median ? "var(--gold)" : "var(--info)"} fillOpacity={h.median ? 0.9 : 0.4} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 rounded-xl border border-edge bg-surface2/40 p-3.5">
                <ResultRow label="Worst 10% (P10)" value={fmtLakh(result.p10)} tone="neg" explain="10% of simulated outcomes end at or below this value." />
                <ResultRow label="Median outcome (P50)" value={fmtLakh(result.median)} tone="gold" explain="Half of the simulated futures end above, half below." />
                <ResultRow label="Best 10% (P90)" value={fmtLakh(result.p90)} tone="pos" explain="90% of outcomes end at or below this value." />
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
