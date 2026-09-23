"use client";

/**
 * FIRST-TIME ONBOARDING — five short questions, then straight to the app.
 *
 * Answers are saved to the user's profile on the backend (POST
 * /api/user/preferences) and are editable later in Settings. The final step
 * chooses how the portfolio starts: virtual money, a manual import, or just
 * exploring — no preferences are ever fabricated.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, PieChart, Search, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { authService } from "@/lib/services/authService";
import { ApiError } from "@/lib/services/api";
import { portfolioService } from "@/lib/services/portfolioService";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { Logo } from "@/components/layout/Logo";

interface Choice {
  value: string;
  label: string;
  hint?: string;
}

const STEPS: { key: string; title: string; subtitle: string; choices: Choice[] }[] = [
  {
    key: "investment_goal",
    title: "What are you investing for?",
    subtitle: "Pick the goal closest to your reason — you can change it later in Settings.",
    choices: [
      { value: "Wealth creation", label: "Wealth creation", hint: "Grow money steadily over time" },
      { value: "Saving for a major goal", label: "Saving for a major goal", hint: "Home, wedding, education, a big purchase" },
      { value: "Retirement", label: "Retirement", hint: "Build a long-term corpus" },
      { value: "Learning about investing", label: "Learning about investing", hint: "Understand markets first" },
      { value: "Short-term investing", label: "Short-term investing", hint: "Months, not decades" },
    ],
  },
  {
    key: "monthly_range",
    title: "How much do you want to invest per month?",
    subtitle: "A rough range is enough — this only calibrates examples and planning tools.",
    choices: [
      { value: "₹1,000–₹5,000", label: "₹1,000 – ₹5,000", hint: "per month" },
      { value: "₹5,000–₹10,000", label: "₹5,000 – ₹10,000", hint: "per month" },
      { value: "₹10,000–₹25,000", label: "₹10,000 – ₹25,000", hint: "per month" },
      { value: "₹25,000+", label: "₹25,000+", hint: "per month" },
    ],
  },
  {
    key: "risk_profile",
    title: "How do you feel about risk?",
    subtitle: "How much portfolio fall you could watch without panic-selling.",
    choices: [
      { value: "Conservative", label: "Conservative", hint: "Smaller swings matter more than big gains" },
      { value: "Moderate", label: "Moderate", hint: "Some ups and downs are acceptable" },
      { value: "Aggressive", label: "Aggressive", hint: "I can stomach deep drawdowns for growth" },
    ],
  },
  {
    key: "experience",
    title: "How much investing experience do you have?",
    subtitle: "This only shapes how much explanation Artha assumes.",
    choices: [
      { value: "Beginner", label: "Beginner", hint: "New to stocks and portfolios" },
      { value: "Some experience", label: "Some experience", hint: "I've bought a few stocks or funds" },
      { value: "Experienced", label: "Experienced", hint: "I actively follow and manage investments" },
    ],
  },
];

const START_CHOICES: Choice[] = [
  {
    value: "Start with Virtual Money",
    label: "Start with Virtual Money",
    hint: "₹1,00,000 of paper money to practise with real market prices — no real funds involved.",
  },
  {
    value: "Add My Existing Holdings",
    label: "Add My Existing Holdings",
    hint: "Enter the shares you already own (quantity + average price) and track them here.",
  },
  {
    value: "Explore Artha First",
    label: "Explore Artha First",
    hint: "Skip the portfolio for now — you can set it up any time from the Portfolio page.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalSteps = STEPS.length + 1; // + the portfolio-start step
  const isStartStep = step === STEPS.length;
  const current = !isStartStep ? STEPS[step] : null;
  const selected = current ? answers[current.key] : answers["initial_preference"];

  const choose = (key: string, value: string) => {
    setError(null);
    setAnswers((a) => ({ ...a, [key]: value }));
  };

  const next = () => {
    if (!selected) {
      setError("Pick an option to continue.");
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  async function finish() {
    const preference = answers["initial_preference"];
    if (!preference) {
      setError("Pick how you'd like to start.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await authService.updatePreferences({
        investment_goal: answers["investment_goal"] ?? null,
        monthly_range: answers["monthly_range"] ?? null,
        risk_profile: answers["risk_profile"] ?? null,
        experience: answers["experience"] ?? null,
        initial_preference: preference,
        onboarding_completed: true,
      });
      setUser(updated);

      if (preference === "Start with Virtual Money") {
        await portfolioService.start("virtual");
      } else if (preference === "Add My Existing Holdings") {
        await portfolioService.start("manual");
      }
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong saving your preferences. Please try again.",
      );
      setBusy(false);
    }
  }

  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="card p-6 sm:p-7">
          {/* Progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <span className="section-label">
                {isStartStep ? "Portfolio setup" : `Question ${step + 1} of ${totalSteps}`}
              </span>
              <span className="text-[11px] text-muted">{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-300"
                style={{ width: `${Math.max(6, progress)}%` }}
              />
            </div>
          </div>

          {current ? (
            <>
              <h1 className="text-lg font-bold tracking-tight text-ink">{current.title}</h1>
              <p className="mt-1 text-sm text-secondary">{current.subtitle}</p>

              <div className="mt-5 space-y-2">
                {current.choices.map((c) => {
                  const active = selected === c.value;
                  return (
                    <button
                      key={c.value}
                      onClick={() => choose(current.key, c.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        active
                          ? "border-gold/50 bg-goldsoft"
                          : "border-edge bg-surface2/40 hover:border-edgestrong hover:bg-surface2",
                      )}
                    >
                      <span>
                        <span className="block text-[14px] font-semibold text-ink">{c.label}</span>
                        {c.hint && <span className="mt-0.5 block text-[12px] text-muted">{c.hint}</span>}
                      </span>
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          active ? "border-gold bg-gold text-[#171207]" : "border-edgestrong",
                        )}
                      >
                        {active && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold tracking-tight text-ink">
                How would you like to start{user ? `, ${user.username}` : ""}?
              </h1>
              <p className="mt-1 text-sm text-secondary">
                Your portfolio mode — virtual money, your real holdings, or just look around first.
              </p>

              <div className="mt-5 space-y-2">
                {START_CHOICES.map((c, i) => {
                  const active = selected === c.value;
                  const Icon = i === 0 ? Wallet : i === 1 ? PieChart : Search;
                  return (
                    <button
                      key={c.value}
                      onClick={() => choose("initial_preference", c.value)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                        active
                          ? "border-gold/50 bg-goldsoft"
                          : "border-edge bg-surface2/40 hover:border-edgestrong hover:bg-surface2",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          active ? "border-gold/40 bg-gold/15 text-gold" : "border-edge bg-surface3 text-muted",
                        )}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[14px] font-semibold text-ink">{c.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{c.hint}</span>
                      </span>
                      <span
                        className={cn(
                          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          active ? "border-gold bg-gold text-[#171207]" : "border-edgestrong",
                        )}
                      >
                        {active && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-neg/30 bg-negsoft/50 px-3 py-2 text-[12.5px] text-neg">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={back}
              disabled={step === 0 || busy}
              className="btn-ghost disabled:opacity-40"
            >
              <ArrowLeft size={15} /> Back
            </button>
            {isStartStep ? (
              <button onClick={finish} disabled={busy} className="btn-primary">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {busy ? "Saving…" : "Finish & open Artha"}
              </button>
            ) : (
              <button onClick={next} className="btn-primary">
                Continue <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted">
          Your answers are saved to your profile and can be edited any time in Settings.
        </p>
      </div>
    </div>
  );
}
