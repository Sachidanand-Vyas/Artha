import type { AdvisorStructured, Stock, StockQa } from "@/lib/types";
import {
  advisorReply,
  compareWithPeer,
  quickStructuredAnswer,
  stockQa,
  type AdvisorReply as MockAdvisorReply,
} from "@/lib/mock/ai";
import { getStock } from "@/lib/mock/stocks";
import { delay } from "@/lib/services/delay";

/**
 * AI SERVICE INTERFACE
 * --------------------
 * Every AI surface in the UI goes through this interface. Today it is
 * backed by a deterministic, rule-based demo engine (see lib/mock/ai).
 * Later a real LLM/agent backend can implement the same interface
 * without changing any component.
 */
export interface AiService {
  /** Free-form chat used by the AI Advisor. Returns text + structured sections. */
  getAdvisorReply(prompt: string): Promise<MockAdvisorReply>;
  /** Q&A for a specific stock on research pages. */
  askAboutStock(symbol: string, question: string): Promise<StockQa>;
  /** Pre-built structured analysis for a stock. */
  getStockAnalysis(symbol: string): Promise<AdvisorStructured>;
  /** Side-by-side comparison with a peer stock. */
  compareStocks(symbol: string): Promise<StockQa>;
}

const engineDelay = () => delay(700 + Math.random() * 600);

export const aiService: AiService = {
  async getAdvisorReply(prompt) {
    await engineDelay();
    return advisorReply(prompt);
  },
  async askAboutStock(symbol, question) {
    await engineDelay();
    const stock = getStock(symbol)!;
    return stockQa(stock, question);
  },
  async getStockAnalysis(symbol) {
    await engineDelay();
    return quickStructuredAnswer(getStock(symbol)!);
  },
  async compareStocks(symbol) {
    await engineDelay();
    return compareWithPeer(getStock(symbol)!);
  },
};

/** Small helper used by the research page to build a context snapshot. */
export const resolveStock = (symbol: string): Stock | undefined => getStock(symbol);
