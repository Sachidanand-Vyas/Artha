"use client";

import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/Tooltip";

export function NumField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  step = 1,
  explain,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  explain?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-secondary">
        {explain ? <InfoTooltip label={label} text={explain} /> : label}
      </span>
      <div className="relative">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="input !py-2.5 tnum"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  format,
  explain,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  format?: (v: number) => string;
  explain?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-secondary">
          {explain ? <InfoTooltip label={label} text={explain} /> : label}
        </span>
        <span className="text-sm font-bold text-gold tnum">
          {format ? format(value) : value}
          {suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--gold)]"
      />
    </div>
  );
}

export function ResultRow({
  label,
  value,
  tone,
  explain,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "pos" | "neg" | "gold" | "ink";
  explain?: string;
}) {
  const tones = {
    pos: "text-pos",
    neg: "text-neg",
    gold: "text-gold",
    ink: "text-ink",
  };
  return (
    <div className="flex items-center justify-between border-b border-edge/60 py-2.5 text-sm last:border-0">
      <span className="flex items-center gap-1 text-secondary">
        {explain ? <InfoTooltip label={label} text={explain} /> : label}
      </span>
      <span className={cn("font-bold tnum", tone ? tones[tone] : tones.ink)}>{value}</span>
    </div>
  );
}

export function ToolShell({
  title,
  description,
  onBack,
  disclaimer,
  children,
  controls,
}: {
  title: string;
  description: string;
  onBack: () => void;
  disclaimer: string;
  children: React.ReactNode;
  controls?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-subtle -ml-2 !text-xs">
        <ArrowLeft size={13} /> All tools
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 max-w-xl text-[13px] text-secondary">{description}</p>
        </div>
        {controls}
      </div>
      {children}
      <p className="text-[11px] leading-relaxed text-muted">⚠️ {disclaimer}</p>
    </div>
  );
}

export function fmtLakh(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
