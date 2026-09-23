/**
 * PORTFOLIO INSIGHTS — computed ONLY from the user's actual holdings.
 *
 * Nothing here invents conditions: every sentence is derived from measured
 * values (sector weights, position weights, cash share). When there is not
 * enough real data, callers get `null` and show an honest empty state.
 */

import type { AiInsight, Holding, PortfolioSummary, SectorSlice } from "@/lib/types";
import { inr } from "@/lib/utils";

export interface PortfolioFacts {
  summary: PortfolioSummary;
  holdings: Holding[];
  sectors: SectorSlice[];
  /** The user's own risk preference from onboarding (null when unset). */
  riskProfile?: string | null;
}

/**
 * A data-supported insight card, or null when there is nothing measured to
 * say (no portfolio / no priced holdings).
 */
export function buildPortfolioInsight(facts: PortfolioFacts): AiInsight | null {
  const { summary, holdings, sectors, riskProfile } = facts;
  const valued = holdings.filter((h) => h.available && h.value != null);
  if (valued.length === 0) return null;

  const equity = valued.reduce((sum, h) => sum + (h.value ?? 0), 0);
  const topSector = sectors[0];
  const topHolding = [...valued].sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))[0];
  const sectorCount = sectors.length;
  const cashShare =
    summary.totalValue > 0 ? Math.round((summary.availableCash / summary.totalValue) * 100) : 0;

  const title = topSector
    ? `${topSector.sector} is ${topSector.pct.toFixed(0)}% of your equity`
    : `Your equity sits in ${valued.length} position${valued.length === 1 ? "" : "s"}`;

  const insight = [
    `You hold ${valued.length} position${valued.length === 1 ? "" : "s"} across ${sectorCount} sector${sectorCount === 1 ? "" : "s"}, ` +
      `worth ${inr(Math.round(equity))} at latest available prices, plus ${inr(Math.round(summary.availableCash))} cash (${cashShare}% of portfolio value).`,
    topSector
      ? `Your largest sector is ${topSector.sector} at ${topSector.pct.toFixed(1)}% of equity.`
      : "",
    topHolding
      ? `Your biggest position is ${topHolding.symbol} at ${(topHolding.weightPct ?? 0).toFixed(1)}% of equity.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const why = topSector
    ? `Why this matters: at ${topSector.pct.toFixed(1)}% in one sector, a broad decline there would move a similar share of your equity at once — concentration decides where your returns and losses come from.`
    : `Why this matters: position size decides how much each stock's move affects your overall result.`;

  const action = riskProfile
    ? `Suggested check: compare this mix with what you intended — your stated risk preference is ${riskProfile}. This is a measurement, not a recommendation.`
    : `Suggested check: compare this mix with the goal and risk level you have in mind. This is a measurement, not a recommendation.`;

  return {
    id: "portfolio-live",
    tag: "YOUR PORTFOLIO",
    title,
    insight,
    why,
    action,
    caveat:
      "Calculated from your actual holdings at latest available market prices (may be delayed, not live). Educational — not financial advice.",
  };
}
