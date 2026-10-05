/* ------------------------------------------------------------------ */
/*  ARTHA — shared domain types                                        */
/* ------------------------------------------------------------------ */

export type Trend = "up" | "down" | "flat";
export type Currency = "INR" | "USD";
export type RiskLevel = "Low" | "Moderate" | "High";

/**
 * One hit from the dynamic stock search (GET /api/stocks/search).
 * `symbol` is the display symbol Artha navigates with; `ticker` is the
 * provider ticker (Yahoo) that Research/Trade flows execute against.
 */
export interface StockSearchResult {
  symbol: string;
  ticker: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  quote_type?: string;
}

/**
 * Latest available quote for one instrument (native price + currency + FX).
 * Refreshed independently from historical charts/fundamentals.
 * `timestamp` is the provider's bar time — never invented by the client.
 */
export interface Quote {
  symbol: string;
  ticker: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  sector?: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  timestamp: string | null;
  /** Current INR rate: INR per 1 unit of `currency` (1 for INR, null if FX unavailable). */
  fxRate: number | null;
  available: boolean;
  source: string;
  error?: string | null;
}

export interface IndexQuote {
  symbol: string;
  name: string;
  exchange: string;
  value: number;
  change: number;
  changePct: number;
  spark: number[];
  currency: Currency;
  market: "INDIA" | "GLOBAL";
  /** ISO timestamp of the latest available bar/quote, when supplied. */
  timestamp?: string;
  /** Data provider name (e.g. "Yahoo Finance"). */
  source?: string;
}

/**
 * A tracked stock.
 *
 * `null` on any fundamental/risk field means the data provider does not
 * expose it — the UI must render "N/A", never an invented number.
 */
export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  sector: string;
  currency: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  roce: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  eps: number | null;
  revenue: number | null;
  netProfit: number | null;
  /** null when unknown (e.g. a dynamically discovered symbol without a range). */
  week52High: number | null;
  week52Low: number | null;
  risk: RiskLevel | null;
  beta: number | null;
  insight: string;
  summary: string;
  /** ISO timestamp of the latest available market data. */
  timestamp?: string;
  /** Data provider name. */
  source?: string;
}

/** BUY/HOLD/SELL output of the backend recommendation model. */
export interface StockPrediction {
  signal: "BUY" | "HOLD" | "SELL";
  /** Weighted feature score in [-100, +100]. */
  score: number;
  /** |score| — a heuristic strength, NOT a calibrated probability. */
  signalStrength: number;
  /** Reasons generated from the actual indicator/fundamental values. */
  reasons: string[];
  model: string;
  generatedAt: string;
}

/** Full analysis payload from GET /api/stocks/{symbol}. */
export interface StockAnalysis extends Stock {
  technical: Technicals;
  prediction: StockPrediction;
}

/** Market breadth; `available: false` means the provider cannot supply it. */
export interface MarketBreadth {
  advances: number | null;
  declines: number | null;
  unchanged: number | null;
  available: boolean;
  note?: string;
}

export type TimeRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y";

export interface Technicals {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number[];
  support: number;
  resistance: number;
  ma20: number;
  ma50: number;
  ma200: number;
  sma20Above50: boolean;
  volumeAvg: number;
  /* Extra backend-computed values (used by the Advisor; always from real OHLCV) */
  ema20?: number;
  volatility?: number;   // annualised % of daily returns
  volume?: number;       // latest bar volume
  volumeTrend?: number;  // 5-bar avg / 20-bar avg
  latestReturn?: number; // last 1-day return, %
  return20d?: number;    // 20-session return, %
}

/* ---------------------------- Portfolio ---------------------------- */

export interface PortfolioSummary {
  totalValue: number;
  /** Cost basis of the currently-held, priceable shares. */
  invested: number;
  availableCash: number;
  todayChange: number;
  todayChangePct: number;
  /* --- Four DISTINCT P&L metrics — never interchanged --- */
  /** totalValue − capitalBase (all capital you added: ₹1,00,000 virtual + imports). */
  totalPnl: number;
  totalReturnPct: number;
  /** Open gain/loss on positions you still hold: market value − cost basis. */
  unrealizedPnl: number;
  unrealizedReturnPct: number;
  /** Closed positions: proceeds − average cost, replayed from transactions. */
  realizedPnl: number;
  /** Initial virtual capital + manually imported cost basis. */
  capitalBase: number;
  /** False when at least one holding could not be priced right now. */
  allPriced: boolean;
  /** ISO time of the quotes used for this valuation (null when none). */
  pricesAt: string | null;
}

/** One point of the real cost-basis history derived from transactions. */
export interface HistoryPoint {
  time: number;
  value: number;
}

export interface Holding {
  symbol: string;
  name: string;
  /** Provider sector ("Other" when unavailable). */
  sector: string;
  country?: string;
  /** Native quote currency of avgCost/ltp (INR for Indian stocks). */
  currency: string;
  qty: number;
  /** Average buy price in the security's NATIVE currency. */
  avgCost: number;
  /** Stored INR cost basis per share (captured with the FX rate at execution). */
  avgCostInr?: number | null;
  /** Latest available price — native currency; null when the quote could not be fetched. */
  ltp: number | null;
  /** Current INR rate for this currency (1 for INR). */
  fxRate?: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  /** INR cost basis: qty × stored INR avg cost. */
  invested: number;
  /** INR market value: qty × ltp × current FX — null when the quote could not be fetched. */
  value: number | null;
  /** Unrealized P&L in rupees: value − invested (null when unpriced). */
  pnl: number | null;
  returnPct: number | null;
  weightPct: number;
  /** false when the provider returned no price (or no FX rate) for this holding. */
  available: boolean;
}

export interface AllocationSlice {
  label: string;
  value: number; // absolute rupees
  pct: number;
}

export interface SectorSlice {
  sector: string;
  pct: number;
}

export interface Transaction {
  id: string;
  date: string;
  symbol: string;
  name: string;
  type: "BUY" | "SELL";
  qty: number;
  /** Execution price in the security's NATIVE currency. */
  price: number;
  /** INR value at execution (qty × price × FX rate used then). */
  amount: number;
  /** Native currency of `price` ("INR" for Indian stocks). */
  currency: string;
  /** INR rate captured at execution time. */
  fxRate: number;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  saved: number;
  deadline: string; // "2028"
  pct: number;
}

export interface AnalyticsMetrics {
  sharpe: number;
  sortino: number;
  var95: number;
  maxDrawdown: number;
  volatility: number;
  beta: number;
  alpha: number;
  riskScore: number;
  riskLabel: "Conservative" | "Moderate" | "Aggressive";
  diversification: number;
  liquidity: number;
  concentration: number;
}

/* ------------------------------ Insights ---------------------------- */

export interface AiInsight {
  id: string;
  tag: string;
  title: string;
  insight: string;
  why: string;
  action: string;
  caveat: string;
}

/* ------------------------------- News ------------------------------- */

export type NewsCategory = "Market" | "Company" | "Economy" | "Global";

/**
 * One REAL headline aggregated by the backend (GET /api/news) from trusted
 * publishers' official RSS feeds. There is no mock variant of this type:
 * when providers fail, the request errors instead of returning articles.
 */
export interface NewsArticle {
  id: string;
  title: string;
  /** Publisher name (e.g. "Economic Times") — always rendered on the card. */
  source: string;
  /** ORIGINAL article URL — "Read full article" opens this. */
  url: string;
  /** Epoch ms of the publisher's publication time (from the feed). */
  publishedAt: number;
  category: NewsCategory;
  /** Publisher-provided excerpt; empty string when the feed gives none. */
  description: string;
  /** Feed-provided image when legitimately present (may be null). */
  image?: string | null;
  /** Best-effort association with tracked symbols (may be empty). */
  tickers?: string[];
}

/* ------------------------------ Learning ---------------------------- */

export interface LearningCategory {
  id: string;
  name: string;
  description: string;
}

export interface LessonSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface LessonQuiz {
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface Lesson {
  slug: string;
  title: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  readMinutes: number;
  progress: number;
  summary: string;
  sections: LessonSection[];
  quiz: LessonQuiz[];
}

export interface ScenarioOption {
  id: "A" | "B" | "C";
  name: string;
  expectedReturn: string;
  risk: string;
  composition: string;
  outcome: string;
  tradeoffs: string;
}

export interface InvestmentScenario {
  id: string;
  title: string;
  prompt: string;
  options: ScenarioOption[];
  lesson: string;
}

/* ------------------------------- Advisor ---------------------------- */

export interface AdvisorStructured {
  risk: string;
  upside: string;
  impact: string;
  concerns: string[];
  learn: string;
}

export interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  structured?: AdvisorStructured;
  ts: number;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: AdvisorMessage[];
}

export interface StockQa {
  question: string;
  answer: string;
  points?: string[];
}
