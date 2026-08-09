"use client";

import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-edge bg-surface2/60 p-1",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-lg font-medium transition-all duration-150",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
            value === item.id
              ? "bg-surface3 text-ink shadow-sm"
              : "text-muted hover:text-secondary",
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 py-px text-[10px] tnum",
                value === item.id ? "bg-gold/20 text-gold" : "bg-surface3 text-muted",
              )}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
