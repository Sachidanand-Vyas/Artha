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
# Backend (FastAPI — market data, auth, virtual portfolio)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (in a second terminal, repo root)
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

The backend stores accounts and portfolios in a local SQLite file
(`backend/artha.db`, created automatically on first run).

## What's inside

| Route | Page |
| --- | --- |
| `/login` · `/signup` · `/onboarding` | Email/username + password auth (PBKDF2-hashed), first-time onboarding, portfolio-mode choice |
| `/` | Dashboard — your real portfolio overview, market overview, Artha Intelligence insight, health snapshot, watchlist, news |
| `/markets` | Indices, market breadth, sector performance, top movers |
| `/research/[symbol]` | Stock research — candlestick chart with 1D–5Y ranges, fundamentals with explainer tooltips, technicals (RSI/MACD/support-resistance), Ask Artha panel, peers |
| `/watchlist` | Searchable, sortable, filterable watchlist with AI insights |
| `/portfolio` | Virtual paper trading (₹1,00,000 start) + manual holdings: buy/sell at real prices, holdings, allocation, real analytics, transactions |
| `/advisor` | Three-pane AI Advisor — conversation history, chat with structured answers, context panel |
| `/learn` | Financial-literacy curriculum with lessons, quizzes and an interactive decision scenario |
| `/tools` | SIP, compound interest, goal planner, retirement planner, risk profiler, portfolio analyzer, Monte Carlo simulation, tax calculator, backtesting |
| `/news` | AI-summarised news with sentiment and category filters |
| `/settings` | Profile, preferences, API-readiness status, responsible-use disclosure |

## Architecture

The frontend is built **API-first** behind typed services:

- **`lib/services/`** — typed service interfaces (`marketService`, `stockService`, `portfolioService`, `authService`, `aiService`, `analyticsService`, `newsService`, `learningService`). Market data, auth and the portfolio talk to FastAPI; news/learning still use labelled sample data.
- **`backend/`** — FastAPI: Yahoo market data + indicators + recommendation model, deterministic calculation engine, account/auth routes (PBKDF2 passwords, bearer sessions) and the virtual portfolio (cash, holdings, orders, transactions) in SQLite.
- **`lib/mock/`** — centralised sample data for the areas still in demo (news, learning). No fake data is scattered inside components.
- **`lib/store/`** — zustand stores persisted to localStorage (session, watchlist, advisor conversations).
- **`components/`** — reusable UI primitives, dashboard/portfolio/research/tools/learn/news components, and the responsive app shell (desktop sidebar + mobile drawer + bottom nav).

## Honesty by design

- Your portfolio, cash, holdings and transactions come from **your account** on real market prices — a fresh user sees honest empty states, never fabricated numbers.
- Where data doesn't exist (historical portfolio values, notification delivery, news), the UI says so instead of inventing it.
- The AI Advisor is a **general finance assistant** behind `aiService` (knowledge base + your backend data + calculation engine, with optional LLM formatting via env); without an LLM configured the UI never claims one is running.
- The Settings page lists exactly which systems are live vs demo.
- Everything is educational — **not financial advice.**

## Roadmap (next milestones)

1. ~~Real market-data provider behind `marketService`~~ — done (Yahoo Finance via FastAPI).
2. Optional LLM formatting behind `aiService` (already env-pluggable; runs without a key).
3. ~~User accounts + database~~ — done (signup/login/onboarding + virtual & manual portfolios in SQLite).
4. News API + sentiment pipeline behind `newsService` (still mock, deliberately untouched).
