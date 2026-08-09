import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import type { Lesson } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/Progress";

const DIFF: Record<Lesson["difficulty"], string> = {
  Beginner: "bg-possoft text-pos",
  Intermediate: "bg-goldsoft text-gold",
  Advanced: "bg-negsoft text-neg",
};

export function LearningCard({ lesson }: { lesson: Lesson }) {
  return (
    <Link
      href={`/learn/${lesson.slug}`}
      className="card card-hover group flex flex-col p-5"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
            DIFF[lesson.difficulty],
          )}
        >
          {lesson.difficulty}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <BookOpen size={11} />
          {lesson.readMinutes} min
        </span>
      </div>

      <h3 className="mt-3 text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-gold">
        {lesson.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-secondary">
        {lesson.summary}
      </p>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-muted">Progress</span>
          <span className="font-semibold tnum text-secondary">{lesson.progress}%</span>
        </div>
        <ProgressBar value={lesson.progress} tone={lesson.progress === 100 ? "pos" : "gold"} />
      </div>

      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-gold">
        {lesson.progress === 100 ? "Review lesson" : "Start learning"}
        <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
