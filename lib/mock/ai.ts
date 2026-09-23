import type {
  AdvisorStructured,
  AiInsight,
  Stock,
  StockPrediction,
  StockQa,
} from "@/lib/types";
import { stocks } from "@/lib/mock/stocks";


/**
 * DEMO RESPONSE ENGINE
 * --------------------
 * Everything in this file is deterministic, rule-based sample content.
 * It exists so the UI can be designed, tested and demonstrated before a
 * real LLM/agent backend is connected through aiService. No claim is made
 * that an AI model is running.
 */

export const dashboardInsight: AiInsight = {
  id: "dash-1",
  tag: "AI ANALYSIS",
  title: "Sector concentration is rising",
  insight:
    "Your portfolio has increased exposure to large-cap technology stocks this month. This improves growth potential but increases sector concentration.",
  why: "Concentration can increase portfolio volatility if the technology sector experiences a broad decline — losses would hit a larger share of your holdings at once.",
  action:
    "Consider reviewing your sector allocation before increasing exposure further. Rebalancing toward debt or a different sector would lower the concentration measure.",
  caveat:
    "This is a rule-based illustration on sample data, not a prediction or recommendation. It is designed to show how explanations are surfaced, not to advise you to act.",
};

export const portfolioInsight: AiInsight = {
  id: "pf-1",
  tag: "AI PORTFOLIO ANALYSIS",
  title: "Moderate diversification, two dominant sectors",
  insight:
    "Your portfolio is moderately diversified, but 38% of your equity allocation is concentrated in two sectors — IT services and banking. This is normal for a mid-size portfolio, but worth understanding.",
  why: "Why this matters: when a single sector is hit by a shock, a concentrated portfolio loses more than a broad one. IT and banking have historically moved together in drawdowns.",
  action:
    "Possible consideration: new contributions could gradually go to under-represented sectors or asset classes rather than adding to the two large ones. No action is required — this is an explanation, not a recommendation.",
  caveat:
    "Analysis is rule-based on sample data and is educational. It does not predict returns and is not financial advice.",
};

/* ------------------------------------------------------------------ */
/*  Advisor chat engine                                               */
/* ------------------------------------------------------------------ */

export interface AdvisorReply {
  text: string;
  structured: AdvisorStructured;
}

function findStockInPrompt(prompt: string): Stock | undefined {
  const p = prompt.toUpperCase();
  const direct = stocks.find((s) => p.includes(s.symbol));
  if (direct) return direct;
  return stocks.find((s) => p.includes(s.name.toUpperCase().split(" ")[0]));
}

/**
 * Which tracked symbol the prompt mentions. The static list here is used ONLY
 * to recognise the name — the actual data is then loaded from the backend by
 * aiService, so answers never quote mock prices.
 */
export function mentionedSymbol(prompt: string): string | undefined {
  return findStockInPrompt(prompt)?.symbol;
}

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
      `Adding ${s.symbol} changes your sector mix. It currently sits in the "${s.sector}" bucket; a large position would increase concentration there, which the Artha portfolio model would flag.`,
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

function topicReply(prompt: string, mentionsStock: boolean): AdvisorReply | null {
  const p = prompt.toLowerCase();

  if (p.includes("sip") || (p.includes("invest") && p.includes("month"))) {
    return {
      text: "A SIP (Systematic Investment Plan) invests a fixed amount at regular intervals. Its power is compounding plus discipline — you never have to time the market. The right amount depends on your surplus income and goals, not on how much you can 'afford to risk'.",
      structured: {
        risk: "SIPs average out your purchase price through ups and downs, which reduces — but does not remove — market risk. Equity SIPs can still show negative returns in the short term.",
        upside: "Historical illustrations suggest long-term equity SIPs compound well, but past performance is not a promise of future returns.",
        impact: "A monthly commitment of, say, ₹10,000 redirects that amount from spending to investing — your liquidity needs to stay intact.",
        concerns: [
          "Stopping a SIP during a downturn defeats the whole purpose",
          "Choose the fund/vehicle based on your horizon, not past returns",
          "Keep an emergency fund before you start investing",
        ],
        learn: 'The "SIPs and the power of compounding" lesson walks through the numbers.',
      },
    };
  }

  if (p.includes("retire")) {
    return {
      text: "Retirement planning is a math problem with three variables: how much you need each month, how long you'll live off it, and what your money earns. Use the Retirement Planner tool — it separates the corpus you need from the monthly saving required to get there.",
      structured: {
        risk: "Inflation is the silent risk — ₹1 lakh today buys far less in 25 years. Equity exposure early in accumulation helps, but must be tapered as retirement nears.",
        upside: "Starting early turns small monthly amounts into a large corpus through compounding.",
        impact: "Saving for retirement competes with other goals; the planner tool lets you see the monthly trade-off clearly.",
        concerns: [
          "Underestimating inflation (use 6% in your base case)",
          "Withdrawing too much in the first years of retirement",
          "Not accounting for medical inflation separately",
        ],
        learn: "Try the Retirement Planner under Tools and the compounding lesson under Learn.",
      },
    };
  }

  if (p.includes("tax")) {
    return {
      text: "For equity, tax is triggered only on realised gains, and the rate depends on your holding period. Long-term holdings (12+ months for listed equity) are taxed at a lower rate than short-term. Verify the current year's budget rules — rates and thresholds change.",
      structured: {
        risk: "The main tax risk is a surprise at sale time — selling within a year and paying the short-term rate, or forgetting gains are taxable even if you reinvest them.",
        upside: "Holding longer and using tax-loss harvesting (offsetting gains with realised losses) can reduce your bill legitimately.",
        impact: "Tax changes your effective return — a 15% gross return can feel very different after tax and inflation.",
        concerns: [
          "Budget changes can alter rates — check annually",
          "Tax-loss harvesting has strict rules; follow them carefully",
          "Never let tax drive an investment you wouldn't otherwise make",
        ],
        learn: "The 'Tax basics: capital gains' lesson explains holding periods and regimes.",
      },
    };
  }

  if (p.includes("diversif") || p.includes("all my eggs") || p.includes("concentrat")) {
    return {
      text: "Diversification spreads your money across assets whose losses rarely arrive together. It removes company- and sector-specific risk, leaving you with market risk — the part you're rewarded for bearing.",
      structured: {
        risk: "A concentrated portfolio (e.g. 5 stocks in one sector) can lose 30–50% from a single industry event. Diversification is the main tool to prevent that.",
        upside: "You keep most of the market's long-term upside while damping the worst drawdowns.",
        impact: "In your current portfolio, ~38% of equity sits in two sectors — worth reviewing before adding more there.",
        concerns: [
          "Diversification across sectors, not just many stocks",
          "Adding debt and gold changes the risk of the whole portfolio, not just equity",
          "Over-diversification (50+ holdings) adds clutter without much benefit",
        ],
        learn: "The 'Diversification' lesson covers company, sector and market risk.",
      },
    };
  }

  if (p.includes("risk") && !mentionsStock) {
    return {
      text: "Risk is the possibility that outcomes differ from what you expect — and markets pay you for bearing it. The practical question is never 'is it risky?' but 'is the risk appropriate for my horizon and temperament?'",
      structured: {
        risk: "Volatility is not the same as loss. The risks that actually hurt are permanent capital loss and forced selling at the bottom.",
        upside: "Understanding your real risk capacity lets you stay invested through drawdowns, which is where most long-term returns come from.",
        impact: "Your current portfolio risk score is Moderate (62/100) — driven by equity concentration in IT and banking.",
        concerns: [
          "A 30–40% equity drawdown is historically normal — plan for it",
          "Selling during a crash locks in losses permanently",
          "Leverage turns normal volatility into forced decisions",
        ],
        learn: "Start with the 'Risk and return' lesson, then run the Risk Calculator under Tools.",
      },
    };
  }

  if (p.includes("emergency") || p.includes("emergency fund")) {
    return {
      text: "An emergency fund is 3–6 months of essential expenses kept liquid (savings account or liquid fund). It exists so a job loss or medical bill never forces you to sell investments at a bad time.",
      structured: {
        risk: "Without it, any shock forces you to liquidate equity — often at the worst possible price.",
        upside: "Small relative to your portfolio, but it protects every other goal from being derailed.",
        impact: "You have saved ₹4.2 lakh toward a ₹6 lakh target — about 70% there. Priority: complete this before increasing equity commitments.",
        concerns: [
          "It must be liquid — not locked in long-term instruments",
          "Replenish it after any withdrawal",
          "Earning nothing on it is the price of safety",
        ],
        learn: "The Personal Finance category in Learn covers savings habits.",
      },
    };
  }

  return null;
}

export function advisorReply(
  prompt: string,
  stock?: Stock & { prediction?: StockPrediction },
): AdvisorReply {
  const mentioned = mentionedSymbol(prompt);
  const topic = topicReply(prompt, Boolean(mentioned));

  // The prompt names a stock but the backend has no data for it -> say so
  // instead of falling back to sample values.
  if (mentioned && !stock) {
    return {
      text: `I can see you are asking about **${mentioned}**, but the market-data backend has no history for that symbol right now, so I will not guess. Try a covered symbol such as RELIANCE, TCS, INFY, HDFCBANK or SBIN.`,
      structured: {
        risk: "No data means no measurement — Artha never fills gaps with invented numbers.",
        upside: "Once the provider covers the symbol, the Research page will show price history, indicators and a calculated BUY/HOLD/SELL signal.",
        impact: "This symbol cannot be placed in your sector mix without data.",
        concerns: [
          "Check the spelling / exchange of the symbol",
          "The data provider may have paused coverage",
        ],
        learn: "Open Research on a covered stock to see how the pipeline works end to end.",
      },
    };
  }

  if (stock) {
    const lower = prompt.toLowerCase();
    const ask = lower.includes("should i") || lower.includes("invest in");
    const p = stock.prediction;
    const signalNote = p
      ? `\n\n**Same-engine signal:** the backend's calculated recommendation for ${stock.symbol} is **${p.signal}** (score ${p.score} of ±100, signal strength ${p.signalStrength}). ${p.reasons[0] ?? ""} — identical to what the Research page shows.`
      : "";
    return {
      text:
        (ask
          ? `Whether to invest in ${stock.name} depends on your horizon, risk tolerance, existing exposure and objective — not on the stock alone. Here is what to weigh:`
          : `Here is how ${stock.name} fits into an analysis. These are measured values from the latest available market data, not a forecast.`) +
        signalNote,
      structured: stockStructured(stock),
    };
  }

  if (topic) return topic;

  return {
    text: "I can help you think through investing questions — but I'm currently running on sample rule-based responses. Try asking about a specific stock (e.g. 'Should I invest in NVDA?'), a SIP, retirement, diversification, taxes, or an emergency fund.",
    structured: {
      risk: "No market analysis can promise outcomes — this assistant explains concepts and sample data; it does not predict prices.",
      upside: "The more specific your question (stock, horizon, amount), the more useful the analysis becomes.",
      impact: "You can connect a real AI backend later via the aiService interface without changing this screen.",
      concerns: [
        "Anything here is educational, not financial advice",
        "Market data is latest-available and may be delayed — it is not a live feed",
        "Verify any rule change (e.g. tax) against official sources",
      ],
      learn: "Browse the Learn section for structured lessons on any of these topics.",
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Research-page Q&A                                                  */
/* ------------------------------------------------------------------ */

const sectorAvgPe: Record<string, number> = {
  "IT Services": 25,
  Banking: 18,
  "Energy & Conglomerate": 22,
  Automobiles: 24,
  NBFC: 22,
  FMCG: 40,
  Consumer: 45,
  Infrastructure: 30,
  Technology: 30,
  Semiconductors: 45,
};

export function stockQa(s: Stock, question: string): StockQa {
  const q = question.toLowerCase();

  if (q.includes("risky") || q.includes("risk")) {
    const reasons: string[] = [];
    if (s.beta != null && s.beta >= 1.3)
      reasons.push(`higher historical volatility (beta ${s.beta.toFixed(2)})`);
    if (s.pe && s.pe > 45) reasons.push(`elevated valuation (P/E ${s.pe.toFixed(1)}) vs its history`);
    if (s.debtToEquity != null && s.debtToEquity > 1.5)
      reasons.push(`higher leverage (debt-to-equity ${s.debtToEquity.toFixed(2)})`);
    reasons.push("concentration within a single sector in your portfolio");
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
    return {
      question,
      answer: `${s.name} is best understood through your **portfolio context**: how large a position it would become, and whether it adds diversification or concentration to what you already hold. The Artha model currently flags ~38% of your equity in two sectors — adding ${s.symbol} would increase exposure to "${s.sector}".`,
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
    const volEstimate = s.beta != null ? `${(s.beta * 10 + 8).toFixed(1)}%` : "n/a";
    return {
      question,
      answer: `A simplified view of the inputs behind the risk label for ${s.name}:

• **Volatility** — annualised standard deviation of daily returns: ~${volEstimate} (estimated from beta)
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

/* Suggested starter prompts for the advisor UI */
export const suggestedPrompts = [
  "Should I invest in NVDA?",
  "How does a SIP actually work?",
  "Is my portfolio too concentrated?",
  "What should I know before retiring?",
  "How are equity gains taxed?",
];
