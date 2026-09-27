/**
 * NEWS SERVICE — real headlines from the Artha backend (GET /api/news).
 *
 * The backend aggregates trusted publishers' official RSS feeds (Economic
 * Times, Mint, Business Standard), normalizes, dedupes, sorts newest-first
 * and caches the result for 5 minutes. NOTHING is hardcoded here: when every
 * provider fails the backend answers 503 and the error surfaces to the UI as
 * an "unavailable" state — there is no path that silently returns sample
 * articles.
 */

import type { NewsArticle, NewsCategory } from "@/lib/types";
import { apiGet } from "@/lib/services/api";

/* ----------------------------- Backend wire ----------------------------- */

interface ApiArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string; // ISO 8601 with timezone
  category: NewsCategory;
  description: string;
  image: string | null;
  tickers: string[];
}

export interface SourceStatus {
  name: string;
  feed: string;
  status: "ok" | "failed";
  count: number;
  detail: string;
}

interface ApiNewsFeed {
  articles: ApiArticle[];
  updated_at: string;
  sources: SourceStatus[];
  total: number;
}

/* -------------------------------- Types --------------------------------- */

export interface NewsFeed {
  articles: NewsArticle[];
  /** Epoch ms of the REAL fetch behind this (cached) response. */
  updatedAt: number;
  /** Per-source fetch outcome — failures are also logged server-side. */
  sources: SourceStatus[];
}

export interface NewsService {
  getFeed(category?: NewsCategory | "All", limit?: number): Promise<NewsFeed>;
  /** Convenience wrapper — articles only (used by the dashboard strip). */
  getArticles(category?: NewsCategory | "All", limit?: number): Promise<NewsArticle[]>;
  /** Static navigation config (categories are fixed, not fetched data). */
  getCategories(): Promise<NewsCategory[]>;
}

/** Frontend TTL ≤ backend cache (5 min): a page reload always revalidates. */
const NEWS_TTL_MS = 60_000;

const CATEGORY_PARAM: Record<NewsCategory | "All", string> = {
  All: "all",
  Market: "market",
  Company: "company",
  Economy: "economy",
  Global: "global",
};

function mapFeed(api: ApiNewsFeed): NewsFeed {
  const articles = api.articles
    .map((a) => ({
      id: a.id,
      title: a.title,
      source: a.source,
      url: a.url,
      publishedAt: Date.parse(a.published_at),
      category: a.category,
      description: a.description ?? "",
      image: a.image,
      tickers: a.tickers ?? [],
    }))
    .filter((a) => Number.isFinite(a.publishedAt)); // undated news is never shown

  const updatedAt = Date.parse(api.updated_at);
  return {
    articles,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    sources: api.sources ?? [],
  };
}

export const newsService: NewsService = {
  async getFeed(category = "All", limit = 40) {
    const path = `/api/news?category=${CATEGORY_PARAM[category] ?? "all"}&limit=${limit}`;
    return mapFeed(await apiGet<ApiNewsFeed>(path, NEWS_TTL_MS));
  },

  async getArticles(category = "All", limit = 40) {
    return (await this.getFeed(category, limit)).articles;
  },

  async getCategories() {
    return ["Market", "Company", "Economy", "Global"];
  },
};
