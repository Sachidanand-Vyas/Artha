"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import type { Lesson } from "@/lib/types";
import { learningService } from "@/lib/services/learningService";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Badge";
import { EmptyState, SkeletonCard, SkeletonRows } from "@/components/ui/States";

function Quiz({ lesson }: { lesson: Lesson }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const pick = (qi: number, oi: number) => {
    setAnswers((a) => (a[qi] === oi ? a : { ...a, [qi]: oi }));
  };

  return (
    <div className="space-y-4">
      {lesson.quiz.map((q, qi) => {
        const picked = answers[qi];
        const answered = picked !== undefined;
        return (
          <div key={qi} className="rounded-xl border border-edge bg-surface2/40 p-4">
            <p className="text-[13px] font-semibold text-ink">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, oi) => {
                const isPicked = picked === oi;
                const isAnswer = oi === q.answer;
                return (
                  <button
                    key={oi}
                    onClick={() => pick(qi, oi)}
                    disabled={answered}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                      answered && isAnswer
                        ? "border-pos/50 bg-possoft text-pos"
                        : answered && isPicked
                          ? "border-neg/50 bg-negsoft text-neg"
                          : answered
                            ? "border-edge opacity-50"
                            : "border-edge bg-surface2/60 hover:border-gold/40 hover:text-ink",
                    )}
                  >
                    <span className="font-mono text-[10px] opacity-60">{String.fromCharCode(65 + oi)}</span>
                    {opt}
                    {answered && isAnswer && <CheckCircle2 size={13} className="ml-auto shrink-0" />}
                    {answered && isPicked && !isAnswer && <XCircle size={13} className="ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
            {answered && (
              <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-secondary">
                <span className="mt-0.5 shrink-0 text-gold">✦</span>
                {q.explain}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LessonView({ slug }: { slug: string }) {
  const { data: lesson, loading } = useAsync(() => learningService.getLesson(slug), [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-64" />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (!lesson) {
    return (
      <EmptyState
        title="Lesson not found"
        message="This lesson does not exist in the sample curriculum."
        action={
          <Link href="/learn" className="btn-primary">
            Back to Learn
          </Link>
        }
      />
    );
  }

  const diffTone =
    lesson.difficulty === "Beginner"
      ? "bg-possoft text-pos"
      : lesson.difficulty === "Intermediate"
        ? "bg-goldsoft text-gold"
        : "bg-negsoft text-neg";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/learn" className="btn-subtle -ml-2 !text-xs">
        <ArrowLeft size={13} /> All lessons
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", diffTone)}>
            {lesson.difficulty}
          </span>
          <span className="text-xs text-muted">· {lesson.readMinutes} min read</span>
          <StatusPill tone="info">Interactive quiz inside</StatusPill>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{lesson.title}</h1>
        <p className="mt-1.5 text-sm text-secondary">{lesson.summary}</p>
      </div>

      {lesson.sections.map((sec, i) => (
        <Card key={i} className="p-6">
          <h2 className="text-base font-bold text-ink">
            <span className="mr-2 text-gold tnum">{String(i + 1).padStart(2, "0")}</span>
            {sec.heading}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-secondary">{sec.body}</p>
          {sec.bullets && (
            <ul className="mt-3 space-y-1.5">
              {sec.bullets.map((b, j) => (
                <li key={j} className="flex items-start gap-2 text-[13px] leading-relaxed text-secondary">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/70" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      {lesson.quiz.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-bold text-ink">Check your understanding</h2>
          <p className="mt-1 text-xs text-muted">
            Answer honestly — wrong answers teach more than right ones. Instant feedback explains the reasoning.
          </p>
          <div className="mt-4">
            <Quiz lesson={lesson} />
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-edge bg-surface2/40 px-5 py-4">
        <p className="text-xs text-muted">
          Lesson progress is tracked client-side in this demo. A learning service can persist it later.
        </p>
        <Link href="/learn" className="btn-ghost !py-1.5 !px-3 text-xs">
          More lessons
        </Link>
      </div>
    </div>
  );
}

export default function LessonPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  return <LessonView key={slug} slug={slug} />;
}
