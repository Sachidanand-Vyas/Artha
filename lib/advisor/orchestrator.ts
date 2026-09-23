/**
 * ADVISOR ORCHESTRATION LAYER
 * ----------------------------
 * One question in -> a plan:
 *
 *   detect intent + entities + conversation context
 *        -> gather ONLY the data that intent needs
 *        -> (optional LLM formats the answer | local renderer writes it)
 *
 * Data always comes from the existing Artha services (stockService,
 * portfolioService, marketService) or the backend calculation engine.
 * Nothing here recomputes indicators or recommendations, and nothing
 * financial is ever invented: missing metrics show as N/A, and if the
 * backend is unreachable the Advisor says so instead of guessing.
 */

import type {
  AdvisorStructured,
  Holding,
  IndexQuote,
  PortfolioSummary,
  SectorSlice,
  StockAnalysis,
} from "@/lib/types";
import {
  compareEntries,
  comparisonPartners,
  matchKnowledge,
  type KnowledgeEntry,
} from "@/lib/advisor/knowledge";
import {
  detectFollowUp,
  detectIndexEntity,
  detectStockField,
  intentForCategory,
  isGreeting,
  isOutOfScope,
  isPortfolioQuestion,
  previousUserTurn,
  resolveStockEntity,
  type FollowUp,
  type Intent,
  type StockField,
} from "@/lib/advisor/intents";
import {
  formatCalculation,
  missingInputsReply,
  parseCalculation,
  runCalculation,
  type CalcParse,
  type CalcRequest,
  type CalcResult,
} from "@/lib/advisor/calc";
import { stockService } from "@/lib/services/stockService";
import { marketService } from "@/lib/services/marketService";
import { portfolioService } from "@/lib/services/portfolioService";
import { quickStructuredAnswer } from "@/lib/mock/ai";
import { currencyOf, formatShortDate, inr, pct, signed } from "@/lib/utils";

export interface AdvisorTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AdvisorReply {
  text: string;
  structured?: AdvisorStructured;
}

/* -------------------------------------------------------------------------- */
/*  Plan                                                                       */
/* -------------------------------------------------------------------------- */

interface PortfolioData {
  summary: PortfolioSummary;
  sectors: SectorSlice[];
  holdings: Holding[];
}

interface SectorMove {
  sector: string;
  changePct: number;
}

export interface AdvisorPlan {
  intent: Intent;
  prompt: string;
  /** Set when the backend could not be reached for data the answer needs. */
  dataError?: string;
  // knowledge
  entry?: KnowledgeEntry;
  compare?: [KnowledgeEntry, KnowledgeEntry];
  mode?: "concept" | "why-concept";
  // stock
  symbol?: string;
  field?: StockField;
  stock?: StockAnalysis;
  // market
  indexEntity?: "NIFTY 50" | "SENSEX" | "MARKET";
  indices?: IndexQuote[];
  sectorMoves?: SectorMove[];
  // portfolio
  portfolio?: PortfolioData;
  holdingSymbol?: string;
  // calculation
  calc?: CalcParse;
  calcRequest?: CalcRequest;
  calcResult?: CalcResult;
  // terminal replies
  direct?: string;
  structured?: AdvisorStructured;
  /** Structured data handed to the LLM (only what this intent needs). */
  llmContext: Record<string, unknown> | null;
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const NA = "N/A";
const num = (v: number | null | undefined, d = 2) => (v == null ? NA : v.toFixed(d));
const pctOrNull = (v: number | null | undefined, d = 1) => (v == null ? NA : `${v.toFixed(d)}%`);

function asOfLine(s: { timestamp?: string; source?: string }): string {
  const when = s.timestamp ? formatShortDate(Date.parse(s.timestamp)) : "unknown date";
  return `latest available data as of ${when}${s.source ? ` · ${s.source}` : ""} (may be delayed, not live)`;
}

const KNOWLEDGE_PIVOT =
  '_Tip: apply any concept to real data — ask e.g. "What about Reliance?" or "Is my portfolio diversified?"_';

/* -------------------------------------------------------------------------- */
/*  Sync signal detection (no network)                                         */
/* -------------------------------------------------------------------------- */

interface Signals {
  calc: CalcParse;
  portfolio: boolean;
  entity: string | null; // alias/ticker level (cheap, no network)
  indexEntity: "NIFTY 50" | "SENSEX" | "MARKET" | null;
  matches: KnowledgeEntry[];
  compare: [KnowledgeEntry, KnowledgeEntry] | null;
  field: StockField;
  greeting: boolean;
  outOfScope: boolean;
}

function analyzeSync(text: string): Signals {
  return {
    calc: parseCalculation(text),
    portfolio: isPortfolioQuestion(text),
    entity: resolveStockEntity(text, null), // aliases only; universe retry later
    indexEntity: detectIndexEntity(text),
    matches: matchKnowledge(text),
    compare: comparisonPartners(text),
    field: detectStockField(text),
    greeting: isGreeting(text),
    outOfScope: isOutOfScope(text),
  };
}

/** Strong = a clear concept answer exists and nothing data-specific was asked. */
const knowledgeIsStrong = (s: Signals) =>
  !s.calc.wantsCalculation && !s.portfolio && !s.entity && (s.compare !== null || s.matches.length > 0);

/* -------------------------------------------------------------------------- */
/*  Data gathering                                                             */
/* -------------------------------------------------------------------------- */

async function loadStockPlan(symbol: string, plan: AdvisorPlan): Promise<void> {
  plan.symbol = symbol;
  try {
    plan.stock = await stockService.getStock(symbol);
  } catch {
    plan.dataError = `the market-data backend is unreachable, so I have no measured numbers for ${symbol}`;
    return;
  }
  if (!plan.stock) {
    plan.direct = [
      `I don't have data for **${symbol}** in the tracked universe, so I won't guess anything about it.`,
      "",
      "Try a covered symbol — RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, SBIN, LT, ITC…",
    ].join("\n");
  }
}

async function loadPortfolio(plan: AdvisorPlan): Promise<void> {
  plan.intent = "PORTFOLIO";
  try {
    const [summary, sectors, holdings] = await Promise.all([
      portfolioService.getSummary(),
      portfolioService.getSectorAllocation(),
      portfolioService.getHoldings(),
    ]);
    plan.portfolio = { summary, sectors, holdings };
  } catch {
    plan.dataError =
      "the portfolio service (FastAPI backend) is unreachable right now, so I can't quote your holdings — I won't estimate them";
  }
}

async function loadMarket(plan: AdvisorPlan): Promise<void> {
  plan.intent = "MARKET_DATA";
  try {
    const [indices, sectorMoves] = await Promise.all([
      marketService.getIndices(),
      marketService.getSectorPerformance(),
    ]);
    plan.indices = indices;
    plan.sectorMoves = sectorMoves;
  } catch {
    plan.dataError =
      "the market-data backend is unreachable, so I can't quote index levels right now";
  }
}

/* -------------------------------------------------------------------------- */
/*  Planning                                                                   */
/* -------------------------------------------------------------------------- */

export async function planReply(
  prompt: string,
  history: AdvisorTurn[] = [],
): Promise<AdvisorPlan> {
  const text = prompt.trim();
  const plan: AdvisorPlan = { intent: "GENERAL_FINANCE", prompt: text, llmContext: null };

  if (!text) {
    plan.direct = greetingReply();
    return plan;
  }

  /* ---- Contextual follow-ups ("Why?" / "What about Reliance?") ------------ */
  const follow: FollowUp | null = detectFollowUp(text);
  if (follow) {
    const prevText = previousUserTurn(history.map((h) => ({ role: h.role, text: h.text })));
    if (prevText) {
      await planFollowUp(plan, follow, analyzeSync(prevText));
      if (plan.direct || plan.stock || plan.portfolio || plan.entry || plan.calc || plan.indices) {
        return plan;
      }
    }
    plan.direct = fallbackReply();
    plan.intent = "OUT_OF_SCOPE";
    return plan;
  }

  const sig = analyzeSync(text);

  /* ---- Calculation: maths always goes to the backend engine --------------- */
  if (sig.calc.wantsCalculation) {
    plan.intent = "CALCULATION";
    plan.calc = sig.calc;
    if (sig.calc.request) {
      plan.calcRequest = sig.calc.request;
      try {
        plan.calcResult = await runCalculation(sig.calc.request);
      } catch {
        plan.dataError =
          "the calculation engine (FastAPI backend) is unreachable, so I can't compute this exactly — I don't do arithmetic by hand, to avoid giving you a wrong number";
      }
    }
    return plan;
  }

  /* ---- Portfolio questions ------------------------------------------------ */
  if (sig.portfolio) {
    plan.holdingSymbol = sig.entity ?? undefined;
    plan.field = sig.field;
    await loadPortfolio(plan);
    return plan;
  }

  /* ---- Stock questions (entity may need the live universe to resolve) ----- */
  let entity = sig.entity;
  let matches = sig.matches;
  let compare = sig.compare;
  if (!entity && !knowledgeIsStrong(sig) && !sig.indexEntity && !sig.greeting && !sig.outOfScope) {
    // Only hit the universe when cheap checks failed: this catches full
    // company names ("Tata Consultancy Services") without penalising
    // concept questions with an extra request.
    const universe = await stockService.getStocks().catch(() => null);
    entity = resolveStockEntity(text, universe);
    if (entity) {
      matches = [];
      compare = null;
    }
  }
  if (entity) {
    plan.intent = "STOCK_ANALYSIS";
    plan.field = sig.field;
    await loadStockPlan(entity, plan);
    return plan;
  }

  /* ---- Market / index questions ------------------------------------------ */
  if (sig.indexEntity) {
    plan.indexEntity = sig.indexEntity;
    plan.field = sig.field;
    await loadMarket(plan);
    return plan;
  }

  /* ---- General finance knowledge ----------------------------------------- */
  if (compare) {
    plan.intent = intentForCategory(compare[0].category);
    plan.compare = compare;
    return plan;
  }
  if (matches.length) {
    plan.intent = intentForCategory(matches[0].category);
    plan.entry = matches[0];
    return plan;
  }

  /* ---- Terminal replies --------------------------------------------------- */
  if (sig.greeting) {
    plan.direct = greetingReply();
    return plan;
  }
  plan.intent = "OUT_OF_SCOPE";
  plan.direct = sig.outOfScope ? outOfScopeReply() : fallbackReply();
  return plan;
}

async function planFollowUp(
  plan: AdvisorPlan,
  follow: NonNullable<FollowUp>,
  prev: Signals,
): Promise<void> {
  if (follow.type === "what-about") {
    const payload = follow.payload;
    // "What about <stock>?" -> carry the previous angle onto the new stock.
    const universe = await stockService.getStocks().catch(() => null);
    const symbol = resolveStockEntity(payload, universe);
    if (symbol) {
      plan.intent = "STOCK_ANALYSIS";
      plan.field = prev.calc?.wantsCalculation
        ? "analysis"
        : prev.entity
          ? prev.field
          : prev.matches.length
            ? conceptToField(prev.matches[0])
            : detectStockField(payload);
      await loadStockPlan(symbol, plan);
      return;
    }
    // "What about <concept>?" -> answer that concept.
    const matches = matchKnowledge(payload);
    if (matches.length) {
      plan.intent = intentForCategory(matches[0].category);
      plan.entry = matches[0];
      return;
    }
    plan.intent = "OUT_OF_SCOPE";
    plan.direct = fallbackReply();
    return;
  }

  // "Why?" -> deepen the previous topic with real reasons.
  if (prev.calc?.wantsCalculation && prev.calc.request) {
    plan.intent = "CALCULATION";
    plan.calc = prev.calc;
    plan.calcRequest = prev.calc.request;
    try {
      plan.calcResult = await runCalculation(prev.calc.request);
    } catch {
      plan.dataError = "the calculation engine (FastAPI backend) is unreachable right now";
    }
    return;
  }
  if (prev.entity) {
    plan.intent = "STOCK_ANALYSIS";
    plan.field = "why";
    await loadStockPlan(prev.entity, plan);
    return;
  }
  if (prev.portfolio) {
    plan.intent = "PORTFOLIO";
    plan.field = "why";
    await loadPortfolio(plan);
    return;
  }
  if (prev.indexEntity) {
    plan.indexEntity = prev.indexEntity;
    plan.field = "why";
    await loadMarket(plan);
    return;
  }
  if (prev.matches.length) {
    plan.intent = intentForCategory(prev.matches[0].category);
    plan.entry = prev.matches[0];
    plan.mode = "why-concept";
    return;
  }
  plan.intent = "GENERAL_FINANCE";
  plan.direct =
    "Happy to go deeper — I just need to know *what* to expand on. Try a concept (\u201cWhat is RSI?\u201d), a stock (\u201cWhy is Reliance falling?\u201d) or your portfolio (\u201cWhy is my portfolio down?\u201d).";
}

/** Which stock metric a knowledge concept maps to ("What about Reliance?" after "What is P/E?"). */
function conceptToField(entry: KnowledgeEntry): StockField {
  switch (entry.id) {
    case "pe":
    case "pb":
    case "roe":
    case "market-cap":
    case "dividend":
      return "valuation";
    case "rsi":
      return "rsi";
    case "macd":
      return "macd";
    case "volatility":
    case "beta":
      return "risk";
    case "moving-averages":
      return "moving-average";
    default:
      return "analysis";
  }
}

/* -------------------------------------------------------------------------- */
/*  Local reply renderers                                                      */
/* -------------------------------------------------------------------------- */

function greetingReply(): string {
  return [
    "Hi — I'm **Artha**, your finance assistant.",
    "",
    'Ask me anything finance: concepts (*"What is P/E ratio?"*), markets (*"Why is Reliance moving?"*), investing (SIPs, ETFs, mutual funds), personal finance, retirement, tax — plus **your** data (*"How much is my portfolio worth?"*) and exact calculations (*"₹5,000 per month for 10 years at 12%"*).',
  ].join("\n");
}

function outOfScopeReply(): string {
  return [
    "That's outside what Artha covers — I'm focused on **finance**.",
    "",
    "I'm happy to help with stocks, markets, investing, mutual funds, SIPs, bonds, portfolio management, risk, diversification, personal finance, budgeting, retirement, tax concepts and financial calculations. What would you like to explore?",
  ].join("\n");
}

function fallbackReply(): string {
  return [
    "I didn't catch a finance question there — Artha is focused on **finance**, so I'd rather not guess at anything else.",
    "",
    "Try one of these:",
    '• Concept: *"What is P/E ratio?"* · *"How does a SIP work?"*',
    '• Your data: *"How much is my portfolio worth?"* · *"What is Reliance\'s RSI?"*',
    '• Calculation: *"₹5,000 per month for 10 years at 12%"*',
  ].join("\n");
}

function noBackendReply(what: string): string {
  return [
    `I can't answer that honestly right now because ${what}.`,
    "",
    "Start the FastAPI backend (`cd backend && uvicorn main:app --port 8000`) and ask again — I never fill the gap with invented numbers.",
  ].join("\n");
}

function renderConcept(entry: KnowledgeEntry, mode: AdvisorPlan["mode"]): string {
  if (mode === "why-concept" && entry.why) {
    return [`**Why it matters — ${entry.title}**`, "", entry.why, "", KNOWLEDGE_PIVOT].join("\n");
  }
  if (mode === "why-concept") {
    return [
      `**${entry.title}**`,
      "",
      entry.gist,
      "",
      'The practical angle: relate it to a real number — ask "What about Reliance?" and I\'ll show this metric on actual data.',
    ].join("\n");
  }
  return [entry.answer, "", KNOWLEDGE_PIVOT].join("\n");
}

function renderStock(plan: AdvisorPlan): string {
  const s = plan.stock!;
  const fmt = currencyOf(s.currency);
  const t = s.technical;
  const p = s.prediction;
  const header = [
    `**${s.name} (${s.symbol})** — ${fmt(s.price)}, ${signed(s.change, 2)} (${pct(s.changePct)})`,
    `_${asOfLine(s)}_`,
  ];
  // Fundamentals are flat nullable fields on Stock (null = provider has no value -> N/A).
  const pe = s.pe;
  const pb = s.pb;
  const roe = s.roe;
  const de = s.debtToEquity;
  const div = s.dividendYield;
  const vol = t.volatility;
  const ret20 = t.return20d;

  switch (plan.field) {
    case "price":
      return [
        ...header,
        "",
        `**52-week range:** ${fmt(s.week52Low)} – ${fmt(s.week52High)}`,
        `Previous close ${fmt(s.price - s.change)} · latest session change ${signed(s.change, 2)} (${pct(s.changePct)}).`,
        "",
        `This is the provider's latest available price (delayed), not a live tick — ${asOfLine(s)}.`,
      ].join("\n");

    case "rsi": {
      const zone =
        t.rsi > 70 ? "overbought" : t.rsi < 30 ? "oversold" : t.rsi >= 50 ? "firm" : "soft/neutral";
      return [
        ...header,
        "",
        `**RSI(14) = ${t.rsi.toFixed(1)}** — ${zone} momentum zone (70+ = overbought, sub-30 = oversold, 40–60 = neutral).`,
        `Latest 1-day return ${pct(t.latestReturn ?? 0)} · 20-session return ${pctOrNull(ret20)}.`,
        "",
        "RSI describes momentum, not direction — it does not predict what happens next. Computed on the backend from real daily closes (Wilder smoothing).",
      ].join("\n");
    }

    case "macd": {
      const above = t.macd >= t.macdSignal;
      const hist = t.macdHistogram;
      const improving = hist.length >= 2 ? hist[hist.length - 1] >= hist[hist.length - 2] : null;
      return [
        ...header,
        "",
        `**MACD ${t.macd.toFixed(2)}** vs signal ${t.macdSignal.toFixed(2)} — **${above ? "above" : "below"} its signal line** (${above ? "positive" : "negative"} momentum).`,
        improving == null
          ? ""
          : `Histogram is ${improving ? "rising (momentum improving)" : "falling (momentum weakening)"} over the last two bars.`,
        `Price vs moving averages: 20-day ${fmt(t.ma20)}, 50-day ${fmt(t.ma50)} — price is ${s.price >= t.ma20 ? "above" : "below"} the 20-day.`,
        "",
        "A MACD crossover confirms a move already under way; it lags, so treat it as a trend gauge rather than a forecast.",
      ].join("\n");
    }

    case "valuation": {
      const mc =
        s.marketCap == null
          ? NA
          : s.currency === "INR"
            ? `₹${(s.marketCap / 1e7).toFixed(0)} Cr`
            : `$${(s.marketCap / 1e9).toFixed(1)}B`;
      return [
        ...header,
        "",
        `• **P/E:** ${num(pe, 1)} · **P/B:** ${num(pb, 2)} · **ROE:** ${pctOrNull(roe)}`,
        `• **Debt/Equity:** ${num(de, 2)} · **Dividend yield:** ${pctOrNull(div)}`,
        `• **Market cap:** ${mc}`,
        "",
        `P/E is what investors pay per ₹1 of current earnings — whether *${s.symbol}* is expensive depends on its growth and peers, not the number alone. Artha's calculated signal on this data is **${p.signal}** (score ${p.score}, strength ${p.signalStrength}/100): ${p.reasons[0] ?? ""}`,
        "",
        "_Fundamentals come from the data provider; missing metrics show as N/A and are never estimated._",
      ].join("\n");
    }

    case "risk":
      return [
        ...header,
        "",
        `• **Realised volatility:** ${vol == null ? NA : vol.toFixed(1) + "% annualised"} → Artha risk label **${s.risk ?? NA}**`,
        `• **Beta:** ${num(s.beta, 2)} · **Debt/Equity:** ${num(de, 2)}`,
        `• **Trend:** price is ${s.price >= t.ma50 ? "above" : "below"} the 50-day average; the 20-day is ${t.sma20Above50 ? "above" : "below"} the 50-day`,
        "",
        "Risk here means *uncertainty of outcomes*, not a prediction of loss. Volatility is computed from one year of real daily returns.",
      ].join("\n");

    case "why": {
      const vTrend = t.volumeTrend;
      return [
        ...header,
        "",
        `**What the measured data shows** (${asOfLine(s)}):`,
        `• Price is ${s.price >= t.ma20 ? "above" : "below"} the 20-day average (${fmt(t.ma20)}) and ${s.price >= t.ma50 ? "above" : "below"} the 50-day (${fmt(t.ma50)}) — short-term trend is ${s.price >= t.ma50 ? "up" : "down"}`,
        `• MACD ${t.macd.toFixed(2)} ${above(t.macd, t.macdSignal)} its signal (${t.macdSignal.toFixed(2)}) — momentum ${above(t.macd, t.macdSignal) === "above" ? "positive" : "negative"}`,
        `• RSI(14) ${t.rsi.toFixed(1)} — ${t.rsi > 70 ? "overbought" : t.rsi < 30 ? "oversold" : t.rsi >= 50 ? "firm" : "soft, not oversold"}`,
        `• Volume: latest ${Math.round(t.volume ?? 0).toLocaleString("en-IN")} vs 20-day avg ${Math.round(t.volumeAvg ?? 0).toLocaleString("en-IN")}${
          vTrend == null ? "" : ` (${vTrend.toFixed(2)}×) — ${vTrend > 1.3 ? "unusually active" : vTrend < 0.7 ? "unusually quiet" : "in line with normal activity"}`
        }`,
        `• 20-session return: ${pctOrNull(ret20)}`,
        "",
        `Artha has **no news feed connected**, so I can't name a specific headline or event — this is what the price, momentum and volume data show. The backend's calculated signal on these same features is **${p.signal}** (score ${p.score}): ${p.reasons[0] ?? ""}`,
        "",
        "_Price moves reflect changing expectations (earnings, rates, sector news, flows). The measured move is factual; the cause usually needs a news source._",
      ].join("\n");
    }

    default: {
      // Full analysis: technicals + fundamentals + the existing signal.
      return [
        ...header,
        "",
        "**Technical (backend-computed):**",
        `• RSI(14) ${t.rsi.toFixed(1)} · MACD ${t.macd.toFixed(2)} (${above(t.macd, t.macdSignal)} signal ${t.macdSignal.toFixed(2)})`,
        `• Price vs 20-day ${fmt(t.ma20)} / 50-day ${fmt(t.ma50)} — ${s.price >= t.ma50 ? "uptrend" : "downtrend"} on this frame${vol == null ? "" : ` · volatility ${vol.toFixed(1)}% p.a.`}`,
        "",
        "**Fundamentals (provider):**",
        `• P/E ${num(pe, 1)} · P/B ${num(pb, 2)} · ROE ${pctOrNull(roe)} · D/E ${num(de, 2)} · Div yield ${pctOrNull(div)}`,
        "",
        `**Artha's signal: ${p.signal}** — model score ${p.score > 0 ? "+" : ""}${p.score}/±100, signal strength ${p.signalStrength}/100 (a heuristic, *not* a probability or accuracy claim). Because:`,
        ...p.reasons.slice(0, 4).map((r, i) => `${i + 1}. ${r}`),
        "",
        "**Risks & caveats:**",
        vol == null ? "" : `• ${vol.toFixed(1)}% annualised volatility means large swings are normal; trends and momentum can reverse quickly`,
        "• The signal is decision support computed from measured features — not a guaranteed outcome, and not investment advice",
        pe == null || roe == null ? "• Some fundamentals are unavailable from the provider (N/A) and were excluded from scoring." : "",
        "",
        `_Open ${s.symbol} on the Research page for the full chart and breakdown._`,
      ]
        .filter((line) => line !== null && line !== undefined)
        .join("\n");
    }
  }
}

/** "above" / "below" helper for MACD phrasing. */
const above = (a: number, b: number) => (a >= b ? "above" : "below");

function renderMarket(plan: AdvisorPlan): string {
  const list = plan.indices ?? [];
  const pick = (needle: string) => list.find((i) => i.symbol.toLowerCase().includes(needle));
  const rows =
    plan.indexEntity === "NIFTY 50"
      ? [pick("nifty")]
      : plan.indexEntity === "SENSEX"
        ? [pick("sensex")]
        : [pick("nifty"), pick("sensex")];
  const shown = (rows.filter(Boolean) as IndexQuote[]).length
    ? (rows.filter(Boolean) as IndexQuote[])
    : list.slice(0, 2);

  const lines: string[] = [];
  for (const i of shown) {
    const fmt = currencyOf(i.currency);
    lines.push(`**${i.name}** — ${fmt(i.value)} (${pct(i.changePct)} on the latest session)`);
  }

  if (plan.field === "why" && plan.sectorMoves?.length) {
    const sorted = [...plan.sectorMoves].sort((a, b) => a.changePct - b.changePct);
    const weak = sorted.slice(0, 3);
    const strong = sorted.slice(-3).reverse();
    lines.push(
      "",
      "**Tracked large caps by sector today** (derived from real prices):",
      `• Weakest: ${weak.map((s) => `${s.sector} ${pct(s.changePct)}`).join(" · ")}`,
      `• Strongest: ${strong.map((s) => `${s.sector} ${pct(s.changePct)}`).join(" · ")}`,
      "",
      "Artha has no news feed, so I can't name the day's catalyst — the sector split above shows where the move actually was.",
    );
  }

  lines.push(
    "",
    `_Latest available index data${list[0]?.source ? ` · ${list[0].source}` : ""} — delayed, not live. Breadth (advances/declines) is N/A on the Markets page because this provider doesn't supply it._`,
  );
  return lines.join("\n");
}

function renderPortfolio(plan: AdvisorPlan): string {
  const { summary, sectors, holdings } = plan.portfolio!;
  const valued = holdings.filter((h) => h.available && h.value != null);
  const head = [
    `**Portfolio value: ${inr(Math.round(summary.totalValue))}** · invested ${inr(Math.round(summary.invested))} · overall ${pct(summary.overallReturnPct)} · today ${signed(Math.round(summary.todayChange))} (${pct(summary.todayChangePct)})`,
    `Cash ${inr(Math.round(summary.availableCash))} · ${holdings.length} positions (${valued.length} priced)`,
  ];

  /* 1. "How much X do I hold?" */
  if (plan.holdingSymbol) {
    const h = holdings.find((x) => x.symbol === plan.holdingSymbol);
    if (!h) {
      return [
        ...head,
        "",
        `You don't hold **${plan.holdingSymbol}** in your demo portfolio.`,
        "",
        "_Holdings are user-entered; prices are latest available from the backend._",
      ].join("\n");
    }
    return [
      ...head,
      "",
      `**${h.symbol} (${h.name})**`,
      `• Quantity ${h.qty} · average cost ${inr(h.avgCost)} · latest price ${h.ltp != null ? inr(h.ltp) : NA}`,
      `• Invested ${inr(Math.round(h.invested))} → value ${h.value != null ? inr(Math.round(h.value)) : NA} · return ${h.returnPct != null ? pct(h.returnPct) : NA} · weight ${h.weightPct.toFixed(1)}%`,
      "",
      "_Valued at the latest available market price — the same source as the Research page._",
    ].join("\n");
  }

  /* 2. "Why is my portfolio down/up?" */
  if (plan.field === "why") {
    const contributors = valued
      .filter((h) => h.dayChange != null)
      .map((h) => ({ symbol: h.symbol, dc: h.dayChange as number, p: h.dayChangePct ?? 0 }))
      .sort((a, b) => a.dc - b.dc);
    const negative = summary.todayChange < 0;
    const top = (negative ? contributors : [...contributors].reverse()).slice(0, 3);
    return [
      ...head,
      "",
      negative
        ? "**What dragged it today** (qty × day change, real prices):"
        : "**What drove it today** (qty × day change):",
      ...top.map((c) => `• ${c.symbol} ${signed(Math.round(c.dc))} (${pct(c.p)} )`.replace(" )", ")")),
      "",
      `Overall day change ${signed(Math.round(summary.todayChange))} (${pct(summary.todayChangePct)}); against your cost basis the portfolio is at ${pct(summary.overallReturnPct)}.`,
      "",
      "_Daily moves reflect market-wide and sector moves; Artha has no news feed to name a specific cause._",
    ].join("\n");
  }

  /* 3. Diversification / concentration / sector questions (default). */
  const sectorLines = sectors.slice(0, 6).map((s) => `• ${s.sector} — ${s.pct.toFixed(1)}%`);
  const topSector = sectors[0];
  const topHolding = valued.slice().sort((a, b) => b.weightPct - a.weightPct)[0];
  const sectorCount = sectors.length;
  const verdict = !topSector
    ? "there is no valued equity to assess yet"
    : topSector.pct >= 50
      ? `**concentrated** — ${topSector.sector} alone is ${topSector.pct.toFixed(1)}% of your equity`
      : topSector.pct >= 35
        ? `**notably tilted** — ${topSector.sector} is ${topSector.pct.toFixed(1)}% of equity (a single sector above ~35% is worth a look)`
        : `**reasonably spread** — your largest sector, ${topSector.sector}, is ${topSector.pct.toFixed(1)}% of equity`;

  const equityValue = valued.reduce((a, h) => a + (h.value ?? 0), 0);
  const illustration =
    topSector && equityValue > 0
      ? `Illustration: a 25% fall in ${topSector.sector} alone, everything else flat, would cost roughly ${inr(
          Math.round(equityValue * (topSector.pct / 100) * 0.25),
        )} of equity value — a scenario, not a forecast.`
      : "";

  return [
    ...head,
    "",
    "**Sector allocation of your equity** (latest available prices):",
    ...sectorLines,
    topHolding
      ? `\n**Largest position:** ${topHolding.symbol} at ${topHolding.weightPct.toFixed(1)}% of equity — ${holdings.length} holdings across ${sectorCount} sectors.`
      : "",
    "",
    `**Diversification read:** your portfolio looks ${verdict}.`,
    "",
    "Why it matters: concentration decides where your returns come from — a single-sector shock hits a concentrated portfolio much harder, while diversification keeps market risk and removes company/sector-specific risk.",
    illustration,
    "",
    "_Positions are user-entered demo holdings; all values are computed by the backend from real prices._",
  ].join("\n");
}

function renderCalc(plan: AdvisorPlan): string {
  if (plan.calcResult && plan.calcRequest) {
    return formatCalculation(plan.calcRequest, plan.calcResult);
  }
  if (plan.calc?.missing.length) return missingInputsReply(plan.calc.missing);
  return missingInputsReply(["amount", "expected return rate (%)", "time horizon (years)"]);
}

/** Build the final reply when no LLM is configured (the default mode). */
export function renderLocal(plan: AdvisorPlan): AdvisorReply {
  if (plan.dataError) return { text: noBackendReply(plan.dataError) };
  if (plan.direct) return { text: plan.direct };

  if (plan.calc) return { text: renderCalc(plan) };
  if (plan.compare) return { text: compareEntries(plan.compare[0], plan.compare[1]) };
  if (plan.entry) return { text: renderConcept(plan.entry, plan.mode) };
  if (plan.stock) return { text: renderStock(plan), structured: quickStructuredAnswer(plan.stock) };
  if (plan.portfolio) return { text: renderPortfolio(plan) };
  if (plan.indices) return { text: renderMarket(plan) };

  return { text: fallbackReply() };
}

/* -------------------------------------------------------------------------- */
/*  LLM context — only the data this intent actually needs                     */
/* -------------------------------------------------------------------------- */

export function buildLlmContext(plan: AdvisorPlan): Record<string, unknown> | null {
  if (plan.dataError) return null;

  if (plan.stock) {
    const s = plan.stock;
    const t = s.technical;
    return {
      stock: {
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        change: s.change,
        changePct: s.changePct,
        timestamp: s.timestamp,
        source: s.source,
        week52High: s.week52High,
        week52Low: s.week52Low,
        pe: s.pe,
        pb: s.pb,
        roe: s.roe,
        debtToEquity: s.debtToEquity,
        dividendYield: s.dividendYield,
        marketCap: s.marketCap,
        risk: s.risk,
        rsi: t.rsi,
        macd: t.macd,
        macdSignal: t.macdSignal,
        sma20: t.ma20,
        sma50: t.ma50,
        volatility: t.volatility,
        return20d: t.return20d,
        recommendation: {
          signal: s.prediction.signal,
          score: s.prediction.score,
          signalStrength: s.prediction.signalStrength,
          reasons: s.prediction.reasons,
        },
        requested_aspect: plan.field,
      },
    };
  }

  if (plan.portfolio) {
    const { summary, sectors, holdings } = plan.portfolio;
    return {
      portfolio: {
        totalValue: summary.totalValue,
        invested: summary.invested,
        overallReturnPct: summary.overallReturnPct,
        todayChange: summary.todayChange,
        todayChangePct: summary.todayChangePct,
        cash: summary.availableCash,
        sectorAllocation: sectors,
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          qty: h.qty,
          avgCost: h.avgCost,
          value: h.value,
          weightPct: h.weightPct,
          returnPct: h.returnPct,
        })),
        note: "Positions are user-entered demo holdings; prices are latest available from the data provider.",
      },
    };
  }

  if (plan.calcResult && plan.calcRequest) {
    return {
      calculation: {
        kind: plan.calcResult.kind,
        inputs: plan.calcResult.inputs,
        results: plan.calcResult.results,
        formula: plan.calcResult.formula,
        note: "Computed exactly by the backend calculation engine — do not recompute or alter these numbers.",
      },
    };
  }

  if (plan.indices) {
    return {
      market: {
        indices: plan.indices.slice(0, 4).map((i) => ({
          symbol: i.symbol,
          value: i.value,
          changePct: i.changePct,
          timestamp: i.timestamp,
        })),
        sectorMoves: (plan.sectorMoves ?? []).slice(0, 6),
        note: "Latest available (delayed) data. Breadth unavailable from this provider.",
      },
    };
  }

  if (plan.entry || plan.compare) return null; // concept questions: LLM's own knowledge

  return null;
}
