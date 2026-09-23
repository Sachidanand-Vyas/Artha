"""Portfolio calculation service.

Quantities and average costs are *user inputs*; prices, day changes and all
derived values come from the same market-data layer every other page uses —
one source of truth for prices across Artha.
"""

from __future__ import annotations

from models.schemas import (
    HoldingIn,
    HoldingValuation,
    PortfolioTotals,
    PortfolioValuation,
)
from utils import cache

from .market_data import PROVIDER_NAME

HOLDINGS_TTL = 120.0  # seconds — reuses the cached universe quotes


def value_portfolio(holdings: list[HoldingIn]) -> PortfolioValuation:
    """
    current value = quantity x latest available market price.

    Holdings whose quote cannot be fetched are returned with available=False
    and null values (shown as N/A) instead of being silently dropped or
    estimated.
    """
    def _compute() -> PortfolioValuation:
        # Imported lazily to avoid a circular import at module load.
        from .universe import get_universe_snapshots

        snapshots = get_universe_snapshots()  # symbol -> StockSummary-like dict
        rows: list[HoldingValuation] = []
        value_total = 0.0
        day_change_total = 0.0
        last_ts = ""

        for h in holdings:
            snap = snapshots.get(h.symbol.upper())
            invested = h.qty * h.avg_cost
            if snap is None or snap.get("price") is None:
                rows.append(
                    HoldingValuation(
                        symbol=h.symbol.upper(),
                        name=h.symbol.upper(),
                        sector="Other",
                        country="IN",
                        currency="INR",
                        qty=h.qty,
                        avg_cost=h.avg_cost,
                        invested=round(invested, 2),
                        available=False,
                    )
                )
                continue

            ltp = float(snap["price"])
            change = float(snap.get("change") or 0.0)
            change_pct = float(snap.get("change_percent") or 0.0)
            value = h.qty * ltp
            value_total += value
            day_change_total += h.qty * change
            last_ts = max(last_ts, snap.get("timestamp") or "")
            rows.append(
                HoldingValuation(
                    symbol=h.symbol.upper(),
                    name=snap.get("name", h.symbol.upper()),
                    sector=snap.get("sector") or "Other",
                    country=snap.get("country", "IN"),
                    currency=snap.get("currency", "INR"),
                    qty=h.qty,
                    avg_cost=h.avg_cost,
                    invested=round(invested, 2),
                    ltp=round(ltp, 2),
                    day_change=round(h.qty * change, 2),
                    day_change_percent=round(change_pct, 3),
                    value=round(value, 2),
                    return_percent=round((value - invested) / invested * 100.0, 2)
                    if invested
                    else 0.0,
                    available=True,
                )
            )

        # Totals cover only holdings we could price, so invested and value stay
        # on the same basis (unavailable rows are listed but excluded here).
        invested_priced = sum(r.invested for r in rows if r.available)
        pnl = value_total - invested_priced
        # Weight = share of the *valued* equity; unavailable rows get 0.
        for r in rows:
            if r.available and r.value and value_total:
                r.weight_percent = round(r.value / value_total * 100.0, 2)

        totals = PortfolioTotals(
            invested=round(invested_priced, 2),
            value=round(value_total, 2),
            day_change=round(day_change_total, 2),
            unrealized_pnl=round(pnl, 2),
            return_percent=round(pnl / invested_priced * 100.0, 2) if invested_priced else 0.0,
        )

        return PortfolioValuation(
            holdings=rows,
            totals=totals,
            timestamp=last_ts,
            source=PROVIDER_NAME,
        )

    return cache.cached(
        ("portfolio", tuple((h.symbol, h.qty, h.avg_cost) for h in holdings)),
        HOLDINGS_TTL,
        _compute,
    )
