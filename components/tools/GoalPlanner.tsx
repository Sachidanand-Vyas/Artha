"use client";

import { useMemo, useState } from "react";
import { fmtLakh, NumField, ResultRow, SliderField } from "@/components/tools/shared";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/Progress";

export function GoalPlanner() {
  const [target, setTarget] = useState(2500000);
  const [years, setYears] = useState(8);
  const [rate, setRate] = useState(11);
  const [current, setCurrent] = useState(300000);

  const result = useMemo(() => {
    const i = rate / 100 / 12;
    const n = years * 12;
    const need = target - current * Math.pow(1 + i, n);
    if (need <= 0) {
      return { monthly: 0, invested: 0, shortfall: 0, note: "Your current savings already cover this goal at the assumed return." };
    }
    const monthly = (need * i) / (Math.pow(1 + i, n) - 1);
    const invested = monthly * n;
    const futureValueOfSips = monthly * (((Math.pow(1 + i, n) - 1) / i));
    return { monthly, invested, shortfall: need, futureValueOfSips, note: "" };
  }, [target, years, rate, current]);

  const projection = useMemo(() => {
    const i = rate / 100 / 12;
    const n = years * 12;
    return current * Math.pow(1 + i, n) + result.monthly * (((Math.pow(1 + i, n) - 1) / i) * (1 + i));
  }, [current, rate, years, result.monthly]);

  const progress = Math.min(100, (current / target) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <NumField label="Goal amount" value={target} onChange={setTarget} suffix="₹" step={100000} explain="How much you need at the goal date (today's terms)." />
        <NumField label="Already saved" value={current} onChange={setCurrent} suffix="₹" step={10000} explain="What you have set aside for this goal so far." />
        <SliderField label="Time to goal" value={years} onChange={setYears} min={1} max={30} step={1} suffix=" yrs" />
        <SliderField label="Expected return" value={rate} onChange={setRate} min={4} max={18} step={0.5} suffix="%" />
        <div className="rounded-xl border border-edge bg-surface2/40 p-4">
          <ResultRow label="Monthly saving needed" value={result.monthly > 0 ? `₹${Math.round(result.monthly).toLocaleString("en-IN")}` : "₹0"} tone="gold" explain="The fixed monthly amount required to reach the goal at the assumed return." />
          <ResultRow label="Total you will invest" value={fmtLakh(result.invested)} />
          <ResultRow label="Projected corpus" value={fmtLakh(projection)} tone="pos" />
        </div>
        {result.note && (
          <p className="rounded-xl border border-pos/25 bg-possoft/40 p-3 text-xs leading-relaxed text-pos">
            {result.note}
          </p>
        )}
      </Card>

      <Card className="flex flex-col items-center justify-center p-5 text-center">
        <ProgressRing value={progress} label={`${Math.round(progress)}%`} sublabel="saved" tone="gold" size={130} stroke={9} />
        <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-secondary">
          {result.monthly > 0 ? (
            <>
              To reach <span className="font-semibold text-ink">{fmtLakh(target)}</span> in {years} years at{" "}
              {rate}%, invest about <span className="font-bold text-gold">₹{Math.round(result.monthly).toLocaleString("en-IN")} every month</span>.
            </>
          ) : (
            "Your current savings cover this goal at the assumed return."
          )}
        </p>
        <p className="mt-3 text-[11px] text-muted">
          Assumes a constant return — real markets fluctuate. This is planning, not a guarantee.
        </p>
      </Card>
    </div>
  );
}
