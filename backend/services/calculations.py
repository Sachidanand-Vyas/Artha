"""
Deterministic finance calculations for the Advisor.

Arithmetic lives here — never in an LLM. The frontend parses the question into
structured inputs, this module computes the exact result, and the response
carries the formula so the UI can show its working (viva-friendly).

All results assume a CONSTANT return rate unless stated otherwise: they are
illustrations, not promises.
"""

from __future__ import annotations

from typing import Optional

from models.schemas import CalcIn

COMPOUNDS_PER_YEAR = 12  # monthly compounding, the usual convention for Indian products

FORMULAS = {
    "compound_fv": "FV = P x (1 + r/n)^(n*t),  n = 12 (monthly compounding)",
    "sip_fv": "FV = M x [((1+i)^n - 1) / i] x (1+i),  i = r/12,  n = months (annuity due)",
    "sip_required": "M = FV x i / [((1+i)^n - 1) x (1+i)],  i = r/12,  n = months",
    "lumpsum_required": "P = FV / (1 + r)^t",
    "inflation_adjusted": "Future amount = A x (1 + i)^t;  today's value = F / (1 + i)^t",
    "cagr": "CAGR = (End / Start)^(1/t) - 1",
    "absolute_return": "Return % = (Final - Initial) / Initial x 100",
    "required_rate": "Solve for r: principal x (1+r)^t + SIP(r) = target (r by bisection)",
}


def _need(value: Optional[float], name: str) -> float:
    if value is None:
        raise ValueError(f"Missing required input for this calculation: {name}")
    f = float(value)
    if f < 0:
        raise ValueError(f"{name} must not be negative")
    return f


def _future_value(monthly: float, rate_pct: float, years: float) -> float:
    """SIP future value (annuity due — each instalment earns one extra period)."""
    i = rate_pct / 100.0 / COMPOUNDS_PER_YEAR
    n = round(years * COMPOUNDS_PER_YEAR)
    if n <= 0:
        return 0.0
    if i == 0:
        return monthly * n
    return monthly * (((1 + i) ** n - 1) / i) * (1 + i)


def _lumpsum_fv(principal: float, rate_pct: float, years: float) -> float:
    return principal * (1 + rate_pct / 100.0 / COMPOUNDS_PER_YEAR) ** (
        COMPOUNDS_PER_YEAR * years
    )


def calculate(inp: CalcIn) -> dict:
    """Dispatch a calculation request -> {kind, formula, inputs, results}."""
    kind = inp.kind
    inputs = {k: v for k, v in inp.model_dump().items() if k != "kind" and v is not None}
    results: dict[str, float] = {}

    if kind == "compound_fv":
        p = _need(inp.principal, "principal amount")
        r = _need(inp.annual_rate_pct, "annual return rate (%)")
        t = _need(inp.years, "number of years")
        fv = _lumpsum_fv(p, r, t)
        results = {"future_value": fv, "gain": fv - p, "invested": p}

    elif kind == "sip_fv":
        m = _need(inp.monthly, "monthly amount")
        r = _need(inp.annual_rate_pct, "annual return rate (%)")
        t = _need(inp.years, "number of years")
        invested = m * t * COMPOUNDS_PER_YEAR
        fv = _future_value(m, r, t)
        results = {"future_value": fv, "invested": invested, "gain": fv - invested}

    elif kind == "sip_required":
        target = _need(inp.target, "target amount")
        r = _need(inp.annual_rate_pct, "annual return rate (%)")
        t = _need(inp.years, "number of years")
        i = r / 100.0 / COMPOUNDS_PER_YEAR
        n = round(t * COMPOUNDS_PER_YEAR)
        if n <= 0:
            raise ValueError("number of years must be positive")
        if i == 0:
            monthly = target / n
        else:
            monthly = target * i / (((1 + i) ** n - 1) * (1 + i))
        results = {"monthly_required": monthly, "total_contributed": monthly * n}

    elif kind == "lumpsum_required":
        target = _need(inp.target, "target amount")
        r = _need(inp.annual_rate_pct, "annual return rate (%)")
        t = _need(inp.years, "number of years")
        if r <= -100:
            raise ValueError("annual return rate (%) is out of range")
        p = target / (1 + r / 100.0) ** t
        results = {"principal_required": p}

    elif kind == "inflation_adjusted":
        amount = _need(inp.amount if inp.amount is not None else inp.target, "amount")
        rate = inp.inflation_pct if inp.inflation_pct is not None else inp.annual_rate_pct
        i = _need(rate, "inflation rate (%)")
        t = _need(inp.years, "number of years")
        factor = (1 + i / 100.0) ** t
        results = {
            # What today's amount must become in t years to buy the same things:
            "future_equivalent": amount * factor,
            # What an amount received t years from now is worth in today's money:
            "purchasing_power_after": amount / factor,
            # Share of purchasing power lost over the period:
            "erosion_pct": (1 - 1 / factor) * 100.0,
        }

    elif kind == "cagr":
        start = _need(inp.start_value if inp.start_value is not None else inp.principal, "start value")
        end = _need(inp.end_value if inp.end_value is not None else inp.target, "end value")
        t = _need(inp.years, "number of years")
        if start <= 0 or t <= 0:
            raise ValueError("start value and years must be positive")
        results = {"cagr_pct": ((end / start) ** (1 / t) - 1) * 100.0}

    elif kind == "absolute_return":
        initial = _need(inp.principal if inp.principal is not None else inp.start_value, "initial amount")
        final = _need(inp.target if inp.target is not None else inp.end_value, "final amount")
        if initial <= 0:
            raise ValueError("initial amount must be positive")
        results = {"return_pct": (final - initial) / initial * 100.0, "gain": final - initial}

    elif kind == "required_rate":
        target = _need(inp.target, "target amount")
        t = _need(inp.years, "number of years")
        if t <= 0:
            raise ValueError("number of years must be positive")
        principal = float(inp.principal or 0.0)
        monthly = float(inp.monthly or 0.0)
        if monthly <= 0 and principal <= 0:
            raise ValueError("required_rate needs either a starting amount or a monthly amount")

        if monthly <= 0:
            # Closed form for a pure lump sum.
            if principal <= 0:
                raise ValueError("starting amount must be positive")
            rate = ((target / principal) ** (1 / t) - 1) * 100.0
        else:
            # Bisection: monotonically increasing future value in the rate.
            def total(rate_pct: float) -> float:
                grown = _lumpsum_fv(principal, rate_pct, t) if principal else 0.0
                return grown + _future_value(monthly, rate_pct, t)

            if total(60.0) < target:
                raise ValueError(
                    "Target is unreachable within this horizon even at a 60% assumed return. "
                    "Increase the horizon or the contribution, or lower the target."
                )
            lo, hi = 0.0, 60.0
            for _ in range(80):
                mid = (lo + hi) / 2
                if total(mid) < target:
                    lo = mid
                else:
                    hi = mid
            rate = (lo + hi) / 2
        results = {"required_rate_pct": rate}

    else:  # pragma: no cover - Literal in the schema prevents this
        raise ValueError(f"Unsupported calculation type: {kind}")

    return {
        "kind": kind,
        "formula": FORMULAS.get(kind, ""),
        "inputs": inputs,
        "results": {k: round(v, 4) for k, v in results.items()},
    }
