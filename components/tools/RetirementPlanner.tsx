"use client";

import { useMemo, useState } from "react";
import { fmtLakh, NumField, ResultRow, SliderField } from "@/components/tools/shared";
import { Card } from "@/components/ui/Card";

export function RetirementPlanner() {
  const [age, setAge] = useState(30);
  const [retireAge, setRetireAge] = useState(60);
  const [monthlyExpense, setMonthlyExpense] = useState(60000);
  const [inflation, setInflation] = useState(6);
  const [retReturn, setRetReturn] = useState(9);
  const [currentCorpus, setCurrentCorpus] = useState(500000);

  const result = useMemo(() => {
    const yearsToRetire = Math.max(1, retireAge - age);
    const inflatedMonthly = monthlyExpense * Math.pow(1 + inflation / 100, yearsToRetire);
    // 25x rule → corpus ≈ 300× monthly (25 yrs × 12). Classic rough estimate.
    const corpusNeeded = inflatedMonthly * 300;
    const i = retReturn / 100 / 12;
    const n = yearsToRetire * 12;
    const shortfall = Math.max(0, corpusNeeded - currentCorpus * Math.pow(1 + i, n));
    const monthly = shortfall > 0 ? (shortfall * i) / (Math.pow(1 + i, n) - 1) : 0;
    return { yearsToRetire, inflatedMonthly, corpusNeeded, shortfall, monthly };
  }, [age, retireAge, monthlyExpense, inflation, retReturn, currentCorpus]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <SliderField label="Current age" value={age} onChange={setAge} min={18} max={65} step={1} suffix=" yrs" />
        <SliderField label="Retirement age" value={retireAge} onChange={setRetireAge} min={40} max={70} step={1} suffix=" yrs" />
        <NumField label="Monthly expenses (today)" value={monthlyExpense} onChange={setMonthlyExpense} suffix="₹" step={5000} explain="What you spend per month today — in retirement you'll need the inflated equivalent." />
        <SliderField label="Expected inflation" value={inflation} onChange={setInflation} min={2} max={12} step={0.5} suffix="%" explain="Long-run Indian inflation assumption. Use 6% as a base case." />
        <SliderField label="Return during accumulation" value={retReturn} onChange={setRetReturn} min={4} max={16} step={0.5} suffix="%" />
        <NumField label="Current retirement corpus" value={currentCorpus} onChange={setCurrentCorpus} suffix="₹" step={100000} />
      </Card>

      <Card className="space-y-4 p-5">
        <div className="rounded-xl border border-edge bg-surface2/40 p-4">
          <ResultRow label="Years to retirement" value={result.yearsToRetire} />
          <ResultRow label="Monthly need at retirement" value={`${fmtLakh(result.inflatedMonthly)}/mo`} explain="Your current monthly expense grown by inflation for the years until retirement." />
          <ResultRow label="Estimated corpus needed" value={fmtLakh(result.corpusNeeded)} tone="gold" explain="Roughly 25 years' worth of inflated expenses (300 months) — a common rule of thumb." />
          <ResultRow label="Monthly saving required" value={result.monthly > 0 ? `₹${Math.round(result.monthly).toLocaleString("en-IN")}` : "₹0"} tone="pos" explain="From today until retirement, at the assumed return, to bridge the gap." />
        </div>

        <div className="rounded-xl border border-info/25 bg-infosoft/30 p-4">
          <p className="text-xs font-semibold text-info">How to read this</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">
            Inflation does the heavy lifting — a ₹60,000 monthly lifestyle becomes{" "}
            <span className="font-semibold text-ink">{fmtLakh(result.inflatedMonthly)}</span> per month by the time you retire.
            The corpus estimate uses a simple 25× rule; a full actuarial model (real data, real mortality) would refine it.
          </p>
        </div>

        <div className="rounded-xl border border-edge bg-surface2/40 p-4">
          <p className="text-xs font-semibold text-secondary">Assumptions used</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            Inflation {inflation}% · accumulation return {retReturn}% · corpus = 300 × inflated monthly expense. These
            are editable inputs, not predictions.
          </p>
        </div>
      </Card>
    </div>
  );
}
