# ARTHA — AI-Powered Wealth Intelligence

Artha is an AI-driven **financial literacy and decision-support platform** for beginner and retail investors. Unlike a prediction dashboard, Artha explains **why** — every number, metric and insight is paired with its meaning, its risk implication, and what to consider before acting.

> **Artha does not simply tell users what to do. It explains WHY.**

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — custom dark-first fintech design system (`app/globals.css`)
- **lightweight-charts** — professional candlestick/volume charts (research page)
- **recharts** — allocation donuts, performance lines, histograms, tool outputs
- **zustand** (persisted) — watchlist + advisor conversation state
- **lucide-react** — icons

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

## What's inside

| Route | Page |
| --- | --- |
| `/` | Dashboard — portfolio overview, market overview, Artha Intelligence insight, risk snapshot, watchlist, news |
| `/markets` | Indices, market breadth, sector performance, top movers |
| `/research/[symbol]` | Stock research — candlestick chart with 1D–5Y ranges, fundamentals with explainer tooltips, technicals (RSI/MACD/support-resistance), Ask Artha panel, peers |
| `/watchlist` | Searchable, sortable, filterable watchlist with AI insights |
| `/portfolio` | Holdings, allocation, performance vs benchmark, analytics/risk metrics, transactions, goals, AI portfolio analysis |
| `/advisor` | Three-pane AI Advisor — conversation history, chat with structured answers, context panel |
| `/learn` | Financial-literacy curriculum with lessons, quizzes and an interactive decision scenario |
| `/tools` | SIP, compound interest, goal planner, retirement planner, risk profiler, portfolio analyzer, Monte Carlo simulation, tax calculator, backtesting |
| `/news` | AI-summarised news with sentiment and category filters |
| `/settings` | Profile, preferences, API-readiness status, responsible-use disclosure |

## Architecture

The frontend is built **API-first** so real backends can be connected without UI changes:

- **`lib/services/`** — typed service interfaces (`marketService`, `stockService`, `portfolioService`, `newsService`, `learningService`, `aiService`, `analyticsService`), each with a mock implementation behind simulated latency so loading states are real.
- **`lib/mock/`** — a dedicated, centralised sample-data layer (markets, stocks, portfolio, news, learning, AI responses). No fake data is scattered inside components.
- **`lib/store/`** — zustand store (persisted to localStorage).
- **`components/`** — reusable UI primitives, dashboard/portfolio/research/tools/learn/news components, and the responsive app shell (desktop sidebar + mobile drawer + bottom nav).

## Honesty by design

- All data is **clearly labelled sample data** — nothing pretends to be live.
- AI surfaces use a **rule-based demo engine** behind `aiService`; the UI never claims an LLM is running.
- The Settings page lists exactly which systems are demo vs planned.
- Everything is educational — **not financial advice.**

## Roadmap (next milestones)

1. Real market-data provider behind `marketService` (quotes + candles).
2. LLM/RAG backend behind `aiService` for the advisor and Ask Artha panels.
3. User accounts + database for watchlist, portfolio and progress persistence.
4. News API + sentiment pipeline behind `newsService`.
