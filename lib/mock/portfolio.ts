import type {
  AllocationSlice,
  AnalyticsMetrics,
  Goal,
  Holding,
  PortfolioSummary,
  SectorSlice,
  Transaction,
} from "@/lib/types";
import { getStock } from "@/lib/mock/stocks";
import { randomWalk } from "@/lib/utils";

/* Holdings are derived from the stock universe so prices stay consistent. */

interface HoldingSeed {
  symbol: string;
  qty: number;
  avgCost: number;
}

const seeds: HoldingSeed[] = [
  { symbol: "RELIANCE", qty: 40, avgCost: 2380 },
  { symbol: "TCS", qty: 25, avgCost: 3180 },
  { symbol: "HDFCBANK", qty: 60, avgCost: 1442 },
  { symbol: "INFY", qty: 80, avgCost: 1352 },
  { symbol: "ICICIBANK", qty: 100, avgCost: 982 },
  { symbol: "SBIN", qty: 120, avgCost: 698 },
  { symbol: "LT", qty: 15, avgCost: 2965 },
  { symbol: "NVDA", qty: 12, avgCost: 84.5 },
  { symbol: "MSFT", qty: 6, avgCost: 331 },
];

export const holdings: Holding[] = seeds.map((s) => {
  const stock = getStock(s.symbol)!;
  const ltp = stock.currency === "INR" ? stock.price : stock.price * 83.78; // convert USD → INR
  const invested = s.qty * s.avgCost;
  const value = s.qty * ltp;
  const dayChangePct = stock.changePct;
  return {
    symbol: s.symbol,
    name: stock.name,
    qty: s.qty,
    avgCost: s.avgCost,
    ltp,
    dayChange: value * (dayChangePct / 100),
    dayChangePct,
    invested,
    value,
    returnPct: ((value - invested) / invested) * 100,
    weightPct: 0, // filled below once totals are known
  };
});

const equityValue = holdings.reduce((a, h) => a + h.value, 0);

export const cashBalance = 86420;
export const goldValue = 252000;
export const debtValue = 368000;

const totalValue = equityValue + cashBalance + goldValue + debtValue;

holdings.forEach((h) => {
  h.weightPct = (h.value / equityValue) * 100;
});

/* Allocation slices (of total portfolio) */
export const allocation: AllocationSlice[] = [
  { label: "Equity — India", value: equityValue * 0.88, pct: Math.round(((equityValue * 0.88) / totalValue) * 100) },
  { label: "Equity — US", value: equityValue * 0.12, pct: Math.round(((equityValue * 0.12) / totalValue) * 100) },
  { label: "Debt", value: debtValue, pct: Math.round((debtValue / totalValue) * 100) },
  { label: "Gold", value: goldValue, pct: Math.round((goldValue / totalValue) * 100) },
  { label: "Cash", value: cashBalance, pct: Math.round((cashBalance / totalValue) * 100) },
];

export const sectorSlices: SectorSlice[] = [
  { sector: "IT Services", pct: 28.2 },
  { sector: "Banking & NBFC", pct: 26.4 },
  { sector: "US Technology", pct: 12.6 },
  { sector: "Energy", pct: 11.2 },
  { sector: "Infrastructure", pct: 7.4 },
  { sector: "Other", pct: 14.2 },
];

/* 24-month value history vs a benchmark (normalised to the same start). */
const raw = randomWalk(41, 24, 2150000, 0.012, 0.03);
const bench = randomWalk(42, 24, 2150000, 0.010, 0.035);
const scale = (arr: number[], target: number) => {
  const last = arr[arr.length - 1];
  return arr.map((v) => (v / last) * target);
};
const valueSeries = scale(raw, totalValue);
const benchSeries = scale(bench, totalValue);
const now = Date.now();
const MONTH = 30 * 24 * 3600 * 1000;

export const portfolioSummary: PortfolioSummary = {
  totalValue,
  invested: equityValue * 0.86,
  availableCash: cashBalance,
  todayChange: 12450,
  todayChangePct: 0.43,
  overallReturn: totalValue * 0.18 - 0, // derived below
  overallReturnPct: 18.4,
  dayHistory: randomWalk(43, 30, totalValue * 0.995, 0.0002, 0.0022),
  valueHistory: valueSeries.map((value, i) => ({
    time: now - (24 - i) * MONTH,
    value,
    benchmark: benchSeries[i],
  })),
};

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

export const goals: Goal[] = [
  { id: "g1", title: "Emergency Fund", target: 600000, saved: 420000, deadline: "2027", pct: 70 },
  { id: "g2", title: "House Down Payment", target: 2500000, saved: 800000, deadline: "2029", pct: 32 },
  { id: "g3", title: "Retirement Corpus", target: 20000000, saved: 1800000, deadline: "2045", pct: 9 },
  { id: "g4", title: "Kids' Higher Education", target: 4000000, saved: 620000, deadline: "2035", pct: 16 },
];
