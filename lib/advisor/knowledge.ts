/**
 * GENERAL FINANCE KNOWLEDGE LAYER
 * --------------------------------
 * Hand-written, deterministic financial education content for the Advisor.
 * This is the offline fallback and the source of truth for concept questions;
 * an optional LLM (see backend/services/llm.py) can answer instead when a
 * provider is configured — but it is never required to run the demo.
 *
 * Matching is keyword/score based (no NLP model). Each entry has:
 *  - gist      : one sentence, also used in "difference between X and Y" answers
 *  - contrast  : one comparative clause, so any two entries can be contrasted
 *  - answer    : the full explanation (definition -> how to read -> example -> cautions)
 *  - why       : optional short paragraph used for "why?" follow-ups
 */

export type KnowledgeCategory =
  | "markets"
  | "investing"
  | "personal_finance"
  | "retirement"
  | "tax"
  | "portfolio"
  | "account";

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: KnowledgeCategory;
  keywords: string[];
  gist: string;
  contrast?: string;
  answer: string;
  why?: string;
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  /* ------------------------------- Markets ------------------------------- */
  {
    id: "pe",
    title: "P/E ratio (Price-to-Earnings)",
    category: "markets",
    keywords: ["p/e", "pe ratio", "price to earnings", "price-earnings", "pe multiple"],
    gist: "How much investors pay per ₹1 of a company's current earnings.",
    contrast: "P/E prices a company by its earnings",
    answer:
      "**P/E (Price-to-Earnings)** = share price ÷ earnings per share. It tells you how much investors are willing to pay for each ₹1 of *current* profit.\n\n**How to read it:** a high P/E means the market expects strong growth (or the stock is expensive); a low P/E means it is cheap — or that growth has stalled.\n**Example:** a ₹600 share earning ₹25/year trades at P/E 24.\n**Use it with:** growth rate, sector peers and the stock's own history. P/E alone never tells you whether something is a bargain.",
    why: "P/E matters because you pay the price today but own the earnings of tomorrow — comparing P/E with growth (a rough PEG view) is how investors judge whether that price is justified.",
  },
  {
    id: "pb",
    title: "P/B ratio (Price-to-Book)",
    category: "markets",
    keywords: ["p/b", "pb ratio", "price to book", "price-book"],
    gist: "Share price as a multiple of the accounting value of the company's net assets.",
    contrast: "P/B prices a company by the book value of its net assets",
    answer:
      "**P/B (Price-to-Book)** = share price ÷ book value per share (assets − liabilities).\n\n**How to read it:** below 1 means the market values the company at less than its net assets; above 1 means investors are paying a premium for future earnings power.\n**Example:** P/B 2 means you pay ₹2 for every ₹1 of net assets on the books.\n**Best for:** asset-heavy or financial firms. **Weak for:** asset-light IT/services companies, where the real value is human capital and cash flow, not balance-sheet assets.",
    why: "P/B matters where assets back the business — banks, NBFCs, manufacturers — because it tells you how much cushion you are getting relative to the accounting value.",
  },
  {
    id: "roe",
    title: "ROE (Return on Equity)",
    category: "markets",
    keywords: ["roe", "return on equity"],
    gist: "How efficiently a company turns shareholder money into profit.",
    contrast: "ROE measures the profit generated on shareholder funds",
    answer:
      "**ROE = net profit ÷ shareholder's equity**, shown as a percentage.\n\n**How to read it:** higher is better — 15%+ is generally considered healthy for large caps; it means the company earns ₹15 per ₹100 of owner capital each year.\n**Watch out:** ROE can be flattered by heavy debt or by buying back shares (both shrink equity). Pair it with **debt-to-equity** to see whether the return is built on leverage.\n**Where it matters most:** comparing companies in the same sector.",
    why: "ROE matters because it is the actual productivity of your money as an owner — two companies with identical profits can have very different ROEs depending on how much capital it took to earn them.",
  },
  {
    id: "market-cap",
    title: "Market capitalisation",
    category: "markets",
    keywords: ["market cap", "market capitalisation", "market capitalization", "mcap"],
    gist: "The total market value of all a company's shares — price × shares outstanding.",
    contrast: "Market cap measures the whole company's size",
    answer:
      "**Market cap = share price × number of shares.** It is what the market says the entire company is worth.\n\n**Buckets (India):** large cap ≈ ₹20,000 cr+, mid cap ≈ ₹5,000–20,000 cr, small cap below that (thresholds vary by index provider).\n**How to use it:** larger caps are usually steadier and more liquid; smaller caps can grow faster but swing much more. Market cap changes daily with price — it is not the company's revenue or assets.",
    why: "Market cap matters because it sets your expectations: the same 20% gain means very different things for a ₹2 lakh cr company and a ₹500 cr one, and liquidity/risk differ accordingly.",
  },
  {
    id: "rsi",
    title: "RSI (Relative Strength Index)",
    category: "markets",
    keywords: ["rsi", "relative strength index"],
    gist: "A 0–100 momentum gauge of recent gains versus losses (14 sessions by default).",
    contrast: "RSI measures momentum, not value",
    answer:
      "**RSI(14)** measures the speed of recent price moves on a 0–100 scale.\n\n**How to read it:** above 70 is called *overbought*, below 30 *oversold*, 40–60 is a neutral zone. RSI rising with price = strengthening momentum.\n**Important:** overbought does not mean 'sell now' — in strong trends RSI can stay above 70 for weeks. Oversold does not mean 'buy now' either. It describes momentum; it does not predict direction.\n**Artha:** the Research page computes RSI(14) with Wilder smoothing on real OHLC data.",
    why: "RSI matters because price and momentum often disagree — a stock can keep rising while RSI fades, which is one of the earliest hints that a trend is losing force.",
  },
  {
    id: "macd",
    title: "MACD and MACD crossover",
    category: "markets",
    keywords: ["macd", "macd crossover", "moving average convergence divergence", "signal line"],
    gist: "The gap between a fast (12) and slow (26) EMA, smoothed by a 9-period signal line.",
    contrast: "MACD tracks trend momentum through moving-average distance",
    answer:
      "**MACD = EMA(12) − EMA(26)**; the **signal line** is an EMA(9) of MACD; the **histogram** is MACD minus signal.\n\n**How to read it:** MACD above its signal line = positive momentum; below = negative. A **bullish crossover** (MACD crossing above signal) is a classic momentum-buy signal; a bearish crossover is the opposite. The histogram widening/narrowing shows whether momentum is strengthening or fading.\n**Caution:** crossovers lag — they confirm a move that has already started, and they whipsaw badly in sideways markets.",
    why: "MACD matters because it combines trend and momentum in one view: price making new highs while MACD does not (divergence) is a common early warning of exhaustion.",
  },
  {
    id: "moving-averages",
    title: "SMA / EMA moving averages",
    category: "markets",
    keywords: ["moving average", "sma", "ema", "50 day", "200 day", "20 day average", "50-day", "200-day"],
    gist: "The average price over a trailing window, used as a smoothed trend line.",
    contrast: "A moving average smooths price into a trend line",
    answer:
      "**SMA** = simple average of the last N closes; **EMA** gives more weight to recent closes, so it reacts faster.\n\n**Common use:** price above the 50-day average = short-term strength; the **20/50 crossover** and holding above the **200-day** are widely watched trend markers. Moving averages are *lagging* — they describe the trend that already happened.\n**Example:** 'death cross' = 50-day crossing below the 200-day; 'golden cross' = the opposite.\nNeither is a forecast; they are discipline tools for describing trend.",
    why: "Moving averages matter because they turn noisy daily prices into one readable line — most trend rules (above/below, crossovers) exist to remove emotion from that judgement.",
  },
  {
    id: "volatility",
    title: "Volatility",
    category: "markets",
    keywords: ["volatility", "volatile", "how much does it swing"],
    gist: "How much an investment's price moves around its average — risk as variation, not loss.",
    contrast: "Volatility measures the size of price swings",
    answer:
      "**Volatility** is the spread of returns around their average — usually annualised standard deviation of daily returns. High volatility = bigger swings in both directions.\n\n**How to read it:** ~12–15% a year is typical for a diversified index; 30%+ means a rough ride. Artha labels risk from realised volatility: <18% Low, 18–30% Moderate, >30% High.\n**Key point:** volatility is *not* the same as losing money — it is uncertainty. The risks that actually hurt are permanent capital loss and being forced to sell during a drawdown.",
    why: "Volatility matters because the ability to stomach it is what keeps you invested — most long-term underperformance comes from selling at the bottom, not from the fall itself.",
  },
  {
    id: "bull-market",
    title: "Bull market",
    category: "markets",
    keywords: ["bull market", "bullish", "what is bull"],
    gist: "A sustained period of rising prices, typically a rise of 20%+ from recent lows.",
    contrast: "A bull market is a sustained rising-price phase",
    answer:
      "**Bull market** = prices rising broadly, conventionally 20% or more off recent lows with improving sentiment.\n\n**What drives it:** earnings growth, easy liquidity, optimistic forecasts.\n**Behavioural trap:** bulls make cautious assets look foolish, which encourages leverage and chasing whatever is rising fastest.\n**Reality:** bulls end without a clear signal — you cannot time the top; position sizing and diversification matter more than prediction.",
  },
  {
    id: "bear-market",
    title: "Bear market",
    category: "markets",
    keywords: ["bear market", "bearish", "market crash", "what is bear"],
    gist: "A sustained decline of 20%+ from recent peaks, usually with pessimistic sentiment.",
    contrast: "A bear market is a sustained falling-price phase",
    answer:
      "**Bear market** = a decline of 20%+ from recent highs, typically accompanied by negative sentiment and selling pressure.\n\n**History (context, not a promise):** equity drawdowns of 20–40% have happened repeatedly and have always been followed — over years, not days — by recoveries, but no rule guarantees that.\n**What helps:** not using borrowed money, holding an emergency fund so you never have to sell at the bottom, and reviewing whether your allocation still matches your horizon.",
    why: "Bear markets matter because they are the price of equity returns — the loss is visible and painful while the recovery is slow and boring, which is exactly when discipline pays.",
  },
  {
    id: "why-prices-move",
    title: "Why do stock prices move?",
    category: "markets",
    keywords: ["why do stock prices move", "why do shares move", "why price changes", "why did price change"],
    gist: "Prices move where buyers and sellers disagree on future earnings, interest rates, news and sentiment.",
    contrast: "Price movement reflects changing expectations",
    answer:
      "A price is where a buyer and seller agree *right now*. It moves when expectations change:\n\n1. **Earnings** — results, guidance, order wins or losses\n2. **Interest rates** — higher rates discount future profits more heavily\n3. **Sector/news flow** — regulation, crude prices, currency, competitor moves\n4. **Sentiment & flows** — fund flows, FII/DII positioning, momentum trading\n5. **Valuation rotation** — money moving between expensive and cheap pockets\n\nA single day's move is mostly flow and sentiment; the multi-year trend is mostly earnings. Artha shows you the measured move and the indicators — it does not have a news feed, so it cannot name the day's specific catalyst.",
  },
  {
    id: "analyze-stock",
    title: "How do I analyze a stock?",
    category: "markets",
    keywords: ["how to analyze a stock", "how do i analyze", "how to evaluate stock", "how to research a stock", "analyse a stock"],
    gist: "Business quality + valuation + financial health + technical trend + how it fits your portfolio.",
    contrast: "Stock analysis combines business, valuation and risk",
    answer:
      "A practical four-step frame:\n\n1. **Business** — what does it sell, who are its competitors, what makes it durable?\n2. **Financials** — revenue/profit growth, ROE, debt-to-equity, cash generation.\n3. **Valuation** — P/E, P/B versus its own history and sector peers; is the price justified by growth?\n4. **Technicals & position** — trend (20/50/200-day), RSI/MACD, and how large a share of your portfolio it would be.\n\n**On Artha:** the Research page runs steps 2–4 on real data and returns a transparent BUY/HOLD/SELL signal with reasons. Step 1 (business judgement) remains yours.",
    why: "This structure matters because it separates what you can measure (valuation, trend) from what you must judge (business quality) — mixing them is how people end up buying stories at any price.",
  },
  {
    id: "index",
    title: "Index, NIFTY 50 and SENSEX",
    category: "markets",
    keywords: ["nifty", "sensex", "what is an index", "stock index", "benchmark", "nifty 50", "bank nifty"],
    gist: "An index tracks a basket of stocks to represent the market or a segment of it.",
    contrast: "An index measures a basket rather than a single company",
    answer:
      "An **index** is a basket of stocks tracked as one number.\n\n**NIFTY 50** — NSE's 50 largest, liquid stocks. **SENSEX** — BSE's 30-share benchmark. **BANK NIFTY** — the banking heavyweights.\n**Why they matter:** they are the benchmark your portfolio is judged against, and passive funds (index funds/ETFs) simply replicate them.\n**Artha's Markets page** shows latest-available index values from the data provider; breadth (advance/decline) is shown as N/A when the provider cannot supply it.",
  },
  {
    id: "dividend",
    title: "Dividend and dividend yield",
    category: "markets",
    keywords: ["dividend", "dividend yield", "payout"],
    gist: "Cash paid per share out of profits; yield is that payment as a percentage of price.",
    contrast: "Dividends pay cash out of profits",
    answer:
      "**Dividend** = cash paid per share from profits. **Dividend yield = annual dividend ÷ price.**\n\n**How to read it:** a steady, growing dividend signals cash-generation discipline; a very high yield (>5–6%) can mean the price has fallen (yield rises as price drops) and the payout may be at risk.\n**Tax note:** dividends are taxed in your hands at your slab rate (TDS may apply) — the old 100% DDT regime is gone.\n**Total return** = price change + dividend; yield alone is not a return metric.",
  },
  {
    id: "beta",
    title: "Beta",
    category: "markets",
    keywords: ["beta", "what is beta", "systematic risk"],
    gist: "How much a stock tends to move relative to the market (beta 1 = moves with it).",
    contrast: "Beta measures sensitivity to market moves",
    answer:
      "**Beta** compares a stock's moves to its benchmark (usually 1.0 = the market).\n\n**How to read it:** beta 1.3 → historically ~30% more volatile than the market; beta 0.7 → calmer than the market. High beta amplifies both rallies and falls.\n**Limitations:** beta is estimated from history — it can change after a business shift, and it says nothing about valuation or permanent-loss risk.",
  },

  /* ------------------------------- Investing ------------------------------ */
  {
    id: "sip",
    title: "SIP (Systematic Investment Plan)",
    category: "investing",
    keywords: ["sip", "systematic investment", "monthly investment plan", "start a sip"],
    gist: "Investing a fixed amount at fixed intervals, so you buy more units when prices are low.",
    contrast: "A SIP automates investing on a schedule",
    answer:
      "**SIP** invests a fixed amount every month (or week/quarter) in a mutual fund or ETF.\n\n**How it works:** the same money buys more units when prices are low and fewer when they are high — **rupee-cost averaging** — and compounding does the heavy lifting over time.\n**Example:** ₹5,000/month for 10 years at an assumed 12% ≈ ₹11.6 lakh (of ₹6 lakh invested) — an illustration, not a promise.\n**Considerations:** the right amount comes from your surplus and goals; keep an emergency fund first; don't stop a SIP because the market fell — that is exactly when it buys cheap.",
    why: "SIPs matter because they remove timing from the equation — the biggest enemy of long-term returns is usually not the market, but the pauses we put in ourselves.",
  },
  {
    id: "sip-vs-lumpsum",
    title: "SIP vs lump sum",
    category: "investing",
    keywords: ["sip vs lump sum", "sip versus lump sum", "lumpsum or sip", "lump sum or sip", "monthly or one time"],
    gist: "SIP spreads entry over time and reduces timing risk; a lump sum earns more if markets rise immediately.",
    contrast: "SIP spreads the entry price over time; a lump sum invests everything at today's price",
    answer:
      "**Lump sum** wins when markets rise from today — you are fully invested. **SIP** wins (psychologically and often in outcomes) when markets fall or stay choppy, because your money enters gradually.\n\n**Rule of thumb:** money you can lock away for 7+ years and can afford to see fall → lump sum tends to compound longer. Money built from fresh monthly savings, or a volatile/at-top market → SIP. Many investors do both: lump sum for windfalls, SIP for salary income.\n**Neither** removes market risk; both are subject to the same sequence of returns.",
  },
  {
    id: "index-fund",
    title: "Index fund",
    category: "investing",
    keywords: ["index fund", "index funds", "passive fund"],
    gist: "A fund that simply replicates an index like the NIFTY 50 instead of trying to beat it.",
    contrast: "An index fund buys the whole benchmark passively",
    answer:
      "**Index fund** = a mutual fund that replicates a benchmark (NIFTY 50, SENSEX) instead of picking stocks.\n\n**Why people use them:** very low cost, no fund-manager risk, no style drift, and market-matching returns — most active funds fail to beat their index over 10+ year periods after fees.\n**Trade-off:** you never 'beat the market', you get the market. Also check tracking error and expense ratio when comparing two funds on the same index.",
    why: "Index funds matter because costs and tax drag compound as silently as returns — a ~1% fee difference can quietly consume a large share of a 30-year corpus.",
  },
  {
    id: "etf",
    title: "ETF (Exchange Traded Fund)",
    category: "investing",
    keywords: ["etf", "exchange traded fund", "etfs"],
    gist: "A fund that trades on the exchange like a share, usually tracking an index or commodity.",
    contrast: "An ETF trades live on the exchange like a stock",
    answer:
      "**ETF** = a basket (index, sector, gold, bond) that trades on the exchange intraday at market prices.\n\n**Vs index fund:** ETFs trade live with real-time prices and usually lower expense ratios, but you need a demat/brokerage account, pay brokerage/spread, and price can briefly deviate from NAV. Index funds are bought/sold at end-of-day NAV with no demat needed.\n**Watch:** liquidity (impact cost), tracking error, and expense ratio.",
  },
  {
    id: "mutual-fund",
    title: "Mutual fund",
    category: "investing",
    keywords: ["mutual fund", "mutual funds", "what is a fund", "nav"],
    gist: "Pooled money from many investors, managed into a basket of securities and priced once a day at NAV.",
    contrast: "A mutual fund pools many investors' money under a manager",
    answer:
      "**Mutual fund** = your money plus many others, pooled and invested by a professional manager into a basket of securities.\n\n**Types:** equity (stocks), debt (bonds), hybrid (both), index (passive). Each scheme publishes a **NAV** (net asset value) once per trading day — you buy/sell at that day's NAV, not at a live price.\n**Costs:** expense ratio (annual), sometimes exit load if redeemed early.\n**Key checks:** what the scheme actually invests in, its cost, its downside behaviour — not just last year's return.",
    why: "Mutual funds matter because they give small amounts instant diversification and professional management — the cost is the fee, and fees are the one thing you can control.",
  },
  {
    id: "bond",
    title: "Bond (debt instrument)",
    category: "investing",
    keywords: ["bond", "bonds", "debenture", "what is debt", "fixed income"],
    gist: "Lending money to a government or company in return for periodic interest and repayment at maturity.",
    contrast: "A bond is a loan you make to a borrower",
    answer:
      "**Bond** = a loan you give (government, PSU, corporate) in return for interest (coupon) and your principal back at maturity.\n\n**How to read it:** yields rise when prices fall — bond prices and interest rates move in opposite directions.\n**Risk:** credit risk (borrower defaults), interest-rate risk (rates rise → existing bonds lose price), inflation risk (fixed payments lose value).\n**For portfolios:** debt lowers overall volatility and is where near-term goal money usually sits — but 'safe' bonds still lose to inflation if held carelessly.",
  },
  {
    id: "equity-vs-debt",
    title: "Equity vs debt",
    category: "investing",
    keywords: ["equity vs debt", "equity versus debt", "stocks vs bonds", "shares vs fd", "equity or debt", "stock vs bond"],
    gist: "Equity is ownership with higher long-term potential and bigger swings; debt is a loan with fixed, lower returns.",
    contrast: "Equity is ownership of a business; debt is a loan you make",
    answer:
      "**Equity** — you own a slice of a company; returns come from price growth and dividends; historically higher long-term returns, with drawdowns of 20–40% possible.\n**Debt** — you lend and earn interest; steadier, lower returns, but exposed to defaults and rate moves; inflation can erode 'guaranteed' returns.\n\n**How to choose:** near-term goals (1–3 years) usually sit in debt/cash; long-term goals (7+ years) usually need equity to outpace inflation. The blend is **asset allocation** — the single biggest driver of your portfolio's risk.",
  },
  {
    id: "compounding",
    title: "Compound interest",
    category: "investing",
    keywords: ["compound interest", "compounding", "compound", "how does compound work", "interest on interest"],
    gist: "Earnings that themselves start earning — growth builds on growth.",
    contrast: "Compounding adds returns on top of previous returns",
    answer:
      "**Compound interest** is 'interest on interest': your returns start generating returns of their own.\n\n**Example:** ₹1,00,000 at 10% becomes ₹1,10,000 in year 1; in year 2 you earn 10% on ₹1,10,000 (₹11,000), not on ₹1,00,000. Over 20 years ₹1L @10% ≈ ₹6.7L, while simple interest would give ₹3L.\n\n**The two levers that matter:** time and rate. Starting 10 years earlier often beats contributing twice as much later. Fees, taxes and withdrawals all break the chain — which is why uninterrupted compounding is the whole game.",
    why: "Compounding matters because its curve is flat for years and then steep — the reward arrives suddenly, which is why people quit just before it would have paid them.",
  },
  {
    id: "cagr",
    title: "CAGR (compound annual growth rate)",
    category: "markets",
    keywords: ["cagr", "annualised return", "annual return", "compound annual"],
    gist: "The constant annual rate that would turn your start value into your end value over the period.",
    contrast: "CAGR converts a multi-year return into one annual rate",
    answer:
      "**CAGR = (End ÷ Start)^(1/years) − 1.**\n\n**Example:** ₹1,00,000 → ₹1,50,000 in 3 years = 14.47% CAGR.\n**Why use it:** it makes different assets and periods comparable.\n**Cautions:** it assumes smooth growth — real paths are bumpy, so two investments with the same CAGR can feel very different (drawdowns matter). It also ignores adding money mid-way; for SIPs with regular contributions, XIRR is the right measure.",
  },
  {
    id: "asset-allocation",
    title: "Asset allocation",
    category: "portfolio",
    keywords: ["asset allocation", "how should i allocate", "allocation of assets", "split between assets"],
    gist: "How your wealth is split across equity, debt, gold and cash — the main driver of portfolio risk.",
    contrast: "Asset allocation sets the risk level of the whole portfolio",
    answer:
      "**Asset allocation** decides what percentage sits in equity, debt, gold and cash.\n\n**Why it dominates:** studies attribute most of a portfolio's return variation to allocation, not individual stock picks. A 90/10 equity portfolio will behave very differently from 50/50 even holding the same funds.\n**Starting point:** roughly '100 − your age' in equity is a classic heuristic, but horizon and temperament matter more — money for a house deposit in 2 years should not be in equity at all.\n**Maintenance:** rebalance when drift exceeds ~5 percentage points.",
    why: "Asset allocation matters because it decides how much you can afford to lose without changing your plan — the right mix is the one you can hold through a 30% drawdown.",
  },
  {
    id: "diversification",
    title: "Diversification",
    category: "portfolio",
    keywords: ["diversification", "diversify", "diversified", "all my eggs", "spread risk", "too many stocks"],
    gist: "Spreading money across assets whose losses rarely arrive together, so no single event breaks you.",
    contrast: "Diversification removes company and sector specific risk",
    answer:
      "**Diversification** spreads money across companies, sectors and asset classes whose losses don't arrive at the same moment.\n\n**What it removes:** company-specific and sector-specific risk (one fraud, one product failure, one regulation). **What it keeps:** market risk — the broad falls you are paid for bearing.\n**Practical levels:** a retail portfolio is usually diversified by ~10–15 stocks across 4–6 sectors, plus debt/gold. Beyond ~20–25 stocks you are mostly buying an index, with more work.\n**Artha:** the portfolio tools show your actual sector shares — concentration above ~35% in one sector is worth a look.",
    why: "Diversification matters because it is the only free lunch in finance: you give up some upside potential to make a permanent loss from a single mistake far less likely.",
  },
  {
    id: "beginner-investing",
    title: "How should a beginner start investing?",
    category: "investing",
    keywords: ["beginner start investing", "how to start investing", "first time investor", "start investing", "new to investing", "how to begin"],
    gist: "Emergency fund first, then goal-based simple funds, then gradually add complexity.",
    contrast: "Beginner investing is about order of operations, not picking winners",
    answer:
      "A sensible order of operations:\n\n1. **Emergency fund** — 3–6 months of expenses in a savings/liquid fund (this is what stops panic selling).\n2. **Insurance** — health cover first; term insurance if anyone depends on your income.\n3. **Clear costly debt** — credit-card balances before investing anything.\n4. **Start simple** — a NIFTY 50 index fund SIP for long-term money; add a debt fund for near-term goals.\n5. **Automate and increase** — start with whatever is surplus, raise it with every salary hike.\n6. **Only then** explore individual stocks — with position-size limits.\n\n**Avoid early:** leverage, 'guaranteed return' schemes, tips, and investing money you'll need within 3 years.",
  },
  {
    id: "how-much-save",
    title: "How much should I save every month?",
    category: "personal_finance",
    keywords: ["how much should i save", "how much to save", "how much should i invest every month", "savings rate", "save every month"],
    gist: "A common target is 20–30% of take-home pay, adjusted for your goals and fixed commitments.",
    contrast: "Saving rate is the share of income you keep",
    answer:
      "A widely used guideline: **save 20–30% of take-home income** — split between goals (retirement, house) and your emergency fund until it is full.\n\n**Better than a generic %:** work backwards from goals — 'I need ₹10 lakh in 5 years → that alone needs ≈ ₹12,100/month at an assumed 12%' — and let the goal decide the number.\n**If you're far below 20%:** attack the two biggest levers — fixed costs (rent/EMIs) and lifestyle inflation — before obsessing over returns.\nAsk me to compute a goal SIP: e.g. '₹10 lakh goal in 5 years at 12%'.",
  },
  {
    id: "emergency-fund",
    title: "Emergency fund (how much to keep)",
    category: "personal_finance",
    keywords: ["emergency fund", "emergency money", "how much emergency", "rainy day fund", "contingency fund"],
    gist: "3–6 months of essential expenses held in liquid, safe assets so you never sell investments in a crisis.",
    contrast: "An emergency fund is cash reserved for shocks, not for returns",
    answer:
      "**Emergency fund** = 3–6 months of *essential* expenses (rent, EMIs, food, utilities) in something liquid — savings account or liquid/overnight fund.\n\n**How much:** 3 months if your income is stable (dual income, secure job); 6+ if freelance, single earner, or self-employed; more if you have dependants or a mortgage.\n**Where:** never in equity — its job is availability, not growth. Replenish it before resuming discretionary investing after any withdrawal.\n**Why it comes first:** it is what prevents a job loss from becoming a forced sale at the market bottom.",
    why: "The emergency fund matters because risk management is about sequence — without it, a bad month forces you to sell assets at the worst possible moment, turning volatility into a permanent loss.",
  },
  {
    id: "saving-vs-investing",
    title: "Saving vs investing",
    category: "personal_finance",
    keywords: ["saving vs investing", "saving versus investing", "difference between saving and investing", "save or invest", "savings vs investment"],
    gist: "Saving parks money safely (preserves it); investing puts it to work (grows it, with risk).",
    contrast: "Saving prioritises safety and liquidity; investing prioritises growth with risk",
    answer:
      "**Saving** — money parked in savings accounts/FDs/liquid funds. Capital is (mostly) safe and instantly available, but after inflation and tax, the real value often barely grows.\n**Investing** — money put into assets (equity, bonds, gold) that can grow meaningfully, in exchange for price risk and illiquidity.\n\n**The practical split:** emergency fund and 1–3 year goals → saving; 5+ year goals → investing (mostly equity, because inflation is a guaranteed erosion that saving alone doesn't beat).\n**Neither is optional** — they solve different problems.",
  },
  {
    id: "inflation",
    title: "Inflation and how it affects savings",
    category: "personal_finance",
    keywords: ["inflation", "how does inflation affect", "purchasing power", "real return", "inflation effect"],
    gist: "Inflation silently reduces what your money can buy — the reason 'safe' money can still lose.",
    contrast: "Inflation erodes purchasing power over time",
    answer:
      "**Inflation** is the yearly rise in the cost of living. ₹10,000 today at 6% inflation buys what ~₹5,584 buys after 10 years — your money's *value* falls even if the number doesn't.\n\n**Real return = return − inflation.** A 7% FD at 6% inflation nets ~1% real; equity's higher long-run return exists precisely to compensate for its volatility.\n**What to do:** keep only near-term money safe, invest long-term money, and re-check that your goal targets are inflation-adjusted (ask me: '₹10 lakh in today's money, 10 years, 6% inflation').",
    why: "Inflation matters because it is the only loss you are guaranteed every year — ignoring it makes a 'safe' plan quietly fail.",
  },
  {
    id: "goal-planning",
    title: "Planning for a financial goal",
    category: "personal_finance",
    keywords: ["financial goal", "plan for a goal", "goal planning", "how to plan a goal", "target amount", "save for a goal", "goal based"],
    gist: "Define the amount in today's money, inflate it to the target date, then solve for the monthly contribution.",
    contrast: "Goal planning converts a future need into a monthly number",
    answer:
      "Four steps:\n1. **Amount in today's money** — e.g. ₹10 lakh for a house deposit.\n2. **Inflate it** — at 6%, ₹10 lakh in 5 years ≈ ₹13.4 lakh.\n3. **Pick the vehicle** — short/near goals: debt/liquid; long goals: equity-heavy.\n4. **Solve the contribution** — 'monthly amount needed' at an assumed return, then automate it.\n\n**Ask Artha:** 'How much do I need to save for a ₹13.4 lakh goal in 5 years at 12%' — I'll compute it exactly.\n**Review** annually: horizon shortens, so the mix should get safer as the date approaches.",
  },

  /* ------------------------------- Retirement ----------------------------- */
  {
    id: "retirement-planning",
    title: "Retirement planning",
    category: "retirement",
    keywords: ["retirement planning", "retire early", "how to plan retirement", "retire", "retirement", "pension"],
    gist: "Estimating the corpus you'll need, then automating contributions long enough for compounding to finish the job.",
    contrast: "Retirement planning converts a future lifestyle into a corpus and a monthly saving",
    answer:
      "Retirement is a math problem with three variables:\n1. **Corpus needed** — roughly 25–30× your first-year annual expenses (the inverse of a 4–5% safe withdrawal rate), inflation-adjusted.\n2. **Years to build it** — time is the dominant lever; starting 10 years earlier can halve the monthly requirement.\n3. **Return expected on the way there** — mixed equity/debt glide path, de-risking as you age.\n\n**Also plan for:** inflation (medical inflation runs higher), health insurance, and not touching the corpus early.\n**On Artha:** the Retirement Planner tool computes corpus and the monthly gap from your inputs.",
    why: "Retirement matters as a plan because the gap it reveals compounds too — every year of delay is not just a year of saving lost, but a year of compounding on that saving lost.",
  },
  {
    id: "retirement-corpus",
    title: "Retirement corpus",
    category: "retirement",
    keywords: ["retirement corpus", "corpus", "how much needed to retire", "retirement amount", "nest egg"],
    gist: "The total pot of money that must generate your living expenses after you stop earning.",
    contrast: "A corpus is a stock of money sized to fund future spending",
    answer:
      "**Retirement corpus** = the total you need saved so that withdrawals can fund your life without exhausting it.\n\n**Quick sizing:** corpus ≈ annual expenses in the first retirement year × 25–30. Example: ₹12 lakh/year of expenses → roughly ₹3–3.6 crore, in *today's* money — so multiply by inflation over your accumulation years.\n**Sustainability:** a 4% first-year withdrawal, rising with inflation, is the classic rule of thumb (with all the usual caveats about market sequence risk).\n**India-specific:** account for health costs and family support obligations.",
  },
  {
    id: "inflation-adjusted-return",
    title: "Inflation-adjusted (real) return",
    category: "retirement",
    keywords: ["inflation adjusted return", "real return", "nominal vs real", "inflation adjusted"],
    gist: "Return after removing inflation — what your purchasing power actually did.",
    contrast: "A real return is measured after inflation",
    answer:
      "**Real (inflation-adjusted) return ≈ nominal return − inflation** (precisely: (1+nominal)/(1+inflation) − 1).\n\n**Example:** 11% nominal with 6% inflation ≈ 4.7% real. That 4.7% is the number that actually grows what you can buy.\n**Why it matters:** goals and retirement should be entered in today's-money terms and inflated to the target date — otherwise you systematically undershoot, because the corpus is nominal but your expenses are real.",
  },

  /* --------------------------------- Tax ---------------------------------- */
  {
    id: "capital-gains-tax",
    title: "Capital gains tax",
    category: "tax",
    keywords: ["capital gains tax", "capital gain tax", "tax on profits", "cg tax", "tax on shares profit", "tax on mutual fund profit"],
    gist: "Tax you pay on the profit from selling an asset, based on how long you held it.",
    contrast: "Capital gains tax is charged on the profit realised on sale",
    answer:
      "**Capital gains tax** applies to profit when you *sell* (a 'realised' gain). Holding alone is not taxable for resident individuals.\n\n**Two buckets:**\n- **STCG** — held under the qualifying period (12 months for listed equity) → taxed at the short-term rate.\n- **LTCG** — held longer → taxed at the long-term rate, with an annual exemption.\n\n**Rates change with each Budget** (listed equity: LTCG 12.5% above the exemption, STCG 20% under current rules) — always verify for the current financial year.\n**Planning angle:** holding periods, harvesting, and loss offsetting are legitimate levers; never let tax alone drive an investment.",
    why: "Tax matters for returns because it is charged on nominal gains while you spend real, post-tax money — the after-tax, after-inflation number is the only one that buys anything.",
  },
  {
    id: "stcg",
    title: "STCG (short-term capital gains)",
    category: "tax",
    keywords: ["stcg", "short term capital gain", "short-term capital gains", "short term gain"],
    gist: "Gain on an asset sold within its short holding period, taxed at the higher short-term rate.",
    contrast: "STCG is the gain from a sale inside the short holding window",
    answer:
      "**STCG** = profit on an asset sold *before* the qualifying holding period.\n\n**Listed equity (India):** held 12 months or less → short-term. Current rules tax equity STCG at **20%** (Budget 2024) — verify the rate for your financial year, as it has changed recently.\n**Equity mutual funds:** same 12-month threshold.\n**Why it exists:** the higher short-term rate discourages churn. **Practical point:** frequent trading pushes profits into STCG — factor the tax into any 'quick trade' decision.",
  },
  {
    id: "ltcg",
    title: "LTCG (long-term capital gains)",
    category: "tax",
    keywords: ["ltcg", "long term capital gain", "long-term capital gains", "long term gain"],
    gist: "Gain on an asset held beyond the qualifying period, taxed at the lower long-term rate.",
    contrast: "LTCG is the gain from holding past the long-term window",
    answer:
      "**LTCG** = profit on an asset sold *after* the qualifying holding period.\n\n**Listed equity (India):** held more than 12 months → long-term. Current rules: **12.5% on gains above the annual exemption (₹1.25 lakh)**, grandfathered for acquisitions before 23 July 2024 — verify for your financial year.\n**Why holding longer helps:** a lower rate plus deferral. **Caveat:** 'hold forever' isn't the goal — an asset still needs to earn its place in the portfolio; tax is one factor, not the strategy.",
  },
  {
    id: "tds",
    title: "TDS (Tax Deducted at Source)",
    category: "tax",
    keywords: ["tds", "tax deducted at source", "form 26as", "tds deducted"],
    gist: "Tax deducted by the payer at the moment income is paid, which you later adjust against your total liability.",
    contrast: "TDS collects tax progressively as income is paid",
    answer:
      "**TDS** = tax deducted by the payer (employer, bank, company, buyer) at the time income is paid and deposited with the government under your PAN.\n\n**How it works for you:** TDS is *pre-payment*, not an extra tax — it appears in Form 26AS/AIS and is adjusted against your final liability while filing.\n**Common cases:** salary (TDS by employer), interest (beyond the basic exemption), dividends, professional fees, property sale.\n**When it goes wrong:** PAN–TDS mismatch, or TDS on an exempt income — file and claim a refund rather than ignoring it.",
  },
  {
    id: "tax-saving-investments",
    title: "Tax-saving investments",
    category: "tax",
    keywords: ["tax saving investment", "tax saving", "80c", "tax saving funds", "elss", "save tax", "tax exemption investment"],
    gist: "Recognised investments and expenses that reduce taxable income under sections like 80C and 80D.",
    contrast: "Tax-saving investments reduce this year's taxable income",
    answer:
      "Common Indian legers (verify current-year limits):\n- **80C** — up to ₹1.5 lakh: EPF, PPF, ELSS (equity, 3-year lock), life insurance premium, principal on home loan, tuition fees.\n- **80D** — health insurance premiums (self + parents).\n- **NPS (80CCD(1B))** — an extra ₹50,000 deduction under the old regime.\n\n**Under the new (default) regime**, most deductions are restricted — so compare regimes before 'investing to save tax'.\n**Golden rule:** don't buy a poor product just for a deduction — tax saving is a by-product, not the goal.",
  },
  {
    id: "demat",
    title: "Demat account",
    category: "account",
    keywords: ["demat", "demat account", "dematerialised", "trading account"],
    gist: "An account that holds shares and securities electronically so they can be traded and settled without paperwork.",
    contrast: "A demat account holds securities in electronic form",
    answer:
      "**Demat (dematerialised) account** holds your shares, ETFs, bonds and mutual funds in electronic form with a depository participant (NSDL/CDSL) — replacing share certificates.\n\n**To trade you need three things:** a **trading account** (places orders), a **demat account** (holds the securities), and a **bank account** linked for funds.\n**Costs to compare:** account maintenance charges (AMC), brokerage, and DP charges on exits. **Mutual funds** can be held without a demat (amfi/registrar accounts) — demat matters mainly for stocks and ETFs.",
  },
  {
    id: "brokerage",
    title: "Brokerage and trading charges",
    category: "account",
    keywords: ["brokerage", "brokerage charge", "brokerage fee", "trading charges", "broker charges", "transaction charges"],
    gist: "The fees a broker charges per trade — plus exchange, STT, GST and stamp duty, which quietly reduce returns.",
    contrast: "Brokerage is the per-trade cost of executing orders",
    answer:
      "**Brokerage** is what you pay the broker to execute a trade. Indian brokers broadly follow flat-fee discount models (₹0 equity delivery brokerage is common) or percentage-based models for intraday/F&O.\n\n**The full cost stack** (all real, all recurring):\n- brokerage + STT + exchange transaction charges + SEBI turnover fee\n- GST (18% on brokerage and other fees)\n- stamp duty on purchase, DP charges on sale of holdings\n\n**Why it matters:** costs compound against you — frequent trading multiplies them. Check the *all-in* cost, not just the headline '₹0 brokerage'.",
  },

  /* ------------------------------- Portfolio ------------------------------ */
  {
    id: "portfolio-risk",
    title: "Portfolio risk",
    category: "portfolio",
    keywords: ["portfolio risk", "risk of my portfolio", "how risky is my portfolio", "risk in portfolio"],
    gist: "How much your whole portfolio can lose and how violently it moves — driven mainly by allocation and concentration.",
    contrast: "Portfolio risk combines all holdings' volatility and correlation",
    answer:
      "**Portfolio risk** has three layers:\n1. **Allocation risk** — how much sits in equity vs debt/gold (the dominant driver).\n2. **Concentration risk** — too much in one sector, stock or factor.\n3. **Volatility/liquidity risk** — how far prices can fall, and whether you can exit.\n\n**How to read yours:** Artha computes realised volatility (risk label: Low/Moderate/High), sector shares and concentration for your holdings.\n**What changes risk fastest:** selling one concentrated position or adding debt — not picking different stocks.\n**Remember:** risk is not the same as loss; the danger is being *forced* to sell during a drawdown.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Matching                                                                   */
/* -------------------------------------------------------------------------- */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function keywordHit(text: string, keyword: string): number {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(keyword)}([^a-z0-9]|$)`, "i");
  if (!re.test(text)) return 0;
  // Phrases and multi-word/technical tokens are stronger signals than short words.
  if (keyword.includes(" ") || keyword.includes("/")) return 3;
  return keyword.length >= 6 ? 2 : 1;
}

/** Score every entry against the question; best match first. */
export function matchKnowledge(text: string): KnowledgeEntry[] {
  const scored = KNOWLEDGE.map((entry) => ({
    entry,
    score: entry.keywords.reduce((sum, kw) => sum + keywordHit(text, kw), 0),
  })).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.entry);
}

const DIFF_RE = /\b(difference between|differ from|vs\.?|versus)\b/i;

/** Detects "difference between X and Y" / "X vs Y" style comparisons. */
export function comparisonPartners(text: string): [KnowledgeEntry, KnowledgeEntry] | null {
  if (!DIFF_RE.test(text)) return null;
  const matches = matchKnowledge(text);
  if (matches.length >= 2) return [matches[0], matches[1]];
  return null;
}

/** Compose a two-entry comparison using gist + contrast (no invented facts). */
export function compareEntries(a: KnowledgeEntry, b: KnowledgeEntry): string {
  return [
    `**${a.title}** — ${a.gist}`,
    `**${b.title}** — ${b.gist}`,
    "",
    "**Key difference:**",
    `• ${a.title}: ${a.contrast ?? a.gist}`,
    `• ${b.title}: ${b.contrast ?? b.gist}`,
    "",
    `Want either one applied to real data? Ask e.g. "What about Reliance?" or "Is my portfolio diversified?"`,
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Suggested prompts shown in the Advisor UI ("Try asking")                   */
/* -------------------------------------------------------------------------- */

export const suggestedPrompts = [
  "What is P/E ratio?",
  "How does a SIP work?",
  "Is my portfolio diversified?",
  "Why is Reliance moving?",
  "How does compound interest work?",
];
