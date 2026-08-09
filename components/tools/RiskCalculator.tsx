"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

const QUESTIONS = [
  {
    q: "Your investment horizon?",
    options: ["Less than 2 years", "2–5 years", "More than 5 years"],
    explain: "Longer horizons let you ride out volatility, which is what equity risk requires.",
  },
  {
    q: "If your portfolio fell 25% in a year, you would…",
    options: ["Sell to avoid further loss", "Hold and wait", "Buy more at lower prices"],
    explain: "Your behaviour in a drawdown matters more than any forecast — it decides whether paper losses become real ones.",
  },
  {
    q: "Your main investing goal is…",
    options: ["Protecting what I have", "Steady, moderate growth", "Maximising long-term growth"],
    explain: "The goal defines the appropriate risk. Capital protection and aggressive growth need very different portfolios.",
  },
  {
    q: "How would you describe your income stability?",
    options: ["Variable / uncertain", "Stable but fixed", "Stable and growing"],
    explain: "Stable income gives you the ability to wait out bad markets and keep investing through them.",
  },
  {
    q: "If a friend's aggressive portfolio doubled in a year, you would feel…",
    options: ["Worried about the risk", "Interested but cautious", "Motivated to take more risk"],
    explain: "Other people's returns are not your plan. Risk capacity is personal — envy is a poor portfolio manager.",
  },
];

const PROFILES = [
  {
    min: 0,
    max: 6,
    name: "Conservative",
    tone: "text-pos",
    desc: "You prefer stability and short horizons. Prioritise debt, fixed deposits and liquid funds. A small equity allocation (10–25%) can still help beat inflation over time.",
  },
  {
    min: 7,
    max: 10,
    name: "Moderate",
    tone: "text-gold",
    desc: "A balanced mix of equity and debt suits you — roughly 50–60% equity. You accept short-term dips for better long-term growth, but value a cushion.",
  },
  {
    min: 11,
    max: 15,
    name: "Aggressive",
    tone: "text-neg",
    desc: "You have the horizon and temperament for high-equity portfolios. That means accepting 30–40% drawdowns as normal — the reward is historically higher long-term growth.",
  },
];

export function RiskCalculator() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const answered = Object.keys(answers).length;
  const score = Object.values(answers).reduce((a, b) => a + b, 0);
  const profile = PROFILES.find((p) => score >= p.min && score <= p.max)!;

  const done = answered === QUESTIONS.length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-5 p-5">
        {QUESTIONS.map((item, qi) => (
          <div key={qi}>
            <p className="text-[13px] font-semibold text-ink">
              {qi + 1}. {item.q}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers((a) => ({ ...a, [qi]: oi + 1 }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    answers[qi] === oi + 1
                      ? "border-gold/50 bg-goldsoft text-gold"
                      : "border-edge bg-surface2/50 text-secondary hover:border-edgestrong hover:text-ink",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted">
          {answered}/{QUESTIONS.length} answered — scoring is transparent: each answer adds 1–3 points.
        </p>
      </Card>

      <Card className="flex flex-col p-5">
        <p className="section-label">Your risk profile</p>
        {done ? (
          <div className="mt-3 flex flex-1 flex-col justify-center">
            <p className={cn("text-4xl font-extrabold tracking-tight", profile.tone)}>{profile.name}</p>
            <p className="mt-1 text-xs text-muted">Score {score}/15</p>
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full">
              <div className="bg-pos" style={{ width: "40%" }} />
              <div className="bg-gold" style={{ width: "33.3%" }} />
              <div className="bg-neg" style={{ width: "26.7%" }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted">
              <span>Conservative</span>
              <span>Moderate</span>
              <span>Aggressive</span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-secondary">{profile.desc}</p>
            <div className="mt-4 rounded-xl border border-edge bg-surface2/40 p-3.5">
              <p className="text-[11px] font-semibold text-gold">What this means for you</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Your profile describes capacity and temperament, not a forecast. Whatever it says, the honest test is
                how you react when your portfolio actually falls — the Risk Calculator in Learn covers exactly that.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-4xl">🧭</p>
            <p className="text-sm font-semibold text-ink">Answer all {QUESTIONS.length} questions</p>
            <p className="max-w-xs text-xs text-muted">
              Each answer is scored 1–3 and every result comes with an explanation — so you understand why the tool
              classified you the way it did.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
