"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, Lock } from "lucide-react";
import { learningService } from "@/lib/services/learningService";
import type { InvestmentScenario } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/States";

export function ScenarioSimulator() {
  const [scenario, setScenario] = useState<InvestmentScenario | null>(null);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    learningService.getScenario().then(setScenario);
  }, []);

  if (!scenario) {
    return (
      <Card className="p-5">
        <SkeletonRows rows={3} />
      </Card>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-edge bg-gradient-to-r from-goldsoft/40 to-transparent px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <FlaskConical size={15} className="text-gold" />
            Interactive Scenario · {scenario.title}
          </p>
          <StatusPill tone="gold">Decision exercise</StatusPill>
        </div>
        <p className="mt-1.5 text-[13px] text-secondary">{scenario.prompt}</p>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-3">
        {scenario.options.map((opt) => {
          const selected = choice === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setChoice(opt.id)}
              disabled={choice !== null && !selected}
              className={cn(
                "rounded-xl border p-4 text-left transition-all duration-200",
                selected
                  ? "border-gold/60 bg-goldsoft/50 shadow-lg shadow-gold/5"
                  : choice !== null
                    ? "cursor-default border-edge bg-surface2/30 opacity-60"
                    : "border-edge bg-surface2/40 hover:border-gold/35 hover:bg-surface2",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gold">
                  Portfolio {opt.id}
                </span>
                {selected && <CheckCircle2 size={16} className="text-gold" />}
              </div>
              <p className="mt-1 text-sm font-semibold text-ink">{opt.name}</p>
              <p className="mt-1 text-[11px] text-muted">{opt.composition}</p>
              <div className="mt-3 space-y-1.5 text-[11.5px]">
                <p className="flex justify-between">
                  <span className="text-muted">Expected return</span>
                  <span className="font-medium text-ink">{opt.expectedReturn}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted">Risk</span>
                  <span
                    className={cn(
                      "font-semibold",
                      opt.risk === "High" ? "text-neg" : opt.risk === "Moderate" ? "text-gold" : "text-pos",
                    )}
                  >
                    {opt.risk}
                  </span>
                </p>
              </div>
              {selected && (
                <div className="mt-3 space-y-2 border-t border-gold/20 pt-3 text-left">
                  <p className="text-[11.5px] leading-relaxed text-secondary">{opt.outcome}</p>
                  <p className="text-[11.5px] leading-relaxed text-muted">{opt.tradeoffs}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="border-t border-edge bg-surface2/40 px-5 py-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-info">
            <Lock size={11} /> The takeaway
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{scenario.lesson}</p>
        </div>
      )}
    </div>
  );
}
