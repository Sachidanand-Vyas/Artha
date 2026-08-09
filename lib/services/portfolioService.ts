import type {
  AllocationSlice,
  Goal,
  Holding,
  PortfolioSummary,
  SectorSlice,
  Transaction,
} from "@/lib/types";
import {
  allocation,
  analytics,
  cashBalance,
  goals,
  holdings,
  portfolioSummary,
  sectorSlices,
  transactions,
} from "@/lib/mock/portfolio";
import { delay } from "@/lib/services/delay";

export interface PortfolioService {
  getSummary(): Promise<PortfolioSummary>;
  getHoldings(): Promise<Holding[]>;
  getAllocation(): Promise<AllocationSlice[]>;
  getSectorAllocation(): Promise<SectorSlice[]>;
  getTransactions(): Promise<Transaction[]>;
  getGoals(): Promise<Goal[]>;
  getCash(): Promise<number>;
}

export const portfolioService: PortfolioService = {
  async getSummary() {
    await delay(340);
    return portfolioSummary;
  },
  async getHoldings() {
    await delay(300);
    return holdings;
  },
  async getAllocation() {
    await delay(260);
    return allocation;
  },
  async getSectorAllocation() {
    await delay(240);
    return sectorSlices;
  },
  async getTransactions() {
    await delay(300);
    return transactions;
  },
  async getGoals() {
    await delay(240);
    return goals;
  },
  async getCash() {
    await delay(160);
    return cashBalance;
  },
};

export { analytics as portfolioAnalytics };
