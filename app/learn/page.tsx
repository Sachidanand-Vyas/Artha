"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { learningService } from "@/lib/services/learningService";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn } from "@/lib/utils";
import { ErrorState, PageHeader, SkeletonCard } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/Badge";
import { LearningCard } from "@/components/learn/LearningCard";
import { ScenarioSimulator } from "@/components/learn/ScenarioSimulator";

export default function LearnPage() {
  const { data: categories } = useAsync(() => learningService.getCategories(), []);
  const { data: lessons, loading: loadingLessons, error, reload } = useAsync(() => learningService.getLessons(), []);
  const [filter, setFilter] = useState<string>("all");

  const filtered = (lessons ?? []).filter((l) => filter === "all" || l.category === filter);
  const totalProgress = lessons?.length
    ? Math.round(lessons.reduce((a, l) => a + l.progress, 0) / lessons.length)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learn"
        subtitle="Financial literacy that explains the why — concepts, ratios, risk and market psychology, in plain language."
        right={
          lessons ? (
            <StatusPill tone="pos">
              <GraduationCap size={11} />
              Avg progress {totalProgress}%
            </StatusPill>
          ) : undefined
        }
      />

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            filter === "all"
              ? "border-gold/40 bg-goldsoft text-gold"
              : "border-edge bg-surface2/50 text-secondary hover:text-ink",
          )}
        >
          All
        </button>
        {(categories ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === c.id
                ? "border-gold/40 bg-goldsoft text-gold"
                : "border-edge bg-surface2/50 text-secondary hover:text-ink",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Featured interactive scenario */}
      <ScenarioSimulator />

      {/* Lesson cards */}
      <div>
        <h3 className="section-label mb-3">
          {filter === "all" ? "All lessons" : categories?.find((c) => c.id === filter)?.name}
        </h3>
        {error ? (
          <ErrorState onRetry={reload} />
        ) : loadingLessons ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} className="h-52" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-edgestrong p-8 text-center text-sm text-muted">
            Lessons in this category are coming soon.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((l) => (
              <LearningCard key={l.slug} lesson={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
