import { cn, num2 } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function ChangeText({
  value,
  pct,
  className,
  size = "sm",
}: {
  value: number;
  pct: number;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const up = value >= 0;
  const sizes = {
    xs: "text-[11px]",
    sm: "text-xs",
    md: "text-sm",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tnum",
        up ? "text-pos" : "text-neg",
        sizes[size],
        className,
      )}
    >
      {value === 0 ? (
        <Minus size={13} />
      ) : up ? (
        <ArrowUpRight size={13} />
      ) : (
        <ArrowDownRight size={13} />
      )}
      {up ? "+" : ""}
      {num2(value)}
      <span className="opacity-80">
        ({up ? "+" : ""}
        {pct.toFixed(2)}%)
      </span>
    </span>
  );
}
