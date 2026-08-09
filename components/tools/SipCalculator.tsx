"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtLakh, NumField, ResultRow, SliderField } from "@/components/tools/shared";
import { Card } from "@/components/ui/Card";

export function SipCalculator() {
  const [monthly, setMonthly] = useState(10000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(15);

  const result = useMemo(() => {
    const i = rate / 100 / 12;
    const n = years * 12;
    const future = monthly * (((Math.pow(1 + i, n) - 1) / i) * (1 + i));
    const invested = monthly * n;
    return { future, invested, gains: future - invested };
  }, [monthly, rate, years]);

  const chart = useMemo(() => {
    const i = rate / 100 / 12;
    const out: { label: string; invested: number; value: number }[] = [];
    for (let y = 1; y <= years; y++) {
      const n = y * 12;
      out.push({
        label: `Yr ${y}`,
        invested: monthly * n,
        value: monthly * (((Math.pow(1 + i, n) - 1) / i) * (1 + i)),
      });
    }
    return out;
  }, [monthly, rate, years]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <NumField label="Monthly investment" value={monthly} onChange={setMonthly} suffix="₹" step={500} explain="The fixed amount you invest every month." />
        <SliderField label="Expected annual return" value={rate} onChange={setRate} min={4} max={20} step={0.5} suffix="%" explain="Illustrative annualised return. Not a promise — markets fluctuate." />
        <SliderField label="Investment period" value={years} onChange={setYears} min={1} max={35} step={1} suffix=" yrs" explain="How long you keep investing." />
        <div className="rounded-xl border border-edge bg-surface2/40 p-4">
          <ResultRow label="Total invested" value={fmtLakh(result.invested)} />
          <ResultRow label="Est. gains" value={fmtLakh(result.gains)} tone="pos" />
          <ResultRow label="Projected corpus" value={fmtLakh(result.future)} tone="gold" />
        </div>
      </Card>

      <Card className="p-5">
        <p className="section-label mb-3">Growth over time</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="sip-g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a94f" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#d4a94f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sip-inv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b8def" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#5b8def" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,168,196,0.07)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => fmtLakh(v)} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip
                formatter={(value, name) => [fmtLakh(Number(value)), String(name)]}
                contentStyle={{ background: "#182130", border: "1px solid rgba(150,168,196,0.22)", borderRadius: 12, fontSize: 12, color: "#e8eef6" }}
              />
              <Area type="monotone" dataKey="invested" stroke="#5b8def" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#sip-inv)" name="Invested" />
              <Area type="monotone" dataKey="value" stroke="#d4a94f" strokeWidth={2} fill="url(#sip-g)" name="Value" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
