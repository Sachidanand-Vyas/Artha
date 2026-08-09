import type { NewsArticle } from "@/lib/types";

const H = 3600 * 1000;

export const newsArticles: NewsArticle[] = [
  {
    id: "n1",
    headline: "NIFTY closes above 24,800 as IT and banking lead a broad rally",
    source: "MarketWire",
    publishedAt: Date.now() - 2 * H,
    category: "Market",
    sentiment: "Positive",
    sentimentScore: 0.72,
    aiSummary:
      "Broad-based buying pushed the index to a fresh high, led by IT exporters and private banks. Volume was above the 20-day average, suggesting institutional participation.",
    related: ["TCS", "INFY", "HDFCBANK"],
    featured: true,
  },
  {
    id: "n2",
    headline: "RBI holds repo rate steady, signals flexibility on liquidity",
    source: "EconomyDesk",
    publishedAt: Date.now() - 4 * H,
    category: "Economy",
    sentiment: "Neutral",
    sentimentScore: 0.08,
    aiSummary:
      "The policy stance remains accommodative. Markets read the statement as balanced — no near-term rate cut, but no tightening bias either.",
    related: ["SBIN", "ICICIBANK"],
  },
  {
    id: "n3",
    headline: "NVIDIA shares slip on concerns about AI capex digestion",
    source: "GlobalFins",
    publishedAt: Date.now() - 6 * H,
    category: "Global",
    sentiment: "Negative",
    sentimentScore: -0.55,
    aiSummary:
      "Investors weighed record data-centre revenue against rising supply and customer concentration worries. The stock remains well above its 52-week low.",
    related: ["NVDA", "MSFT"],
  },
  {
    id: "n4",
    headline: "Reliance's retail arm posts double-digit revenue growth",
    source: "BizChronicle",
    publishedAt: Date.now() - 9 * H,
    category: "Company",
    sentiment: "Positive",
    sentimentScore: 0.64,
    aiSummary:
      "Revenue growth was driven by same-store sales and digital commerce. Analysts flagged steady but unspectacular margin expansion.",
    related: ["RELIANCE"],
  },
  {
    id: "n5",
    headline: "Rupee firms against dollar as crude eases below $78",
    source: "ForexNow",
    publishedAt: Date.now() - 12 * H,
    category: "Economy",
    sentiment: "Positive",
    sentimentScore: 0.41,
    aiSummary:
      "A softer oil price and mild portfolio inflows supported the currency. Importers remain the largest buyers on dips.",
    related: ["USD/INR"],
  },
  {
    id: "n6",
    headline: "Tata Motors Q1: JLR demand strong, domestic CV cycle improving",
    source: "MarketWire",
    publishedAt: Date.now() - 15 * H,
    category: "Company",
    sentiment: "Positive",
    sentimentScore: 0.52,
    aiSummary:
      "The company beat street estimates on margins. Management guided for continued premiumisation in JLR and a gradual CV recovery.",
    related: ["TATAMOTORS"],
  },
  {
    id: "n7",
    headline: "US Fed minutes show caution on the timing of rate cuts",
    source: "GlobalFins",
    publishedAt: Date.now() - 18 * H,
    category: "Global",
    sentiment: "Neutral",
    sentimentScore: -0.12,
    aiSummary:
      "Minutes reflected broad agreement that policy is restrictive but data-dependent. Global equities trimmed early gains after the release.",
    related: ["AAPL", "MSFT"],
  },
  {
    id: "n8",
    headline: "IT services hiring rebounds as clients restart discretionary spend",
    source: "TechPulse",
    publishedAt: Date.now() - 22 * H,
    category: "Company",
    sentiment: "Positive",
    sentimentScore: 0.58,
    aiSummary:
      "Deal pipelines for TCS, Infosys and Wipro are improving, with consulting-led work returning. Attrition remains low, supporting margins.",
    related: ["TCS", "INFY", "WIPRO"],
  },
  {
    id: "n9",
    headline: "Gold hits a 3-month high as investors seek hedges",
    source: "CommodityDaily",
    publishedAt: Date.now() - 26 * H,
    category: "Market",
    sentiment: "Neutral",
    sentimentScore: 0.2,
    aiSummary:
      "Central-bank buying and softer US yields supported bullion. Analysts caution the move is momentum-driven in the near term.",
    related: ["GOLD"],
  },
  {
    id: "n10",
    headline: "Bajaj Finance: unsecured book stress 'manageable', says management",
    source: "BizChronicle",
    publishedAt: Date.now() - 30 * H,
    category: "Company",
    sentiment: "Neutral",
    sentimentScore: -0.05,
    aiSummary:
      "Delinquencies in small-ticket unsecured loans are normalising from elevated levels. Provisioning guidance was maintained.",
    related: ["BAJFINANCE"],
  },
  {
    id: "n11",
    headline: "FII flows turn positive for a second straight week",
    source: "EconomyDesk",
    publishedAt: Date.now() - 33 * H,
    category: "Market",
    sentiment: "Positive",
    sentimentScore: 0.66,
    aiSummary:
      "Foreign investors returned to Indian equities after a two-month pause, favouring large-cap financials and IT.",
    related: ["HDFCBANK", "ICICIBANK"],
  },
  {
    id: "n12",
    headline: "Asian Paints faces margin squeeze from aggressive competition",
    source: "TechPulse",
    publishedAt: Date.now() - 36 * H,
    category: "Company",
    sentiment: "Negative",
    sentimentScore: -0.48,
    aiSummary:
      "Pricing pressure in the decorative segment is weighing on gross margins. The management expects stabilisation over two quarters.",
    related: ["ASIANPAINT"],
  },
];

export const newsCategories = ["Market", "Company", "Economy", "Global"] as const;
