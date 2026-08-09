import type {
  InvestmentScenario,
  LearningCategory,
  Lesson,
} from "@/lib/types";
import {
  investmentScenario,
  learningCategories,
  lessons,
} from "@/lib/mock/learning";
import { delay } from "@/lib/services/delay";

export interface LearningService {
  getCategories(): Promise<LearningCategory[]>;
  getLessons(): Promise<Lesson[]>;
  getLesson(slug: string): Promise<Lesson | undefined>;
  getScenario(): Promise<InvestmentScenario>;
}

export const learningService: LearningService = {
  async getCategories() {
    await delay(200);
    return learningCategories;
  },
  async getLessons() {
    await delay(340);
    return lessons;
  },
  async getLesson(slug) {
    await delay(280);
    return lessons.find((l) => l.slug === slug);
  },
  async getScenario() {
    await delay(240);
    return investmentScenario;
  },
};
