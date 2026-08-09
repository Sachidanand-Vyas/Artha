"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoTooltip({
  label,
  text,
  className,
  iconClassName,
}: {
  /** The metric name shown as the anchor. */
  label: React.ReactNode;
  /** The explanation shown on hover/focus/tap. */
  text: string;
  className?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span
      className={cn("group/tip relative inline-flex items-center gap-1", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex cursor-help items-center gap-1 rounded text-left text-secondary transition-colors group-hover/tip:text-ink"
      >
        {label}
        <Info
          size={12}
          className={cn("text-muted transition-colors group-hover/tip:text-gold", iconClassName)}
        />
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-40 mb-2 w-64 -translate-x-1/2 rounded-xl border border-edgestrong bg-surface3 p-3 text-left text-xs font-normal leading-relaxed text-secondary shadow-2xl shadow-black/50"
        >
          {text}
          <span className="absolute left-1/2 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-edgestrong bg-surface3" />
        </span>
      )}
    </span>
  );
}

/** Simple inline explainer used under metrics. */
export function Explainer({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
      <Info size={12} className="mt-0.5 shrink-0 text-muted" />
      <span>{children}</span>
    </p>
  );
}
