"""Technical indicator service — computes the indicator block served by the API.

Input: a pandas OHLCV frame (daily bars for the analysis pipeline).
Output: models.schemas.TechnicalBlock (latest values + MACD histogram tail).
"""

from __future__ import annotations

import pandas as pd

from models.schemas import TechnicalBlock
from utils import indicators as ind


def compute_technicals(df: pd.DataFrame) -> TechnicalBlock:
    if df is None or len(df) < 30:
        raise ValueError("Not enough history to compute technical indicators")

    close = df["Close"].astype(float)
    volume = df["Volume"].astype(float) if "Volume" in df.columns else pd.Series(0.0, index=df.index)

    price = float(close.iloc[-1])
    rsi = ind.rsi(close, 14)
    macd_line, signal_line, histogram = ind.macd(close)
    sma20 = ind.sma(close, 20)
    sma50 = ind.sma(close, 50)
    sma200 = ind.sma(close, 200)
    ema20 = ind.ema(close, 20)
    vol_pct = ind.annualised_volatility(close)
    latest, vol_avg, vol_trend = ind.volume_stats(volume)
    support, resistance = ind.support_resistance(df, window=60)
    ret_20d = ind.return_over_sessions(close, 20)
    latest_ret = ind.latest_return(close)

    return TechnicalBlock(
        price=price,
        rsi=round(rsi, 2),
        macd=round(macd_line, 4),
        macd_signal=round(signal_line, 4),
        macd_histogram=[round(float(v), 4) for v in histogram.tail(24).tolist()],
        sma_20=round(sma20, 4) if sma20 is not None else price,
        sma_50=round(sma50, 4) if sma50 is not None else price,
        sma_200=round(sma200, 4) if sma200 is not None else None,
        ema_20=round(ema20, 4),
        support=round(support, 4),
        resistance=round(resistance, 4),
        volatility=round(vol_pct, 2) if vol_pct is not None else 0.0,
        volume=float(latest),
        volume_avg=round(vol_avg, 2),
        volume_trend=round(vol_trend, 3),
        latest_return=round(latest_ret, 3),
        return_20d=round(ret_20d, 2) if ret_20d is not None else 0.0,
        sma20_above_50=bool(sma20 is not None and sma50 is not None and sma20 > sma50),
    )


def classify_risk(vol_pct: float | None) -> str | None:
    """
    Risk label derived from realised (annualised) volatility — computed, not guessed:
      < 18%  -> Low
      < 30%  -> Moderate
      >= 30% -> High
    """
    if vol_pct is None:
        return None
    if vol_pct < 18:
        return "Low"
    if vol_pct < 30:
        return "Moderate"
    return "High"
