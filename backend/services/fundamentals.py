"""Fundamental data extraction from the provider payload.

Rule: if the provider does not expose a metric we return None ("N/A" in the UI).
Every conversion unit is documented — no fabricated values, ever.
"""

from __future__ import annotations

from typing import Any, Optional

from models.schemas import Fundamentals


def _num(info: dict, *keys: str) -> Optional[float]:
    """First numeric value among keys, or None."""
    for k in keys:
        v = info.get(k)
        if v is None:
            continue
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if f != f:  # NaN guard
            continue
        return f
    return None


def _frac_to_pct(value: Optional[float], max_frac: float = 5.0) -> Optional[float]:
    """Convert a fraction-style value (0.12) to percent (12.0); leave percent values as-is."""
    if value is None:
        return None
    return value * 100.0 if abs(value) < max_frac else value


def extract_fundamentals(info: dict[str, Any]) -> Fundamentals:
    """
    Map provider field names to Artha's fundamental block.

    Yahoo/yfinance conventions:
      trailingPE, priceToBook, trailingEps, beta   -> raw numbers
      returnOnEquity / returnOnCapitalEmployed      -> fraction (0.091 => 9.1%)
      debtToEquity                                 -> percentage (40 => 0.40 ratio)
      marketCap, totalRevenue, netIncomeToCommon   -> absolute currency units
      revenueGrowth / earningsGrowth               -> fraction -> percent YoY
      dividendYield                                -> see _dividend_yield_percent()

    All conversions are defensive: missing/odd values -> None (displayed as N/A).
    """
    if not info:
        return Fundamentals()

    pe = _num(info, "trailingPE", "forwardPE")
    pb = _num(info, "priceToBook")
    eps = _num(info, "trailingEps", "forwardEps")
    roe = _frac_to_pct(_num(info, "returnOnEquity"), max_frac=1.5)
    roce = _frac_to_pct(_num(info, "returnOnCapitalEmployed", "returnOnCapital"), max_frac=1.5)
    de_raw = _num(info, "debtToEquity")
    # Yahoo serves debtToEquity as a percentage (40 => 0.40 ratio).
    de = (de_raw / 100.0 if abs(de_raw) > 3 else de_raw) if de_raw is not None else None
    market_cap = _num(info, "marketCap")
    revenue = _num(info, "totalRevenue")
    net_profit = _num(info, "netIncomeToCommon", "netIncome")
    rev_growth = _frac_to_pct(_num(info, "revenueGrowth"))
    profit_growth = _frac_to_pct(_num(info, "earningsGrowth", "earningsQuarterlyGrowth"))
    div_yield = _dividend_yield_percent(info)
    beta = _num(info, "beta")

    return Fundamentals(
        pe=round(pe, 2) if pe is not None else None,
        pb=round(pb, 2) if pb is not None else None,
        eps=round(eps, 2) if eps is not None else None,
        roe=round(roe, 2) if roe is not None else None,
        roce=round(roce, 2) if roce is not None else None,
        debt_to_equity=round(de, 3) if de is not None else None,
        market_cap=market_cap,
        revenue=revenue,
        net_profit=net_profit,
        revenue_growth=round(rev_growth, 2) if rev_growth is not None else None,
        profit_growth=round(profit_growth, 2) if profit_growth is not None else None,
        dividend_yield=round(div_yield, 2) if div_yield is not None else None,
        beta=round(beta, 3) if beta is not None else None,
    )


def _dividend_yield_percent(info: dict) -> Optional[float]:
    """
    yfinance changed `dividendYield` from fraction (0.0125) to percent (1.25)
    around v0.2.50. Detect on the installed version; keep null if unusable.
    """
    raw = _num(info, "dividendYield")
    if raw is None:
        return None
    try:
        import yfinance

        parts = tuple(int(p) for p in yfinance.__version__.split(".")[:3] if p.isdigit())
    except Exception:
        parts = (0, 0, 0)
    if parts >= (0, 2, 50):
        return raw  # already percent
    return raw * 100.0  # legacy fraction -> percent
