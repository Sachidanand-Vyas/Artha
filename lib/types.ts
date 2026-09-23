/* ------------------------------------------------------------------ */
/*  ARTHA — shared domain types                                        */
/* ------------------------------------------------------------------ */

export type Trend = "up" | "down" | "flat";
export type Currency = "INR" | "USD";
export type RiskLevel = "Low" | "Moderate" | "High";

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
  country: "IN" | "US";
  sector: string;
  currency: Currency;
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
  week52High: number;
  week52Low: number;
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
  invested: number;
  availableCash: number;
  todayChange: number;
  todayChangePct: number;
  overallReturn: number;
  overallReturnPct: number;
  dayHistory: number[];
  valueHistory: { time: number; value: number; benchmark: number }[];
}

export interface Holding {
  symbol: string;
  name: string;
  qty: number;
  avgCost: number;
  /** Latest available price — null when the quote could not be fetched. */
  ltp: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  invested: number;
  /** qty × ltp — null when the quote could not be fetched. */
  value: number | null;
  returnPct: number | null;
  weightPct: number;
  /** false when the provider returned no price for this holding. */
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
  price: number;
  amount: number;
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
export type Sentiment = "Positive" | "Neutral" | "Negative";

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  publishedAt: number;
  category: NewsCategory;
  sentiment: Sentiment;
  sentimentScore: number; // -1..1
  aiSummary: string;
  related: string[];
  featured?: boolean;
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
