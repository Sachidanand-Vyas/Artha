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
}

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
  marketCap: number;
  pe: number | null;
  pb: number;
  roe: number;
  roce: number | null;
  debtToEquity: number | null;
  dividendYield: number;
  eps: number;
  revenue: number;
  netProfit: number;
  week52High: number;
  week52Low: number;
  risk: RiskLevel;
  beta: number;
  insight: string;
  summary: string;
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
  ltp: number;
  dayChange: number;
  dayChangePct: number;
  invested: number;
  value: number;
  returnPct: number;
  weightPct: number;
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
