import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  className,
  tone = "gold",
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: "gold" | "pos" | "info" | "neg";
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const tones = {
    gold: "bg-gold",
    pos: "bg-pos",
    info: "bg-info",
    neg: "bg-neg",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface3", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 84,
  stroke = 7,
  tone = "gold",
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "gold" | "pos" | "info" | "neg";
  label: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const tones = {
    gold: "var(--gold)",
    pos: "var(--pos)",
    info: "var(--info)",
    neg: "var(--neg)",
  };
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tones[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-ink tnum">{label}</span>
        {sublabel && <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{sublabel}</span>}
      </div>
    </div>
  );
}
