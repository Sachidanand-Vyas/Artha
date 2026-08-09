"use client";

import { useMemo, useState } from "react";
import { NumField, ResultRow, SliderField } from "@/components/tools/shared";
import { Card } from "@/components/ui/Card";

/* Illustrative FY slabs (verify current-year rules before relying on these). */
const NEW_SLABS = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
];
const OLD_SLABS = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

function taxFor(income: number, slabs: { upTo: number; rate: number }[], standardDeduction: number) {
  const taxable = Math.max(0, income - standardDeduction);
  let tax = 0;
  let prev = 0;
  for (const s of slabs) {
    const slice = Math.max(0, Math.min(taxable, s.upTo) - prev);
    tax += slice * s.rate;
    prev = s.upTo;
    if (taxable <= s.upTo) break;
  }
  return { tax: tax * 1.04, taxable }; // 4% cess
}

export function TaxCalculator() {
  const [income, setIncome] = useState(1500000);
  const [oldDeductions, setOldDeductions] = useState(150000);

  const { tax: newTax, taxable: newTaxable } = useMemo(() => taxFor(income, NEW_SLABS, 75000), [income]);
  const { tax: oldTax, taxable: oldTaxable } = useMemo(() => taxFor(income, OLD_SLABS, 50000 + oldDeductions), [income, oldDeductions]);

  const better = newTax <= oldTax ? "New regime" : "Old regime";
  const saving = Math.abs(newTax - oldTax);

  const maxW = Math.max(newTax, oldTax);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <NumField label="Annual gross income" value={income} onChange={setIncome} suffix="₹" step={100000} />
        <SliderField
          label="Deductions (old regime)"
          value={oldDeductions}
          onChange={setOldDeductions}
          min={0}
          max={300000}
          step={10000}
          suffix="₹"
          explain="Section 80C + 80D etc. These only help under the old regime."
        />
        <p className="rounded-xl border border-edge bg-surface2/40 p-3 text-[11.5px] leading-relaxed text-muted">
          Standard deductions applied automatically: ₹75,000 (new) and ₹50,000 (old). Slabs shown are illustrative
          for the current financial year — always confirm with the latest budget and official sources.
        </p>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <div className="mb-2 flex h-4 w-full gap-1 overflow-hidden rounded-full">
            <div className="flex items-center justify-center bg-gold text-[9px] font-bold text-[#171207]" style={{ width: `${(newTax / maxW) * 100}%` }}>
              {Math.round((newTax / maxW) * 100)}%
            </div>
            <div className="flex items-center justify-center bg-info text-[9px] font-bold text-white" style={{ width: `${(oldTax / maxW) * 100}%` }}>
              {Math.round((oldTax / maxW) * 100)}%
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gold" /> New regime</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-info" /> Old regime</span>
          </div>
        </div>

        <div className="rounded-xl border border-edge bg-surface2/40 p-4">
          <ResultRow label="New regime tax" value={`₹${Math.round(newTax).toLocaleString("en-IN")}`} explain="Flat structure, standard deduction only, no 80C benefit." />
          <ResultRow label="Old regime tax" value={`₹${Math.round(oldTax).toLocaleString("en-IN")}`} explain="Classic slabs, benefits from your declared deductions." />
          <ResultRow label="Better choice" value={better} tone={better === "New regime" ? "pos" : "gold"} />
          <ResultRow label="Estimated saving" value={`₹${Math.round(saving).toLocaleString("en-IN")}/yr`} tone="pos" />
        </div>

        <p className="text-[11.5px] leading-relaxed text-muted">
          New regime taxable income: ₹{Math.round(newTaxable).toLocaleString("en-IN")} · Old regime taxable income: ₹
          {Math.round(oldTaxable).toLocaleString("en-IN")}. Educational illustration — not tax advice.
        </p>
      </Card>
    </div>
  );
}
