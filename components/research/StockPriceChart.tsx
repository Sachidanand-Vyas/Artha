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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#5f6d80",
        fontFamily: "'Geist', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(150,168,196,0.05)" },
        horzLines: { color: "rgba(150,168,196,0.05)" },
      },
      rightPriceScale: { borderColor: "rgba(150,168,196,0.12)" },
      timeScale: {
        borderColor: "rgba(150,168,196,0.12)",
        timeVisible: range === "1D" || range === "1W",
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(212,169,79,0.4)", labelBackgroundColor: "#d4a94f" },
        horzLine: { color: "rgba(212,169,79,0.4)", labelBackgroundColor: "#d4a94f" },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#16c784",
      downColor: "#ef4e63",
      borderVisible: false,
      wickUpColor: "#16c784",
      wickDownColor: "#ef4e63",
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
        color: c.close >= c.open ? "rgba(22,199,132,0.32)" : "rgba(239,78,99,0.32)",
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
        color: "#5b8def",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ma50 = chart.addSeries(LineSeries, {
        color: "#d4a94f",
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
  }, [candles, range, showMAs]);

  return <div ref={containerRef} style={{ height, width: "100%" }} />;
}
