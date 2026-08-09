import type { IndexQuote } from "@/lib/types";
import { randomWalk } from "@/lib/utils";

export const indices: IndexQuote[] = [
  {
    symbol: "NIFTY 50",
    name: "NIFTY 50",
    exchange: "NSE",
    value: 24862.35,
    change: 132.45,
    changePct: 0.54,
    spark: randomWalk(11, 40, 24300, 0.0004, 0.004),
    currency: "INR",
    market: "INDIA",
  },
  {
    symbol: "SENSEX",
    name: "BSE SENSEX",
    exchange: "BSE",
    value: 81540.2,
    change: 384.9,
    changePct: 0.47,
    spark: randomWalk(12, 40, 79800, 0.0004, 0.0038),
    currency: "INR",
    market: "INDIA",
  },
  {
    symbol: "NASDAQ",
    name: "NASDAQ Composite",
    exchange: "NASDAQ",
    value: 18426.7,
    change: -58.4,
    changePct: -0.32,
    spark: randomWalk(13, 40, 18550, -0.0002, 0.006),
    currency: "USD",
    market: "GLOBAL",
  },
  {
    symbol: "S&P 500",
    name: "S&P 500",
    exchange: "NYSE",
    value: 5612.1,
    change: 9.8,
    changePct: 0.18,
    spark: randomWalk(14, 40, 5590, 0.0001, 0.0032),
    currency: "USD",
    market: "GLOBAL",
  },
  {
    symbol: "GOLD",
    name: "Gold (MCX)",
    exchange: "MCX",
    value: 71920.0,
    change: 245.0,
    changePct: 0.34,
    spark: randomWalk(15, 40, 70800, 0.0003, 0.0028),
    currency: "INR",
    market: "INDIA",
  },
  {
    symbol: "USD/INR",
    name: "US Dollar / INR",
    exchange: "FX",
    value: 83.78,
    change: -0.12,
    changePct: -0.14,
    spark: randomWalk(16, 40, 83.9, -0.0001, 0.0016),
    currency: "INR",
    market: "GLOBAL",
  },
];

/** Sample sectors — India-focused, clearly labeled as illustrative. */
export const sectorPerformance: { sector: string; changePct: number }[] = [
  { sector: "IT", changePct: 1.42 },
  { sector: "Banking", changePct: 0.86 },
  { sector: "Energy", changePct: 0.64 },
  { sector: "Metals", changePct: 0.41 },
  { sector: "Infra", changePct: 0.22 },
  { sector: "Auto", changePct: -0.18 },
  { sector: "FMCG", changePct: -0.34 },
  { sector: "Realty", changePct: -0.62 },
  { sector: "Pharma", changePct: -0.81 },
  { sector: "Consumer", changePct: -1.05 },
];

export const marketBreadth = { advances: 1842, declines: 1418, unchanged: 214 };
