import { cn } from "@/lib/utils";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#artha-gold)" />
      <rect x="1" y="1" width="38" height="38" rx="10" stroke="rgba(255,255,255,0.18)" />
      <path
        d="M13 28 L20 11 L27 28 M15.6 22.5 H24.4"
        stroke="#1a1305"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="artha-gold" x1="4" y1="2" x2="36" y2="38">
          <stop stopColor="#e3bd6d" />
          <stop offset="1" stopColor="#b98d3c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={compact ? 30 : 34} />
      {!compact && (
        <div className="leading-none">
          <div className="text-[17px] font-extrabold tracking-[0.22em] text-ink">
            ARTHA
          </div>
          <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-gold">
            AI-Powered Wealth Intelligence
          </div>
        </div>
      )}
    </div>
  );
}
