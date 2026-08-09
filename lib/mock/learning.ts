import type {
  InvestmentScenario,
  LearningCategory,
  Lesson,
} from "@/lib/types";

export const learningCategories: LearningCategory[] = [
  { id: "personal-finance", name: "Personal Finance", description: "Budgeting, saving and building financial habits." },
  { id: "investing-basics", name: "Investing Basics", description: "How markets work and how to get started." },
  { id: "stocks", name: "Stocks", description: "Equities, valuation and company analysis." },
  { id: "mutual-funds", name: "Mutual Funds", description: "How funds work and how to pick them." },
  { id: "etfs", name: "ETFs", description: "Exchange-traded funds and index investing." },
  { id: "risk", name: "Risk", description: "Understanding risk, volatility and drawdowns." },
  { id: "portfolio-management", name: "Portfolio Management", description: "Allocation, diversification and rebalancing." },
  { id: "financial-ratios", name: "Financial Ratios", description: "Reading a company through its numbers." },
  { id: "market-psychology", name: "Market Psychology", description: "Behavioural biases that move prices." },
  { id: "tax-basics", name: "Tax Basics", description: "Capital gains, taxes and tax-efficient investing." },
];

export const lessons: Lesson[] = [
  {
    slug: "what-is-a-stock",
    title: "What is a stock, really?",
    category: "investing-basics",
    difficulty: "Beginner",
    readMinutes: 5,
    progress: 100,
    summary:
      "A stock is a unit of ownership in a company. Understanding what you actually own is the foundation of every investing decision.",
    sections: [
      {
        heading: "Ownership, not a ticket number",
        body: "When you buy a share of a company, you buy a tiny slice of that business — its assets, its future earnings, and its risks. You are not betting on a ticker symbol; you are becoming a part-owner of a real enterprise.",
      },
      {
        heading: "Two ways you make money",
        body: "Shareholders earn through price appreciation (the share price rising) and through dividends (a share of distributed profits). Both depend on the same thing: whether the business grows its earnings over time.",
        bullets: [
          "Price appreciation: others pay more for your shares because the business earns more.",
          "Dividends: some companies return a portion of profits directly to shareholders.",
        ],
      },
      {
        heading: "Why prices move",
        body: "In the short run, prices swing with emotion, news and liquidity. In the long run, they track earnings. That gap — between short-term noise and long-term value — is where most investor mistakes happen.",
      },
    ],
    quiz: [
      {
        question: "What do you actually own when you hold one share of a company?",
        options: [
          "A guaranteed return on your money",
          "A fractional ownership claim on the business",
          "A loan you made to the company",
          "A voting right over daily operations",
        ],
        answer: 1,
        explain:
          "A share represents fractional ownership. You share in the company's profits (and losses) — there is no guarantee of returns.",
      },
      {
        question: "Which is the best long-term driver of a share price?",
        options: ["Daily news headlines", "Trading volume", "The company's earnings growth", "Broker recommendations"],
        answer: 2,
        explain:
          "Over long horizons, prices track earnings. News and volume create short-term noise, not long-term value.",
      },
    ],
  },
  {
    slug: "risk-and-return",
    title: "Risk and return: the fundamental trade-off",
    category: "risk",
    difficulty: "Beginner",
    readMinutes: 6,
    progress: 60,
    summary:
      "Higher expected returns always come with higher uncertainty. The goal is not to avoid risk but to understand and size it.",
    sections: [
      {
        heading: "The only free lunch is diversification",
        body: "Risk is the possibility that outcomes differ from what you expect. Return is the reward for bearing that uncertainty. Markets do not pay you for guaranteed outcomes — they pay you for bearing risk that others avoid.",
      },
      {
        heading: "Volatility is not the same as loss",
        body: "Volatility measures how much a price swings. A volatile asset can still end up higher. The risk that actually hurts is permanent loss of capital — from overpaying, over-leveraging, or selling at the bottom.",
        bullets: [
          "Volatility: temporary ups and downs in price.",
          "Permanent loss: buying a business whose value genuinely deteriorates, or being forced to sell low.",
        ],
      },
      {
        heading: "Measuring your own risk capacity",
        body: "Your risk capacity depends on your horizon, income stability and obligations. A 25-year-old saving for retirement can ride out a crash; a retiree living off savings cannot. Match the risk of the asset to the timing of the goal.",
      },
    ],
    quiz: [
      {
        question: "Which statement about volatility is most accurate?",
        options: [
          "High volatility guarantees losses",
          "Volatility is the same as permanent loss",
          "Volatility is price fluctuation, not necessarily a loss",
          "Low-volatility assets always earn more",
        ],
        answer: 2,
        explain:
          "Volatility is fluctuation. Whether it becomes a real loss depends on when you sell and whether the business itself deteriorated.",
      },
      {
        question: "Who has the highest capacity to take equity risk?",
        options: [
          "A retiree living off portfolio income",
          "A 25-year-old with a 30-year horizon and stable income",
          "Someone investing money needed next year",
          "An investor with heavy outstanding debt",
        ],
        answer: 1,
        explain:
          "A long horizon and stable income let you wait out downturns, which is what equity risk requires.",
      },
    ],
  },
  {
    slug: "diversification",
    title: "Diversification: why not to put all eggs in one basket",
    category: "portfolio-management",
    difficulty: "Beginner",
    readMinutes: 5,
    progress: 40,
    summary:
      "Spreading across assets and sectors reduces the damage any single failure can do — without proportionally cutting expected returns.",
    sections: [
      {
        heading: "What diversification actually does",
        body: "When assets are imperfectly correlated, their losses rarely arrive together. Diversification does not remove risk — it removes the risk that is specific to one company, sector or asset class, leaving you with market risk.",
      },
      {
        heading: "Diversifying badly",
        body: "Owning ten stocks in the same sector is not diversified — they share the same risks. True diversification spans sectors, geographies, asset classes (equity, debt, gold) and holding periods.",
        bullets: [
          "Company risk: a single firm fails or disappoints.",
          "Sector risk: an industry-wide downturn (e.g. IT, banking).",
          "Market risk: broad declines that hit everything at once.",
        ],
      },
      {
        heading: "The cost of over-diversification",
        body: "Diversification has diminishing returns. Beyond roughly 20–30 well-chosen stocks, adding more names barely reduces risk — but it does dilute your best ideas and multiply tracking effort.",
      },
    ],
    quiz: [
      {
        question: "Which portfolio is genuinely diversified?",
        options: [
          "10 IT stocks across different sizes",
          "5 banks and 3 NBFCs",
          "Indian equity, debt funds, gold and US index funds",
          "20 stocks all in energy",
        ],
        answer: 2,
        explain:
          "Spreading across asset classes and geographies addresses different sources of risk; staying within one sector does not.",
      },
    ],
  },
  {
    slug: "pe-ratio",
    title: "P/E ratio: what investors really pay for",
    category: "financial-ratios",
    difficulty: "Intermediate",
    readMinutes: 6,
    progress: 30,
    summary:
      "The price-to-earnings ratio shows how much the market charges for each rupee of the company's earnings. High is not automatically bad.",
    sections: [
      {
        heading: "What the number means",
        body: "A P/E of 25 means investors pay ₹25 for every ₹1 of annual earnings. It is the number of years of current earnings you are pre-paying for the business.",
      },
      {
        heading: "High P/E: expensive or expected?",
        body: "A high P/E can mean overpricing — or it can mean the market expects fast future growth, which makes today's earnings a poor measure of tomorrow's. Compare a company's P/E to its own history and to its sector, not to the whole market.",
        bullets: [
          "Compare to the company's 5-year average P/E.",
          "Compare to sector peers with similar growth.",
          "Check whether earnings growth justifies the multiple.",
        ],
      },
      {
        heading: "The trap",
        body: "A low P/E can signal a bargain — or a business the market expects to shrink (a 'value trap'). P/E is one lens, not a verdict. Always pair it with growth, debt and quality metrics.",
      },
    ],
    quiz: [
      {
        question: "A stock trades at P/E 40 while its sector averages 22. What does this most likely suggest?",
        options: [
          "The stock is definitely overvalued",
          "The market expects above-average future growth",
          "The company has no debt",
          "Earnings are guaranteed to grow",
        ],
        answer: 1,
        explain:
          "A premium multiple usually reflects expected growth. It could also be overpricing — which is why you compare to history and peers.",
      },
    ],
  },
  {
    slug: "power-of-compounding",
    title: "SIPs and the power of compounding",
    category: "personal-finance",
    difficulty: "Beginner",
    readMinutes: 5,
    progress: 0,
    summary:
      "Small, regular investments grow quietly — because returns start earning returns of their own.",
    sections: [
      {
        heading: "How compounding works",
        body: "In year one, your money earns on the principal. In year two, it earns on principal plus last year's earnings. Over decades, the 'earnings on earnings' become the largest part of your wealth.",
        bullets: [
          "₹10,000/month at 12% for 30 years ≈ ₹3.5 crore.",
          "The same for 20 years ≈ ₹1 crore.",
          "The last decade does most of the work — starting early matters more than investing big later.",
        ],
      },
      {
        heading: "Why a SIP beats waiting",
        body: "A Systematic Investment Plan invests a fixed amount at regular intervals. It builds discipline, removes the need to time the market, and averages your purchase price through ups and downs.",
      },
      {
        heading: "The honest caveat",
        body: "Compounding assumes returns are reinvested and the market grows over time. It is a mathematical illustration — not a guarantee. Actual returns vary with markets.",
      },
    ],
    quiz: [
      {
        question: "Why does starting early matter so much for a SIP?",
        options: [
          "Early investments earn more dividend",
          "Compounding gives the longest time to compound",
          "Markets always rise in the first decade",
          "Taxes are lower in the early years",
        ],
        answer: 1,
        explain:
          "Time is the multiplier. Compounding grows with duration, so the same monthly amount produces far more over 30 years than over 20.",
      },
    ],
  },
  {
    slug: "etfs-vs-mutual-funds",
    title: "ETFs vs mutual funds: choosing your vehicle",
    category: "etfs",
    difficulty: "Intermediate",
    readMinutes: 5,
    progress: 0,
    summary:
      "Both pool money into a basket of securities. The difference is how they trade, what they cost, and how you buy them.",
    sections: [
      {
        heading: "The mechanics",
        body: "Mutual funds are priced once a day (NAV) and bought or sold through the fund house. ETFs trade on the exchange like stocks — their price moves through the day and you buy through a broker.",
      },
      {
        heading: "Cost and transparency",
        body: "Index ETFs typically have lower expense ratios than actively managed funds. ETFs also publish holdings daily, while many funds disclose periodically. Lower cost is a real advantage — but only if you don't over-trade and eat it up in brokerage.",
        bullets: [
          "Expense ratio: annual fee as a % of assets.",
          "Bid-ask spread: the friction of trading an ETF.",
          "SIP availability: funds auto-invest easily; ETFs need manual buys (or a broker SIP).",
        ],
      },
      {
        heading: "Which fits you?",
        body: "Like set-and-forget investing with any amount? A fund SIP is simpler. Like intraday control, lower fees and transparency? An ETF fits. For most long-term investors, either works — consistency matters more.",
      },
    ],
    quiz: [
      {
        question: "Which is a genuine advantage of index ETFs over active mutual funds?",
        options: [
          "Guaranteed higher returns",
          "Lower expense ratios and daily holdings disclosure",
          "No market risk",
          "Fixed NAV pricing",
        ],
        answer: 1,
        explain:
          "ETFs generally cost less and disclose holdings daily. They carry the same market risk as any equity investment.",
      },
    ],
  },
  {
    slug: "market-psychology",
    title: "Market psychology: the biases that cost you money",
    category: "market-psychology",
    difficulty: "Intermediate",
    readMinutes: 6,
    progress: 0,
    summary:
      "Fear and greed are not abstract — they show up as specific, documented biases. Recognising them is a skill you can train.",
    sections: [
      {
        heading: "Loss aversion",
        body: "The pain of losing ₹1,000 is roughly twice the pleasure of gaining ₹1,000. This pushes investors to sell winners too early and hold losers too long — the opposite of what often works.",
      },
      {
        heading: "Herd behaviour and recency",
        body: "We trust what everyone else is doing and over-weight recent experience. After a market rally, 'it always goes up' feels true. After a crash, 'it always goes down' feels true. Both are recency bias talking.",
        bullets: [
          "FOMO buying near the top of a rally.",
          "Panic selling near the bottom of a drawdown.",
          "Chasing last year's best-performing fund.",
        ],
      },
      {
        heading: "Anchoring and overconfidence",
        body: "Anchoring: you fixate on a price you remember (e.g. 'it was ₹3,000, so ₹2,400 is cheap') even when fundamentals changed. Overconfidence: after a few good trades, people take bigger, riskier bets. Written investing rules — a plan — are the antidote to both.",
      },
    ],
    quiz: [
      {
        question: "Loss aversion most commonly causes investors to…",
        options: [
          "Sell winners too early and hold losers too long",
          "Buy more when prices fall sharply",
          "Diversify more than needed",
          "Take systematic small profits",
        ],
        answer: 0,
        explain:
          "Because losses hurt more than gains please, investors tend to lock in small gains and avoid realising losses.",
      },
    ],
  },
  {
    slug: "capital-gains-tax",
    title: "Tax basics: capital gains, made simple",
    category: "tax-basics",
    difficulty: "Intermediate",
    readMinutes: 6,
    progress: 0,
    summary:
      "You don't pay tax on paper profits — only on realised gains. Understanding holding periods and regimes lets you keep more of what you earn.",
    sections: [
      {
        heading: "Realised vs unrealised",
        body: "A gain is 'realised' only when you sell. Until then, it is a paper gain and attracts no tax. This is why 'hold long-term' is not just strategy — it can be tax-efficient.",
      },
      {
        heading: "Equity holding periods (illustrative)",
        body: "For listed equity in India, gains on holdings of more than 12 months are long-term; under 12 months, short-term. Long-term gains above an exemption limit are taxed at a flat rate; short-term gains are taxed at a higher rate.",
        bullets: [
          "Holding period is measured from purchase to sale date.",
          "The exemption threshold and rates change with budgets — always verify the current year's rules.",
          "Debt funds, gold and property have different holding-period rules.",
        ],
      },
      {
        heading: "Tax-loss harvesting",
        body: "Realised losses can offset realised gains in the same year, reducing your tax bill. Selling a losing position to book the loss (and possibly rebuying later) is a legitimate planning tool — but never let tax tail wag the investment dog.",
      },
    ],
    quiz: [
      {
        question: "When is a capital gain taxable?",
        options: [
          "When the market value rises",
          "Only when the gain is realised by selling",
          "When the holding crosses one year",
          "Only for dividend income",
        ],
        answer: 1,
        explain:
          "Tax applies to realised gains. Unrealised (paper) gains are not taxed.",
      },
    ],
  },
  {
    slug: "rebalancing",
    title: "Rebalancing: keeping your risk in check",
    category: "portfolio-management",
    difficulty: "Intermediate",
    readMinutes: 5,
    progress: 0,
    summary:
      "Markets drift your portfolio away from its intended risk level. Rebalancing is the disciplined act of bringing it back.",
    sections: [
      {
        heading: "Why drift is dangerous",
        body: "If equities rally for years, their share of your portfolio grows — often to 85–90% when you planned 70%. Your risk is now higher than you decided it should be, even though nothing 'changed'.",
      },
      {
        heading: "How to rebalance",
        body: "Two common styles: calendar (quarterly or annual) and threshold (when an asset class moves more than 5% from target). You rebalance by selling a bit of what grew and buying what lagged — which feels wrong but is the entire point.",
        bullets: [
          "Sell winners, buy laggards — the opposite of instinct.",
          "New contributions can rebalance without selling (add to underweight asset).",
          "Watch transaction costs and taxes; a 1–2% band avoids churn.",
        ],
      },
      {
        heading: "What rebalancing is not",
        body: "It is not market timing and it does not maximise returns. Historically it modestly reduces risk for a small cost to returns — which is exactly the trade a disciplined investor wants.",
      },
    ],
    quiz: [
      {
        question: "The main purpose of rebalancing is to…",
        options: [
          "Maximise returns by timing the market",
          "Restore the portfolio to its intended risk level",
          "Minimise all transaction costs",
          "Guarantee positive returns",
        ],
        answer: 1,
        explain:
          "Rebalancing controls risk by restoring target weights. It is not about beating the market.",
      },
    ],
  },
];

export const investmentScenario: InvestmentScenario = {
  id: "s1",
  title: "The ₹50,000 decision",
  prompt:
    "You have ₹50,000 to invest for a goal that is 10 years away. Which portfolio do you choose?",
  options: [
    {
      id: "A",
      name: "Portfolio A — Aggressive",
      expectedReturn: "Higher (illustrative)",
      risk: "High",
      composition: "80% equity (index + mid-cap), 20% debt",
      outcome:
        "Likely to grow the most over 10 years, but can fall 30–40% in a bad year. Historically, equity-heavy portfolios recover and outpace others over long horizons.",
      tradeoffs:
        "You must hold through drawdowns without selling. If you can't stomach a 40% paper loss, this portfolio may be too risky for your behaviour — not just your numbers.",
    },
    {
      id: "B",
      name: "Portfolio B — Balanced",
      expectedReturn: "Moderate",
      risk: "Moderate",
      composition: "50% equity, 35% debt, 15% gold",
      outcome:
        "Participation in equity upside with a cushion. Expected to fall less in downturns and compound steadily — a common choice for a 10-year horizon.",
      tradeoffs:
        "You give up some upside compared to Portfolio A in strong bull markets, in exchange for a smoother ride that most investors can actually stay with.",
    },
    {
      id: "C",
      name: "Portfolio C — Conservative",
      expectedReturn: "Lower",
      risk: "Low",
      composition: "15% equity, 75% debt, 10% gold",
      outcome:
        "Rarely loses much, but historically grows far slower than inflation after a decade. Good for money you need soon — costly for a 10-year goal.",
      tradeoffs:
        "The real risk here is opportunity cost: for a 10-year goal, inflation plus low returns can shrink what your money buys. Safety has a price.",
    },
  ],
  lesson:
    "There is no objectively 'correct' answer — only the answer that fits your horizon, temperament and goals. The lesson: match portfolio risk to the goal's time frame, and choose a level of volatility you can hold through without panic-selling. That is what separates a plan from a guess.",
};

export const lessonBySlug = (slug: string): Lesson | undefined =>
  lessons.find((l) => l.slug === slug);
