"""Technical indicators — computed with pandas/numpy from real OHLCV data.

All functions take/return pandas objects. Nothing here is front-end concern:
the backend is the single source of truth for indicator values.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

TRADING_DAYS = 252  # annualisation factor for Indian/US equity sessions


def sma(close: pd.Series, period: int) -> float | None:
    """Simple moving average; None when there is not enough history."""
    if len(close) < period:
        return None
    return float(close.rolling(period).mean().iloc[-1])


def ema(close: pd.Series, period: int) -> float:
    """Exponential moving average (span-based, same as most charting platforms)."""
    return float(close.ewm(span=period, adjust=False).mean().iloc[-1])


def rsi(close: pd.Series, period: int = 14) -> float:
    """
    Relative Strength Index using Wilder's smoothing (the standard RSI definition):
    RSI = 100 - 100 / (1 + avg_gain / avg_loss) over `period` sessions.
    """
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    # Wilder's EMA equivalent: alpha = 1 / period
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    last_gain = float(avg_gain.iloc[-1])
    last_loss = float(avg_loss.iloc[-1])
    if last_loss == 0:
        return 100.0 if last_gain > 0 else 50.0
    rs = last_gain / last_loss
    return float(100.0 - 100.0 / (1.0 + rs))


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """
    MACD = EMA(fast) - EMA(slow); signal = EMA(signal) of the MACD line;
    histogram = MACD - signal. Returns (macd_line, signal_line, histogram_series).
    """
    macd_line = close.ewm(span=fast, adjust=False).mean() - close.ewm(
        span=slow, adjust=False
    ).mean()
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return float(macd_line.iloc[-1]), float(signal_line.iloc[-1]), histogram


def daily_returns(close: pd.Series) -> pd.Series:
    """Percentage change between consecutive closes."""
    return close.pct_change().dropna()


def annualised_volatility(close: pd.Series) -> float | None:
    """Annualised standard deviation of daily returns, in percent."""
    rets = daily_returns(close)
    if len(rets) < 20:
        return None
    return float(rets.std(ddof=1) * np.sqrt(TRADING_DAYS) * 100.0)


def return_over_sessions(close: pd.Series, sessions: int = 20) -> float | None:
    """Total % return over the last `sessions` bars."""
    if len(close) <= sessions:
        return None
    start = float(close.iloc[-(sessions + 1)])
    end = float(close.iloc[-1])
    if start == 0:
        return None
    return float((end / start - 1.0) * 100.0)


def latest_return(close: pd.Series) -> float:
    """Most recent 1-day return in percent."""
    if len(close) < 2:
        return 0.0
    prev = float(close.iloc[-2])
    if prev == 0:
        return 0.0
    return float((float(close.iloc[-1]) / prev - 1.0) * 100.0)


def volume_stats(volume: pd.Series, avg_window: int = 20, trend_window: int = 5):
    """
    Returns (latest_volume, avg_volume, volume_trend_ratio).
    volume_trend = 5-bar average / 20-bar average (>1 = recent activity above baseline).
    """
    latest = float(volume.iloc[-1]) if len(volume) else 0.0
    if len(volume) == 0:
        return latest, 0.0, 1.0
    avg20 = float(volume.tail(avg_window).mean())
    avg5 = float(volume.tail(trend_window).mean())
    ratio = float(avg5 / avg20) if avg20 > 0 else 1.0
    return latest, avg20, ratio


def support_resistance(df: pd.DataFrame, window: int = 60):
    """
    Support   = recent `window`-bar low  (pulled marginally below to avoid exact-touch noise)
    Resistance= recent `window`-bar high (pushed marginally above)
    """
    tail = df.tail(window)
    support = float(tail["Low"].min()) * 0.995
    resistance = float(tail["High"].max()) * 1.005
    return support, resistance
