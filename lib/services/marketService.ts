import type { IndexQuote } from "@/lib/types";
import { indices, marketBreadth, sectorPerformance } from "@/lib/mock/markets";
import { delay } from "@/lib/services/delay";

export interface MarketService {
  /** Major indices & indicators (NIFTY, SENSEX, NASDAQ, …). */
  getIndices(): Promise<IndexQuote[]>;
  /** Advances / declines / unchanged. */
  getBreadth(): Promise<{ advances: number; declines: number; unchanged: number }>;
  /** Sector-level performance for the day. */
  getSectorPerformance(): Promise<{ sector: string; changePct: number }[]>;
}

export const marketService: MarketService = {
  async getIndices() {
    await delay(320);
    return indices;
  },
  async getBreadth() {
    await delay(260);
    return marketBreadth;
  },
  async getSectorPerformance() {
    await delay(280);
    return sectorPerformance;
  },
};
