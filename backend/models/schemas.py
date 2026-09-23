"""
Pydantic response models for the Artha backend.

Conventions:
- snake_case field names on the wire (the frontend maps them to its camelCase types).
- Optional[...] fields are returned as `null` when the data provider does not
  expose the value. We NEVER fabricate financial numbers.
- Every payload that carries market data includes `timestamp` (latest available
  bar/quote time) and `source` so the UI can be honest about data recency.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class Candle(BaseModel):
    """One OHLCV bar. `time` is unix seconds (UTC)."""

    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class Fundamentals(BaseModel):
    """Provider-supplied fundamental metrics. null = not available from provider."""

    pe: Optional[float] = None
    pb: Optional[float] = None
    eps: Optional[float] = None
    roe: Optional[float] = None            # percent, e.g. 9.4
    roce: Optional[float] = None           # percent (rarely exposed by the provider)
    debt_to_equity: Optional[float] = None # ratio, e.g. 0.35
    market_cap: Optional[float] = None     # absolute currency units
    revenue: Optional[float] = None        # absolute currency units
    net_profit: Optional[float] = None     # absolute currency units
    revenue_growth: Optional[float] = None # percent YoY
    profit_growth: Optional[float] = None  # percent YoY
    dividend_yield: Optional[float] = None # percent, e.g. 0.35
    beta: Optional[float] = None


class TechnicalBlock(BaseModel):
    """Latest technical indicator values, computed on the backend from real OHLCV."""

    price: float
    rsi: float                            # RSI(14), Wilder smoothing
    macd: float                           # MACD line (12,26)
    macd_signal: float                    # signal line (EMA9 of MACD)
    macd_histogram: list[float] = Field(default_factory=list)  # last 24 bars
    sma_20: float
    sma_50: float
    sma_200: Optional[float] = None
    ema_20: float
    support: float                        # 60-bar low (slightly below)
    resistance: float                     # 60-bar high (slightly above)
    volatility: float                     # annualised stdev of daily returns (percent)
    volume: float                         # latest bar volume
    volume_avg: float                     # 20-bar average volume
    volume_trend: float                   # 5-bar avg volume / 20-bar avg volume (ratio)
    latest_return: float                  # latest 1-day return (percent)
    return_20d: float                     # 20-session return (percent)
    sma20_above_50: bool


class Prediction(BaseModel):
    """
    Transparent feature-based recommendation.

    `score`        : weighted sum of standardised features, in [-100, +100].
    `signal_strength` : |score| (0-100). This is a HEURISTIC strength measure,
                        NOT a calibrated probability or model accuracy figure.
    """

    signal: Literal["BUY", "HOLD", "SELL"]
    score: float
    signal_strength: float
    reasons: list[str] = Field(default_factory=list)
    model: str
    generated_at: str


class StockSummary(BaseModel):
    """Listing/quote + fundamentals — used by GET /api/stocks (universe)."""

    symbol: str
    name: str
    exchange: str
    country: Literal["IN", "US"]
    sector: str
    currency: Literal["INR", "USD"]
    price: float
    change: float
    change_percent: float
    timestamp: str                        # ISO8601 — latest available bar time
    source: str                           # e.g. "Yahoo Finance"
    week52_high: Optional[float] = None
    week52_low: Optional[float] = None
    risk: Optional[Literal["Low", "Moderate", "High"]] = None  # derived from realised volatility
    insight: str = ""                     # one-line, generated from actual values
    summary: str = ""                     # provider company description
    fundamentals: Fundamentals


class StockAnalysis(StockSummary):
    """Full analysis payload — GET /api/stocks/{symbol}."""

    historical_data: list[Candle] = Field(default_factory=list)
    technical: TechnicalBlock
    prediction: Prediction


class IndexQuoteOut(BaseModel):
    symbol: str
    name: str
    exchange: str
    value: float
    change: float
    change_percent: float
    spark: list[float] = Field(default_factory=list)
    currency: Literal["INR", "USD"]
    market: Literal["INDIA", "GLOBAL"]
    timestamp: str
    source: str


class Breadth(BaseModel):
    """Advance/decline counts. null = provider cannot supply it (shown as N/A)."""

    advances: Optional[int] = None
    declines: Optional[int] = None
    unchanged: Optional[int] = None
    available: bool = False
    note: str = ""


class SectorMove(BaseModel):
    sector: str
    change_percent: float


class MarketSnapshot(BaseModel):
    indices: list[IndexQuoteOut] = Field(default_factory=list)
    breadth: Breadth
    sectors: list[SectorMove] = Field(default_factory=list)
    sectors_note: str = ""
    timestamp: str
    source: str


class HoldingIn(BaseModel):
    """A user holding (quantity/average cost are user inputs, not market data)."""

    symbol: str
    qty: float
    avg_cost: float


class HoldingValuation(BaseModel):
    symbol: str
    name: str
    sector: str
    country: Literal["IN", "US"]
    currency: Literal["INR", "USD"]
    qty: float
    avg_cost: float
    invested: float
    ltp: Optional[float] = None            # latest available market price
    day_change: Optional[float] = None     # rupee change vs previous close (per holding)
    day_change_percent: Optional[float] = None
    value: Optional[float] = None          # qty * ltp
    return_percent: Optional[float] = None
    weight_percent: float = 0.0            # share of total valued equity
    available: bool = True                 # false when quote could not be fetched


class PortfolioTotals(BaseModel):
    invested: float
    value: float
    day_change: float
    unrealized_pnl: float
    return_percent: float


class PortfolioValuation(BaseModel):
    holdings: list[HoldingValuation] = Field(default_factory=list)
    totals: PortfolioTotals
    timestamp: str
    source: str


class CalcIn(BaseModel):
    """
    Structured calculation request parsed out of the Advisor question.
    Only the fields a given `kind` needs are set; the rest stay null.
    """

    kind: Literal[
        "compound_fv",
        "sip_fv",
        "sip_required",
        "lumpsum_required",
        "inflation_adjusted",
        "cagr",
        "absolute_return",
        "required_rate",
    ]
    principal: Optional[float] = None   # starting / lump-sum amount
    monthly: Optional[float] = None     # SIP instalment
    target: Optional[float] = None      # goal / end amount
    amount: Optional[float] = None      # amount for inflation questions
    annual_rate_pct: Optional[float] = None
    inflation_pct: Optional[float] = None
    years: Optional[float] = None
    start_value: Optional[float] = None
    end_value: Optional[float] = None


class CalcResult(BaseModel):
    kind: str
    formula: str
    inputs: dict
    results: dict


class AdvisorAskIn(BaseModel):
    """Question handed to the optional LLM layer (context is only what's needed)."""

    question: str
    history: list[dict] = Field(default_factory=list)   # [{role, content}]
    context: Optional[dict] = None                      # structured Artha data
    intent: str = ""
