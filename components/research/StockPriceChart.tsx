"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { TimeRange } from "@/lib/types";
import type { GeneratedCandle } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

/** Canvas cannot resolve CSS var() strings — turn a hex token into rgba(). */
function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex; // already rgba()/unknown format — use as-is
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function StockPriceChart({
  candles,
  range,
  showMAs = false,
  height = 360,
}: {
  candles: GeneratedCandle[];
  range: TimeRange;
  showMAs?: boolean;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Canvas colors are captured at mount — re-create the chart on theme change.
  const theme = useTheme();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Resolve design tokens to concrete colors for the ACTIVE theme.
    // Dark values equal the previously hardcoded colors, so dark is unchanged.
    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const gold = v("--gold", "#d4a94f");
    const pos = v("--pos", "#16c784");
    const neg = v("--neg", "#ef4e63");
    const chart1 = v("--chart-1", "#5b8def");
    const grid = v("--chart-grid", "rgba(150,168,196,0.07)");
    const edge = v("--edge", "rgba(150,168,196,0.12)");
    const text3 = v("--text-3", "#5f6d80");

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text3,
        fontFamily: "'Geist', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: { borderColor: edge },
      timeScale: {
        borderColor: edge,
        timeVisible: range === "1D" || range === "1W",
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: rgba(gold, 0.4), labelBackgroundColor: gold },
        horzLine: { color: rgba(gold, 0.4), labelBackgroundColor: gold },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: pos,
      downColor: neg,
      borderVisible: false,
      wickUpColor: pos,
      wickDownColor: neg,
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? rgba(pos, 0.32) : rgba(neg, 0.32),
      })),
    );

    if (showMAs) {
      const closes = candles.map((c) => c.close);
      const ma = (n: number) => {
        const out: { time: UTCTimestamp; value: number }[] = [];
        for (let i = n - 1; i < closes.length; i++) {
          const slice = closes.slice(i - n + 1, i + 1);
          out.push({
            time: candles[i].time as UTCTimestamp,
            value: slice.reduce((a, b) => a + b, 0) / n,
          });
        }
        return out;
      };
      const ma20 = chart.addSeries(LineSeries, {
        color: chart1,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ma50 = chart.addSeries(LineSeries, {
        color: gold,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ma20.setData(ma(20));
      ma50.setData(ma(50));
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, range, showMAs, theme]);

  return <div ref={containerRef} style={{ height, width: "100%" }} />;
}
