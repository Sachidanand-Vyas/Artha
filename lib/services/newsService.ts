import type { NewsArticle, NewsCategory } from "@/lib/types";
import { newsArticles, newsCategories } from "@/lib/mock/news";
import { delay } from "@/lib/services/delay";

export interface NewsService {
  getArticles(category?: NewsCategory | "All"): Promise<NewsArticle[]>;
  getCategories(): Promise<NewsCategory[]>;
  getSentimentSummary(): Promise<{ positive: number; neutral: number; negative: number }>;
}

export const newsService: NewsService = {
  async getArticles(category = "All") {
    await delay(360);
    if (category === "All") return newsArticles;
    return newsArticles.filter((a) => a.category === category);
  },
  async getCategories() {
    await delay(120);
    return [...newsCategories];
  },
  async getSentimentSummary() {
    await delay(200);
    const total = newsArticles.length;
    return {
      positive: Math.round((newsArticles.filter((a) => a.sentiment === "Positive").length / total) * 100),
      neutral: Math.round((newsArticles.filter((a) => a.sentiment === "Neutral").length / total) * 100),
      negative: Math.round((newsArticles.filter((a) => a.sentiment === "Negative").length / total) * 100),
    };
  },
};
