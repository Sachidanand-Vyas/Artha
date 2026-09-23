import type { AdvisorStructured, SectorSlice, Stock, StockQa } from "@/lib/types";

/**
 * DETERMINISTIC RESPONSE TEMPLATES
 * --------------------------------
 * Rule-based text built from values that are passed IN — stock data comes
 * from the backend via stockService, portfolio context from portfolioService.
 * Nothing here invents portfolio numbers: when no portfolio context is given,
 * the text simply doesn't mention one.
 */

/* ------------------------------------------------------------------ */
/*  Stock structured answers (used by Ask Artha + Advisor)             */
/* ------------------------------------------------------------------ */

function stockStructured(s: Stock): AdvisorStructured {
  const priceNote =
    s.currency === "INR"
      ? `trades near ₹${s.price.toFixed(0)}`
      : `trades near $${s.price.toFixed(2)}`;
  const riskLabel = (s.risk ?? "Moderate").toLowerCase();
  const betaNote =
    s.beta == null
      ? "its beta is not published by the data provider"
      : s.beta >= 1.3
        ? `a high beta of ${s.beta.toFixed(2)} (it tends to move more than the market)`
        : s.risk === "Low"
          ? `a low beta of ${s.beta.toFixed(2)} and a strong balance sheet`
          : `a beta of ${s.beta.toFixed(2)}`;
  return {
    risk: `${s.name} carries a **${riskLabel}** risk label, driven by ${betaNote}${
        s.pe && s.pe > 45
          ? ` and a rich valuation (P/E ${s.pe.toFixed(1)}).`
          : s.pe && s.pe < 15
            ? ` while the low P/E of ${s.pe.toFixed(1)} already prices in some caution.`
            : "."
      }`,
    upside:
      `If the business grows as expected, the upside comes from earnings expansion over time — the stock ${priceNote}, with analysts' views mixed on the pace.`,
    impact:
      `Adding ${s.symbol} changes your sector mix. It currently sits in the "${s.sector}" bucket; a large position would increase concentration there, which your portfolio view would flag.`,
    concerns:
      s.risk === "High"
        ? [
            "Elevated volatility — expect swings that test your discipline",
            "Valuation leaves little margin for earnings misses",
            "Sector-specific risk (one industry moving against it)",
          ]
        : [
            "Even lower-risk names can fall 15–25% in a broad downturn",
            "Opportunity cost — the same money elsewhere might compound faster",
            "Concentration risk if it becomes too large a share of your portfolio",
          ],
    learn:
      `Start with the lesson "Risk and return" and "P/E ratio" in the Learn section — they explain the exact metrics behind this assessment.`,
  };
}

/* ------------------------------------------------------------------ */
/*  Research-page Q&A                                                  */
/* ------------------------------------------------------------------ */

const sectorAvgPe: Record<string, number> = {
  "IT Services": 25,
  Banking: 18,
  "Energy & Conglomerate": 22,
  Energy: 22,
  Automobiles: 24,
  NBFC: 22,
  FMCG: 40,
  Consumer: 45,
  Infrastructure: 30,
  Technology: 30,
  Semiconductors: 45,
};

/** Optional real portfolio context so "does this fit my portfolio?" uses actual data. */
export interface StockQaContext {
  hasPortfolio: boolean;
  sectors: SectorSlice[];
}

export function stockQa(s: Stock, question: string, ctx?: StockQaContext | null): StockQa {
  const q = question.toLowerCase();

  if (q.includes("risky") || q.includes("risk")) {
    const reasons: string[] = [];
    if (s.beta != null && s.beta >= 1.3)
      reasons.push(`higher historical volatility (beta ${s.beta.toFixed(2)})`);
    if (s.pe && s.pe > 45) reasons.push(`elevated valuation (P/E ${s.pe.toFixed(1)}) vs its history`);
    if (s.debtToEquity != null && s.debtToEquity > 1.5)
      reasons.push(`higher leverage (debt-to-equity ${s.debtToEquity.toFixed(2)})`);
    if (ctx?.hasPortfolio)
      reasons.push("how much of your portfolio a position here would concentrate in one name");
    const riskLabel = (s.risk ?? "Moderate").toLowerCase();
    return {
      question,
      answer: `Several factors contribute to the current **${riskLabel}** risk assessment:
${reasons.map((r, i) => `${i + 1}. ${r}`).join("\n")}

This does not mean the stock will fall — it means the *uncertainty* around potential outcomes is higher.`,
      points: [
        "Risk labels come from volatility, valuation and leverage — not from a prediction",
        "A high-risk label can be appropriate if your horizon is long",
      ],
    };
  }

  if (q.includes("valuation") || q.includes("expensive") || q.includes("cheap") || q.includes("pe") || q.includes("p/e")) {
    const sector = sectorAvgPe[s.sector] ?? 25;
    const rel = s.pe ? ((s.pe - sector) / sector) * 100 : 0;
    const verdict = rel > 25 ? "above" : rel < -15 ? "below" : "in line with";
    return {
      question,
      answer: `At a P/E of ${s.pe?.toFixed(1) ?? "n/a"}, ${s.name} trades **${verdict}** the typical ${s.sector} range (≈${sector}). A premium multiple usually prices in expected growth — the question is whether growth can deliver.`,
      points: [
        "Compare to the company's own 5-year average, not just peers",
        "A low P/E can signal a bargain or a value trap — check growth and debt",
        "P/E ignores debt and cash; pair it with ROE and D/E",
      ],
    };
  }

  if (q.includes("portfolio") || q.includes("fit") || q.includes("allocate") || q.includes("buy")) {
    let answer: string;
    if (!ctx?.hasPortfolio) {
      answer = `${s.name} sits in the **"${s.sector}"** sector. You don't have a portfolio set up yet, so there is nothing to fit it into — set one up on the Portfolio page (virtual money or your existing holdings) and I can compare it against what you actually hold.`;
    } else if (!ctx.sectors.length) {
      answer = `Your portfolio has no priced holdings yet, so adding ${s.symbol} would simply establish your first exposure to **"${s.sector}"**. Position size matters more than the stock pick.`;
    } else {
      const top = ctx.sectors[0];
      answer = `${s.name} sits in **"${s.sector}"**. Your largest sector today is ${top.sector} at ${top.pct.toFixed(1)}% of your equity — buying ${s.symbol} would add to the "${s.sector}" bucket instead. A stock is 'good' or 'bad' only relative to what you already hold and the concentration you're comfortable with.`;
    }
    return {
      question,
      answer,
      points: [
        "A stock is 'good' or 'bad' only relative to your other holdings and goals",
        "Position size matters more than the stock pick",
        "Consider what already dominates your portfolio before adding more of it",
      ],
    };
  }

  if (q.includes("simpler") || q.includes("simple")) {
    return {
      question,
      answer: `Think of it this way: ${s.name} is a business. If its earnings grow, the business becomes worth more, and the stock can follow. The risk labels tell you how bumpy the ride might be — high risk means bigger ups and downs, not a guaranteed loss.`,
      points: ["Own the business, not the ticker", "Bumpy ≠ broken"],
    };
  }

  if (q.includes("calculation") || q.includes("how is") || q.includes("show")) {
    const beta = s.beta?.toFixed(2) ?? "n/a";
    const volEstimate = s.beta != null ? `~${(s.beta * 10 + 8).toFixed(1)}% (a rough beta-based estimate)` : "n/a";
    return {
      question,
      answer: `A simplified view of the inputs behind the risk label for ${s.name}:

• **Volatility** — annualised standard deviation of daily returns: ${volEstimate}
• **Valuation** — P/E ${s.pe?.toFixed(1) ?? "n/a"} vs sector ${sectorAvgPe[s.sector] ?? 25}
• **Leverage** — Debt/Equity ${s.debtToEquity?.toFixed(2) ?? "n/a"}
• **Market sensitivity** — Beta ${beta}

The risk label combines these into a Low / Moderate / High bucket. The exact weighting is transparent in the analytics layer — no hidden 'prediction' is involved.`,
      points: ["Values marked n/a are not published by the data provider", "Real risk engines add correlation and drawdown inputs"],
    };
  }

  // Fallback
  return {
    question,
    answer: `On **${s.name}** (${s.symbol}): the current assessment is based on its fundamentals — P/E ${s.pe?.toFixed(1) ?? "n/a"}, ROE ${s.roe?.toFixed(1) ?? "n/a"}%, beta ${s.beta?.toFixed(2) ?? "n/a"} — plus how it interacts with your existing holdings. I can go deeper on risk, valuation, portfolio fit, or the calculation behind the label.`,
    points: [
      "Ask: 'Why is this risky?', 'Is the valuation reasonable?', 'How does it fit my portfolio?'",
      "Explanations are educational, not predictions",
    ],
  };
}

export function compareWithPeer(s: Stock, peer: Stock): StockQa {
  return {
    question: `Compare ${s.symbol} with ${peer.symbol}`,
    answer: `**${s.symbol} vs ${peer.symbol}** (both "${s.sector}", latest available prices):

| Metric | ${s.symbol} | ${peer.symbol} |
| --- | --- | --- |
| Price | ${s.currency === "INR" ? "₹" : "$"}${s.price.toFixed(2)} | ${peer.currency === "INR" ? "₹" : "$"}${peer.price.toFixed(2)} |
| P/E | ${s.pe?.toFixed(1) ?? "—"} | ${peer.pe?.toFixed(1) ?? "—"} |
| ROE | ${s.roe?.toFixed(1) ?? "—"}% | ${peer.roe?.toFixed(1) ?? "—"}% |
| D/E | ${s.debtToEquity?.toFixed(2) ?? "—"} | ${peer.debtToEquity?.toFixed(2) ?? "—"} |
| Beta | ${s.beta?.toFixed(2) ?? "—"} | ${peer.beta?.toFixed(2) ?? "—"} |
| Risk | ${s.risk ?? "N/A"} | ${peer.risk ?? "N/A"} |

The higher-risk name offers more upside potential in a strong scenario but demands more tolerance for drawdowns. Which fits your portfolio depends on what you already hold.`,
    points: [
      "Compare like-for-like: same sector, similar scale",
      "Valuation differences usually reflect growth expectations",
    ],
  };
}

export function quickStructuredAnswer(stock: Stock): AdvisorStructured {
  return stockStructured(stock);
}
