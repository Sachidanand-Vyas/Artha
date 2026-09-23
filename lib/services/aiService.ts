import type { AdvisorStructured, Stock, StockQa } from "@/lib/types";
import { compareWithPeer, quickStructuredAnswer, stockQa, type StockQaContext } from "@/lib/mock/ai";
import { portfolioService, PortfolioNotSetupError } from "@/lib/services/portfolioService";
import {
  buildLlmContext,
  planReply,
  renderLocal,
  type AdvisorReply,
  type AdvisorTurn,
} from "@/lib/advisor/orchestrator";
import { askLlm } from "@/lib/advisor/llm";
import { stockService } from "@/lib/services/stockService";
import { delay } from "@/lib/services/delay";

/**
 * AI SERVICE INTERFACE
 * --------------------
 * Every AI surface in the UI goes through this interface.
 *
 * `getAdvisorReply` is a GENERAL finance assistant orchestration layer
 * (see lib/advisor/): intent + entity + conversation-context detection
 * routes each question to the finance knowledge base, the stock service,
 * the portfolio service, the market service, or the backend calculation
 * engine — always the existing Artha services, never a duplicate engine.
 *
 * When an LLM is configured through env (see lib/advisor/llm.ts) it only * FORMATS the answer from the data collected for that intent; without one,
 * a local renderer writes it from the same numbers. Either way, market
 * prices, portfolio values and calculations are never invented.
 */
export interface AiService {
  /** Free-form chat for the AI Advisor. `history` = prior turns (follow-up context). */
  getAdvisorReply(prompt: string, history?: AdvisorTurn[]): Promise<AdvisorReply>;
  /** Q&A for a specific stock on research pages. */
  askAboutStock(symbol: string, question: string): Promise<StockQa>;
  /** Pre-built structured analysis for a stock. */
  getStockAnalysis(symbol: string): Promise<AdvisorStructured>;
  /** Side-by-side comparison with a peer stock. */
  compareStocks(symbol: string): Promise<StockQa>;
}

const engineDelay = () => delay(400 + Math.random() * 400);

/** Tidy LLM output: strip fences / wrapping quotes some providers add. */
const cleanLlmText = (raw: string): string => {
  let t = raw.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("“") && t.endsWith("”"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
};

/** Backend analysis -> undefined means the symbol has no data (404/unknown). */
const loadStock = (symbol: string): Promise<Stock | undefined> =>
  stockService.getStock(symbol).catch(() => undefined);

/** Real portfolio context for answers that reference what the user holds. */
const loadPortfolioContext = async (): Promise<StockQaContext> => {
  try {
    const sectors = await portfolioService.getSectorAllocation();
    return { hasPortfolio: true, sectors };
  } catch (e) {
    if (e instanceof PortfolioNotSetupError) return { hasPortfolio: false, sectors: [] };
    return { hasPortfolio: false, sectors: [] }; // backend down: no claims either way
  }
};

const noData = (symbol: string, question: string): StockQa => ({
  question,
  answer: `I could not load market data for **${symbol}**, so I would rather not guess. The recommendation and explanation for this stock are computed on the backend from its actual price history — if the data provider has no coverage, there is nothing to analyse yet.`,
  points: [
    "Check the symbol (e.g. RELIANCE, TCS, INFY on NSE)",
    "Make sure the FastAPI backend is running",
  ],
});

export const aiService: AiService = {
  async getAdvisorReply(prompt, history = []) {
    // 1. Route: knowledge / stock / portfolio / market / calculation,
    //    with conversation context for follow-ups ("Why?", "What about TCS?").
    const plan = await planReply(prompt, history);
    // 2. The local renderer always produces an honest answer from real data
    //    — it is the default mode and the fallback whenever the LLM is off.
    const local = renderLocal(plan);
    // 3. Optional LLM formatting: askLlm posts to the backend (/api/advisor/answer),
    //    which returns null unless a provider is configured in backend/.env.
    //    It only rephrases — the structured context carries every number and
    //    the system prompt forbids fabricating data or doing loose arithmetic.
    const llmText = await askLlm({
      question: prompt,
      history: history.map((h) => ({ role: h.role, content: h.text })),
      context: buildLlmContext(plan),
      intent: plan.intent,
    });
    const text = llmText ? cleanLlmText(llmText) : "";
    if (text) return { text, structured: local.structured };
    return local; // not configured / provider failed / empty output
  },
  async askAboutStock(symbol, question) {
    const stock = await loadStock(symbol);
    const ctx = await loadPortfolioContext();
    await engineDelay();
    if (!stock) return noData(symbol, question);
    return stockQa(stock, question, ctx);
  },
  async getStockAnalysis(symbol): Promise<AdvisorStructured> {
    const stock = await loadStock(symbol);
    await engineDelay();
    if (!stock) {
      return {
        risk: `No market data available for ${symbol} right now — nothing has been assumed.`,
        upside: "Upside estimates require real earnings and price history; both are unavailable for this symbol.",
        impact: "Without data, this symbol cannot be placed in your sector mix.",
        concerns: [
          "The data provider returned no history for this symbol",
          "No values are shown because none were measured",
        ],
        learn: "Open Research on a covered symbol (e.g. RELIANCE) to see a full analysis.",
      };
    }
    return quickStructuredAnswer(stock);
  },
  async compareStocks(symbol) {
    const stock = await loadStock(symbol);
    if (!stock) {
      await engineDelay();
      return noData(symbol, `Compare ${symbol} with a peer`);
    }
    // Peer comes from the same backend universe, so both sides are real data.
    const universe = await stockService.getStocks().catch(() => [] as Stock[]);
    await engineDelay();
    const peer =
      universe.find(
        (x) => x.symbol !== stock.symbol && x.sector === stock.sector && x.country === stock.country,
      ) ?? universe.find((x) => x.symbol !== stock.symbol && x.country === stock.country);
    if (!peer) {
      return {
        question: `Compare ${stock.symbol} with a peer`,
        answer: `No peer from the same sector is available in the tracked universe, so a like-for-like comparison is not possible right now.`,
        points: ["Comparisons are only made between stocks from the same provider universe"],
      };
    }
    return compareWithPeer(stock, peer);
  },
};
