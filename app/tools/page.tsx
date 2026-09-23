"use client";

import { useState } from "react";
import {
  Calculator,
  FlaskConical,
  Landmark,
  LineChart,
  PieChart,
  PiggyBank,
  Scale,
  ShieldAlert,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/Badge";
import { SipCalculator } from "@/components/tools/SipCalculator";
import { CompoundCalculator } from "@/components/tools/CompoundCalculator";
import { GoalPlanner } from "@/components/tools/GoalPlanner";
import { RetirementPlanner } from "@/components/tools/RetirementPlanner";
import { RiskCalculator } from "@/components/tools/RiskCalculator";
import { PortfolioAnalyzer } from "@/components/tools/PortfolioAnalyzer";
import { MonteCarloSim } from "@/components/tools/MonteCarloSim";
import { TaxCalculator } from "@/components/tools/TaxCalculator";
import { BacktestTool } from "@/components/tools/BacktestTool";
import { ToolShell } from "@/components/tools/shared";

interface ToolDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  component: React.ComponentType<{ onBack: () => void }>;
  status?: "core" | "sim" | "beta";
}

const TOOLS: ToolDef[] = [
  {
    id: "sip",
    name: "SIP Calculator",
    description: "Project a monthly investment into a future corpus with compounding.",
    icon: PiggyBank,
    component: ({ onBack }) => (
      <ToolShell
        title="SIP Calculator"
        description="How a fixed monthly amount grows with compounding — invested vs value, year by year."
        onBack={onBack}
        disclaimer="Illustrative math with a constant assumed return. Real markets fluctuate; this is planning, not a forecast."
      >
        <SipCalculator />
      </ToolShell>
    ),
  },
  {
    id: "compound",
    name: "Compound Interest",
    description: "Watch interest earn interest across frequencies and time.",
    icon: LineChart,
    component: ({ onBack }) => (
      <ToolShell
        title="Compound Interest Calculator"
        description="The mathematics of compounding — the single most important equation in personal finance."
        onBack={onBack}
        disclaimer="Rates are illustrative. Compounding accelerates over time, but returns are never guaranteed."
      >
        <CompoundCalculator />
      </ToolShell>
    ),
  },
  {
    id: "goal",
    name: "Goal Planner",
    description: "Work backwards: what monthly saving hits your target on time?",
    icon: Target,
    component: ({ onBack }) => (
      <ToolShell
        title="Goal Planner"
        description="From target amount to the monthly saving required — with the assumed-return caveat made visible."
        onBack={onBack}
        disclaimer="Assumes a constant return over the period. A real planner would use probabilistic scenarios."
      >
        <GoalPlanner />
      </ToolShell>
    ),
  },
  {
    id: "retirement",
    name: "Retirement Planner",
    description: "Corpus needed, inflation-adjusted, and the saving gap to close.",
    icon: Landmark,
    component: ({ onBack }) => (
      <ToolShell
        title="Retirement Planner"
        description="Inflation is the quiet killer of retirement plans — this tool makes it visible and quantifies the monthly saving gap."
        onBack={onBack}
        disclaimer="Uses a simplified 25× rule and constant returns. For planning education, not a pension quote."
      >
        <RetirementPlanner />
      </ToolShell>
    ),
  },
  {
    id: "risk",
    name: "Risk Calculator",
    description: "A 5-question profile that explains the reasoning behind your score.",
    icon: ShieldAlert,
    component: ({ onBack }) => (
      <ToolShell
        title="Risk Profile Calculator"
        description="A short questionnaire with fully transparent scoring — every answer contributes 1–3 points and every result explains itself."
        onBack={onBack}
        disclaimer="A questionnaire estimates temperament and capacity. It is not a psychological evaluation or a forecast."
      >
        <RiskCalculator />
      </ToolShell>
    ),
  },
  {
    id: "analyzer",
    name: "Portfolio Analyzer",
    description: "Concentration and diversification metrics from your holdings.",
    icon: PieChart,
    component: ({ onBack }) => (
      <ToolShell
        title="Portfolio Analyzer"
        description="Real HHI math applied to your actual holdings — how concentrated your portfolio really is."
        onBack={onBack}
        disclaimer="Analyzes your own holdings (virtual or imported) valued at latest available market prices. Set up a portfolio first if you haven't."
      >
        <PortfolioAnalyzer />
      </ToolShell>
    ),
  },
  {
    id: "montecarlo",
    name: "Monte Carlo Simulation",
    description: "400 possible futures — the distribution IS the risk.",
    icon: FlaskConical,
    status: "sim",
    component: ({ onBack }) => (
      <ToolShell
        title="Monte Carlo Simulation"
        description="Runs 400 geometric-Brownian-motion paths through your inputs and shows the spread of outcomes. The spread between P10 and P90 is the risk."
        onBack={onBack}
        disclaimer="Model risk: GBM assumes log-normal returns, which real markets only approximate. Educational tool, not a prediction."
      >
        <MonteCarloSim />
      </ToolShell>
    ),
  },
  {
    id: "tax",
    name: "Tax Calculator",
    description: "New vs old regime comparison with transparent slabs.",
    icon: Scale,
    component: ({ onBack }) => (
      <ToolShell
        title="Income Tax Calculator (India)"
        description="Compare the new and old regimes side by side with fully visible slabs and standard deductions."
        onBack={onBack}
        disclaimer="Slabs shown are illustrative for the current FY and may change in budgets. This is education, not tax advice."
      >
        <TaxCalculator />
      </ToolShell>
    ),
  },
  {
    id: "backtest",
    name: "Backtesting",
    description: "SIP vs lump sum replayed on real NIFTY history.",
    icon: Calculator,
    status: "beta",
    component: ({ onBack }) => (
      <ToolShell
        title="Backtesting Workbench"
        description="Compare SIP averaging against lump-sum investing by replaying real NIFTY 50 weekly closes, strictly forward in time."
        onBack={onBack}
        disclaimer="A historical replay on latest available index data — not a forecast, and no claim of future profitability."
      >
        <BacktestTool />
      </ToolShell>
    ),
  },
];

export default function ToolsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const tool = TOOLS.find((t) => t.id === selected);

  if (tool) {
    const Comp = tool.component;
    return <Comp onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools"
        subtitle="Calculators and simulators with transparent math. Real computation services can replace these through the service layer later."
        right={<StatusPill tone="info">Static math · real data where available</StatusPill>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className="card card-hover group flex flex-col items-start gap-3 p-5 text-left"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/20 bg-goldsoft text-gold transition-transform duration-200 group-hover:scale-105">
                <t.icon size={18} />
              </div>
              {t.status && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    t.status === "sim" ? "bg-violetsoft text-violet" : "bg-infosoft text-info",
                  )}
                >
                  {t.status === "sim" ? "Simulation" : "Beta"}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-ink transition-colors group-hover:text-gold">{t.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-secondary">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
