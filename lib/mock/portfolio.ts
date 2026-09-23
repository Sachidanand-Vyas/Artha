import type { Goal, Transaction, AnalyticsMetrics } from "@/lib/types";

/**
 * Clearly-labelled DEMO / user data.
 *
 * Prices, valuations and allocations do NOT live here any more — they come
 * from the FastAPI backend through portfolioService (one source of truth).
 * What remains: user-entered goals, a demo activity log, a demo cash balance
 * and the educational risk-analytics table.
 */

export const cashBalance = 86420;

export const analytics: AnalyticsMetrics = {
  sharpe: 1.42,
  sortino: 1.96,
  var95: -4.8,
  maxDrawdown: -14.2,
  volatility: 12.8,
  beta: 0.92,
  alpha: 3.4,
  riskScore: 62,
  riskLabel: "Moderate",
  diversification: 74,
  liquidity: 68,
  concentration: 38,
};

/** Demo activity log (no broker integration at this stage). */
export const transactions: Transaction[] = [
  { id: "t1", date: "2026-08-04", symbol: "RELIANCE", name: "Reliance Industries", type: "BUY", qty: 5, price: 2942, amount: 14710 },
  { id: "t2", date: "2026-07-21", symbol: "NVDA", name: "NVIDIA", type: "BUY", qty: 3, price: 118.2, amount: 29720 },
  { id: "t3", date: "2026-07-09", symbol: "HDFCBANK", name: "HDFC Bank", type: "BUY", qty: 10, price: 1671, amount: 16710 },
  { id: "t4", date: "2026-06-18", symbol: "SBIN", name: "State Bank of India", type: "BUY", qty: 20, price: 796, amount: 15920 },
  { id: "t5", date: "2026-06-02", symbol: "INFY", name: "Infosys", type: "SELL", qty: 10, price: 1704, amount: 17040 },
  { id: "t6", date: "2026-05-14", symbol: "TCS", name: "Tata Consultancy Services", type: "BUY", qty: 3, price: 3880, amount: 11640 },
  { id: "t7", date: "2026-04-28", symbol: "MSFT", name: "Microsoft", type: "BUY", qty: 2, price: 342, amount: 57300 },
  { id: "t8", date: "2026-04-09", symbol: "ICICIBANK", name: "ICICI Bank", type: "BUY", qty: 15, price: 1185, amount: 17775 },
];

/** User goals (entered by the user, not market data). */
export const goals: Goal[] = [
  { id: "g1", title: "Emergency Fund", target: 600000, saved: 420000, deadline: "2027", pct: 70 },
  { id: "g2", title: "House Down Payment", target: 2500000, saved: 800000, deadline: "2029", pct: 32 },
  { id: "g3", title: "Retirement Corpus", target: 20000000, saved: 18000000, deadline: "2045", pct: 9 },
  { id: "g4", title: "Kids' Higher Education", target: 4000000, saved: 620000, deadline: "2035", pct: 16 },
];
