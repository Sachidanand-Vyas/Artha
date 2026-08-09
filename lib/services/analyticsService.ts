import type { AnalyticsMetrics } from "@/lib/types";
import { analytics } from "@/lib/mock/portfolio";
import { delay } from "@/lib/services/delay";
import { mulberry32 } from "@/lib/utils";

export interface MonteCarloParams {
  initial: number;
  monthly: number;
  years: number;
  meanReturn: number; // annualised, e.g. 0.11
  volatility: number; // annualised, e.g. 0.14
  iterations: number;
  seed?: number;
}

export interface MonteCarloResult {
  simulations: number[]; // terminal values
  median: number;
  p10: number;
  p90: number;
}

export interface AnalyticsService {
  getMetrics(): Promise<AnalyticsMetrics>;
  /** Geometric Brownian-motion Monte Carlo — real math on sample parameters. */
  runMonteCarlo(params: MonteCarloParams): Promise<MonteCarloResult>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

export const analyticsService: AnalyticsService = {
  async getMetrics() {
    await delay(300);
    return analytics;
  },
  async runMonteCarlo(params) {
    await delay(500);
    const { initial, monthly, years, meanReturn, volatility, iterations, seed } = params;
    const rnd = mulberry32(seed ?? 2026);
    const n = Math.round(years * 12);
    const dt = 1 / 12;
    const mu = meanReturn - 0.5 * volatility * volatility;
    const sigma = volatility * Math.sqrt(dt);
    const out: number[] = [];

    for (let i = 0; i < iterations; i++) {
      let v = initial;
      for (let m = 0; m < n; m++) {
        const z = (() => {
          // Box–Muller
          const u1 = Math.max(rnd(), 1e-9);
          const u2 = rnd();
          return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        })();
        v = v * Math.exp(mu * dt + sigma * z) + monthly;
      }
      out.push(v);
    }
    out.sort((a, b) => a - b);
    const median = percentile(out, 50);
    const p10 = percentile(out, 10);
    const p90 = percentile(out, 90);

    return {
      simulations: out,
      median,
      p10,
      p90,
    };
  },
};
