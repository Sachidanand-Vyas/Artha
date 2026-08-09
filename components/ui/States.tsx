import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("skeleton h-32", className)} />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${88 - (i % 4) * 11}%` }} />
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-secondary">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-edgestrong px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface2 text-muted">
        <Inbox size={20} />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-sm text-xs text-muted">{message}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong while loading this data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-neg/25 bg-negsoft/40 px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-negsoft text-neg">
        <AlertTriangle size={20} />
      </div>
      <p className="max-w-sm text-sm text-secondary">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-ghost mt-1 !py-1.5 !px-3 text-xs"
        >
          Try again
        </button>
      )}
    </div>
  );
}


