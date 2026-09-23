"""
Recommendation engine — transparent feature-based scoring model.

Design goals (academic project, honesty first):
- BUY / HOLD / SELL derived ONLY from calculated indicator + fundamental values.
- Every feature has a documented weight and an interpretable range [-1, +1].
- The final score is the weighted average of available features, scaled to
  [-100, +100]. Features whose data is missing are dropped and their weight
  removed from the denominator — we never impute fake fundamentals.
- `signal_strength` (|score|) is a HEURISTIC measure of how strongly the
  features agree. It is NOT a calibrated probability and NOT model accuracy.
- Every non-neutral feature contributes a human-readable reason generated
  from the actual numbers, so the UI can explain the recommendation.

Score -> signal mapping:
    score >= +20 -> BUY
    score <= -20 -> SELL
    otherwise    -> HOLD
"""

from __future__ import annotations

from datetime import datetime, timezone

from models.schemas import Fundamentals, Prediction, TechnicalBlock

MODEL_NAME = (
    "Feature-based scoring model (transparent weights, see backend/services/prediction.py)"
)
BUY_THRESHOLD = 20.0
SELL_THRESHOLD = -20.0


def _clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def recommend(tech: TechnicalBlock, fund: Fundamentals) -> Prediction:
    """
    Score the stock from measurable features.

    Each entry: (feature_name, weight, feature_value in [-1,1], reason or None).
    Positive = supports a BUY, negative = supports a SELL, near 0 = neutral.
    """
    price = tech.price
    features: list[tuple[str, float, float, str | None]] = []

    # --- Trend features -----------------------------------------------------
    above20 = price > tech.sma_20
    features.append(
        (
            "trend_ma20",
            1.0,
            1.0 if above20 else -1.0,
            f"Price ({price:,.2f}) is {'above' if above20 else 'below'} the 20-day SMA ({tech.sma_20:,.2f})",
        )
    )

    above50 = price > tech.sma_50
    features.append(
        (
            "trend_ma50",
            1.2,
            1.0 if above50 else -1.0,
            f"Price ({price:,.2f}) is {'above' if above50 else 'below'} the 50-day SMA ({tech.sma_50:,.2f})",
        )
    )

    features.append(
        (
            "ma_alignment",
            0.8,
            1.0 if tech.sma20_above_50 else -1.0,
            "The 20-day average is above the 50-day average (short-term uptrend)"
            if tech.sma20_above_50
            else "The 20-day average is below the 50-day average (short-term downtrend)",
        )
    )

    macd_up = tech.macd >= tech.macd_signal
    features.append(
        (
            "macd_signal",
            1.2,
            1.0 if macd_up else -1.0,
            f"MACD ({tech.macd:,.2f}) is {'above' if macd_up else 'below'} its signal line ({tech.macd_signal:,.2f})",
        )
    )

    if len(tech.macd_histogram) >= 2:
        hist_improving = tech.macd_histogram[-1] >= tech.macd_histogram[-2]
        features.append(
            (
                "macd_histogram",
                0.5,
                1.0 if hist_improving else -1.0,
                "MACD histogram is rising (momentum improving)"
                if hist_improving
                else "MACD histogram is falling (momentum weakening)",
            )
        )

    # --- Momentum (RSI) -----------------------------------------------------
    rsi = tech.rsi
    if rsi > 70:
        rsi_val, rsi_reason = -1.0, f"RSI(14) = {rsi:.1f} — overbought, elevated pullback risk"
    elif rsi >= 55:
        rsi_val, rsi_reason = 1.0, f"RSI(14) = {rsi:.1f} — firm but not overbought momentum"
    elif rsi >= 45:
        rsi_val, rsi_reason = 0.0, f"RSI(14) = {rsi:.1f} — neutral momentum"
    elif rsi >= 30:
        rsi_val, rsi_reason = -0.5, f"RSI(14) = {rsi:.1f} — soft momentum"
    else:
        rsi_val, rsi_reason = 0.0, f"RSI(14) = {rsi:.1f} — oversold; direction ambiguous"
    features.append(("rsi", 1.0, rsi_val, rsi_reason))

    # --- Recent return ------------------------------------------------------
    r20 = tech.return_20d
    features.append(
        (
            "return_20d",
            0.8,
            _clamp(r20 / 10.0),  # +/-10% over 20 sessions saturates the signal
            f"20-session return is {r20:+.1f}%",
        )
    )

    # --- Volatility (risk-off factor) --------------------------------------
    v = tech.volatility
    if v > 30:
        vol_val = -0.5
    elif v >= 18:
        vol_val = 0.0
    else:
        vol_val = 0.3
    features.append(
        (
            "volatility",
            0.6,
            vol_val,
            f"Annualised volatility over the past year is {v:.1f}%",
        )
    )

    # --- Volume confirmation ------------------------------------------------
    if tech.volume_avg > 0:
        vol_delta = _clamp((tech.volume_trend - 1.0) / 0.5)  # +/-50% vs baseline
        direction = 1.0 if tech.latest_return >= 0 else -1.0
        features.append(
            (
                "volume_trend",
                0.5,
                vol_delta * direction,
                f"Recent volume is {tech.volume_trend:.2f}x the 20-day average",
            )
        )

    # --- Fundamentals (skipped entirely when unavailable) -------------------
    if fund.pe is not None:
        if fund.pe > 40:
            pe_val = -0.8
        elif fund.pe >= 25:
            pe_val = 0.0
        elif fund.pe >= 15:
            pe_val = 0.5
        else:
            pe_val = 0.8
        features.append(
            ("pe", 0.7, pe_val, f"P/E of {fund.pe:.1f} is {'rich' if fund.pe > 40 else 'moderate' if fund.pe >= 25 else 'contained'} vs common large-cap ranges")
        )

    if fund.roe is not None:
        roe_val = 0.8 if fund.roe > 15 else 0.3 if fund.roe >= 10 else -0.3
        features.append(
            ("roe", 0.7, roe_val, f"Return on equity is {fund.roe:.1f}%")
        )

    if fund.debt_to_equity is not None:
        de = fund.debt_to_equity
        de_val = 0.5 if de < 0.5 else 0.0 if de < 1.0 else -0.3 if de < 2.0 else -0.8
        features.append(
            ("debt_to_equity", 0.5, de_val, f"Debt-to-equity is {de:.2f}")
        )

    # --- Aggregate ----------------------------------------------------------
    total_weight = sum(w for _, w, _, _ in features)
    weighted = sum(w * v for _, w, v, _ in features)
    score = round(100.0 * weighted / total_weight, 1) if total_weight else 0.0

    if score >= BUY_THRESHOLD:
        signal = "BUY"
    elif score <= SELL_THRESHOLD:
        signal = "SELL"
    else:
        signal = "HOLD"

    # Reasons: features that actually moved the needle, strongest first.
    ranked = sorted(
        (f for f in features if abs(f[2]) >= 0.5 and f[3]),
        key=lambda f: abs(f[1] * f[2]),
        reverse=True,
    )
    reasons = [f[3] for f in ranked[:6]]
    if not reasons:
        reasons = ["Features are mixed — no measurable edge in either direction"]

    return Prediction(
        signal=signal,
        score=score,
        signal_strength=round(abs(score), 1),
        reasons=reasons,
        model=MODEL_NAME,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def build_insight(tech: TechnicalBlock, fund: Fundamentals) -> str:
    """
    One-line, data-derived summary for list views (watchlist/dashboard).
    Generated strictly from calculated values — never invented prose.
    """
    parts: list[str] = []
    if tech.price > tech.sma_50:
        parts.append("price above its 50-day average")
    else:
        parts.append("price below its 50-day average")

    if tech.rsi >= 70:
        parts.append(f"RSI {tech.rsi:.0f} (overbought)")
    elif tech.rsi >= 55:
        parts.append(f"RSI {tech.rsi:.0f} (firm momentum)")
    elif tech.rsi >= 45:
        parts.append(f"RSI {tech.rsi:.0f} (neutral)")
    else:
        parts.append(f"RSI {tech.rsi:.0f} (soft)")

    if tech.volatility:
        parts.append(f"{tech.volatility:.0f}% annualised volatility")
    if fund.pe is not None:
        parts.append(f"P/E {fund.pe:.1f}")

    text = "; ".join(parts) + "."
    # Uppercase only the first character — str.capitalize() would destroy "RSI", "P/E".
    return text[0].upper() + text[1:]
