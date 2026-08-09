"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  width = 96,
  height = 28,
  positive,
  className,
  fill = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  className?: string;
  fill?: boolean;
}) {
  const uid = useId();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = positive ?? data[data.length - 1] >= data[0];
  const stroke = up ? "var(--pos)" : "var(--neg)";
  const areaId = `spark-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${width},${height} L0,${height} Z`}
            fill={`url(#${areaId})`}
          />
        </>
      )}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={stroke} />
    </svg>
  );
}
