"use client";

/**
 * SETTINGS — the logged-in user's real profile and preferences.
 *
 * - Profile: actual username/email/created date from the backend (never a
 *   sample identity).
 * - Investment profile: the onboarding answers, editable here.
 * - Preferences: persisted to the account, clearly labelled as saved-but-not
 *   delivered (there is no notification backend yet).
 * - Data sources: honest live/demo status per subsystem.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronRight, Database, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { authService } from "@/lib/services/authService";
import { ApiError } from "@/lib/services/api";
import { useAuthStore, type AuthUser } from "@/lib/store/useAuthStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/Badge";

const DATA_SOURCES = [
  {
    name: "Market Data Provider",
    key: "stockService → FastAPI",
    status: "live" as const,
    note: "Yahoo Finance via the FastAPI backend — quotes, OHLCV, indicators, fundamentals (latest available, may be delayed).",
  },
  {
    name: "Accounts & Portfolio",
    key: "auth/portfolio → SQLite",
    status: "live" as const,
    note: "Signup, onboarding preferences, virtual cash, holdings and transactions stored behind FastAPI (PBKDF2-hashed passwords).",
  },
  {
    name: "AI Assistant",
    key: "aiService",
    status: "live" as const,
    note: "Knowledge base + real backend data + exact calculations. Optional LLM formatting via env config.",
  },
  {
    name: "News & Sentiment",
    key: "newsService",
    status: "mock" as const,
    note: "Mock articles with sentiment labels and AI summaries — clearly labelled demo content.",
  },
  {
    name: "Notifications",
    key: "preferences",
    status: "planned" as const,
    note: "Your notification choices are saved to your account, but nothing is delivered yet.",
  },
];

const GOALS = [
  "Wealth creation",
  "Saving for a major goal",
  "Retirement",
  "Learning about investing",
  "Short-term investing",
];
const RANGES = ["₹1,000–₹5,000", "₹5,000–₹10,000", "₹10,000–₹25,000", "₹25,000+"];
const RISKS = ["Conservative", "Moderate", "Aggressive"];
const EXPERIENCE = ["Beginner", "Some experience", "Experienced"];

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
      role="switch"
      aria-checked={on}
    >
      <span>
        <span className="block text-[13px] text-secondary">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative shrink-0 rounded-full transition-colors",
          on ? "bg-gold" : "bg-surface3",
        )}
        style={{ height: 22, width: 40 }}
      >
        <span
          className={cn(
            "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
            on ? "left-[20px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editable sections — initialised from the real stored user                  */
/* -------------------------------------------------------------------------- */

function SettingsForms({ user, setUser }: { user: AuthUser; setUser: (u: AuthUser) => void }) {
  const [profile, setProfile] = useState({
    investment_goal: user.investment_goal ?? "",
    risk_profile: user.risk_profile ?? "",
    experience: user.experience ?? "",
    monthly_range: user.monthly_range ?? "",
  });
  const [prefs, setPrefs] = useState({
    priceAlerts: user.pref_price_alerts,
    dailyDigest: user.pref_daily_digest,
    monthlyReport: user.pref_monthly_report,
    productUpdates: user.pref_product_updates,
  });
  const [saving, setSaving] = useState<"profile" | "prefs" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const showError = (e: unknown) =>
    setMessage({
      ok: false,
      text: e instanceof ApiError ? e.message : "Could not reach the backend — changes not saved.",
    });

  async function saveProfile() {
    setSaving("profile");
    setMessage(null);
    try {
      const updated = await authService.updatePreferences({
        investment_goal: profile.investment_goal || null,
        risk_profile: profile.risk_profile || null,
        experience: profile.experience || null,
        monthly_range: profile.monthly_range || null,
      });
      setUser(updated);
      setMessage({ ok: true, text: "Investment profile saved." });
    } catch (e) {
      showError(e);
    } finally {
      setSaving(null);
    }
  }

  async function savePrefs(next: typeof prefs) {
    setPrefs(next);
    setSaving("prefs");
    setMessage(null);
    try {
      const updated = await authService.updatePreferences({
        pref_price_alerts: next.priceAlerts,
        pref_daily_digest: next.dailyDigest,
        pref_monthly_report: next.monthlyReport,
        pref_product_updates: next.productUpdates,
      });
      setUser(updated);
      setMessage({ ok: true, text: "Preferences saved to your account." });
    } catch (e) {
      showError(e);
    } finally {
      setSaving(null);
    }
  }

  const created = new Date(user.created_at).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  const field = (label: string, value: string, options: string[], onChange: (v: string) => void) => (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-secondary">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      {message && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-[12.5px]",
            message.ok ? "border-pos/30 bg-possoft/50 text-pos" : "border-neg/30 bg-negsoft/50 text-neg",
          )}
        >
          {message.text}
        </p>
      )}

      {/* Profile — actual account data */}
      <Card className="p-5">
        <CardHeader title="Profile" subtitle="Your identity on Artha" />
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-goldbright to-gold text-lg font-bold uppercase text-[#171207]">
            {user.username.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{user.username}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <StatusPill tone="gold">{user.onboarding_completed ? "Onboarded" : "Setup pending"}</StatusPill>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Username", value: user.username },
            { label: "Email", value: user.email },
            { label: "Country", value: user.country },
            { label: "Currency", value: user.currency === "INR" ? "₹ INR" : user.currency },
            { label: "Account created", value: created },
            { label: "Onboarding choice", value: user.initial_preference ?? "Not chosen yet" },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-edge bg-surface2/40 px-3.5 py-2.5">
              <p className="text-[11px] text-muted">{f.label}</p>
              <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{f.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Investment profile — the onboarding answers, editable */}
      <Card className="p-5">
        <CardHeader
          title="Investment Profile"
          subtitle="Set during onboarding — editable here, used to calibrate what Artha shows you"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("Investment goal", profile.investment_goal, GOALS, (v) =>
            setProfile((p) => ({ ...p, investment_goal: v })),
          )}
          {field("Risk preference", profile.risk_profile, RISKS, (v) =>
            setProfile((p) => ({ ...p, risk_profile: v })),
          )}
          {field("Experience", profile.experience, EXPERIENCE, (v) =>
            setProfile((p) => ({ ...p, experience: v })),
          )}
          {field("Monthly investment range", profile.monthly_range, RANGES, (v) =>
            setProfile((p) => ({ ...p, monthly_range: v })),
          )}
        </div>
        <button onClick={saveProfile} disabled={saving === "profile"} className="btn-primary mt-4 !py-2 text-xs">
          {saving === "profile" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save investment profile
        </button>
      </Card>

      {/* Preferences — saved, not delivered */}
      <Card className="p-5">
        <CardHeader
          title="Preferences"
          subtitle="Saved to your account"
          right={
            saving === "prefs" ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <Loader2 size={11} className="animate-spin" /> Saving…
              </span>
            ) : undefined
          }
        />
        <div className="mt-2 divide-y divide-edge/60">
          <Toggle
            label="Price alerts"
            hint="Notify me about big moves in my holdings"
            on={prefs.priceAlerts}
            onChange={(v) => savePrefs({ ...prefs, priceAlerts: v })}
          />
          <Toggle
            label="Daily news digest"
            hint="A morning summary of market news"
            on={prefs.dailyDigest}
            onChange={(v) => savePrefs({ ...prefs, dailyDigest: v })}
          />
          <Toggle
            label="Monthly portfolio report"
            hint="A monthly performance recap"
            on={prefs.monthlyReport}
            onChange={(v) => savePrefs({ ...prefs, monthlyReport: v })}
          />
          <Toggle
            label="Product updates"
            hint="New Artha features"
            on={prefs.productUpdates}
            onChange={(v) => savePrefs({ ...prefs, productUpdates: v })}
          />
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
          <Bell size={11} className="mt-0.5 shrink-0" />
          These choices are stored in your account — Artha does not send emails or push notifications yet, so
          nothing will actually be delivered. They are saved for when delivery is built.
        </p>
      </Card>

      {/* Data sources / API readiness */}
      <Card className="p-5">
        <CardHeader
          title="Data Sources & API Readiness"
          subtitle="Exactly what is real data and what is still mocked."
          right={
            <span className="flex items-center gap-1.5 text-[11px] text-pos">
              <Database size={12} /> 3 live · 1 demo · 1 planned
            </span>
          }
        />
        <div className="mt-3 divide-y divide-edge/60">
          {DATA_SOURCES.map((d) => (
            <div key={d.name} className="flex items-center gap-3 py-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  d.status === "live"
                    ? "border-pos/30 bg-possoft text-pos"
                    : d.status === "mock"
                      ? "border-gold/25 bg-goldsoft text-gold"
                      : "border-edge bg-surface2 text-muted",
                )}
              >
                {d.status === "planned" ? <ChevronRight size={14} /> : <Check size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">{d.name}</p>
                <p className="truncate text-[11px] text-muted">{d.note}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10.5px] text-secondary">{d.key}</p>
                <StatusPill tone={d.status === "live" ? "pos" : d.status === "mock" ? "gold" : "info"}>
                  {d.status === "live" ? "Live" : d.status === "mock" ? "Demo" : "Planned"}
                </StatusPill>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                  */
/* -------------------------------------------------------------------------- */

function ResponsibleUseCard() {
  return (
    <Card className="border-gold/25 bg-gradient-to-b from-goldsoft/40 to-surface p-5">
      <CardHeader title="How Artha stays honest" right={<ShieldCheck size={18} className="text-gold" />} />
      <div className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-secondary">
        <p>
          Artha is an <strong className="text-ink">educational and analytical</strong> platform. It explains{" "}
          <em>why</em> a decision carries risk or opportunity — it does not predict markets, guarantee returns, or
          substitute for professional advice.
        </p>
        <p className="flex items-start gap-2 text-muted">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/60" />
          Prices, technicals and fundamentals come from real market data (Yahoo Finance, latest available, may be
          delayed). Your portfolio, cash and transactions are yours; news and learning content remain clearly
          labelled demo material.
        </p>
        <p className="flex items-start gap-2 text-muted">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/60" />
          AI explanations come from real backend data or the knowledge base, every missing metric shows N/A — Artha
          never invents numbers or claims model accuracy.
        </p>
        <p className="flex items-start gap-2 text-muted">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/60" />
          Nothing here is financial advice. Consult a SEBI-registered adviser for decisions about your money.
        </p>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Settings" subtitle="Loading your profile…" />
        <div className="card p-5">
          <p className="text-sm text-muted">Waiting for your session…</p>
        </div>
      </div>
    );
  }

  async function logout() {
    setLoggingOut(true);
    await authService.logout();
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Your real profile, your investment preferences, and an honest view of which systems are live."
      />
      <SettingsForms key={user.id} user={user} setUser={setUser} />

      {/* Account */}
      <Card className="p-5">
        <CardHeader title="Account" subtitle="Your session on this device" />
        <button onClick={logout} disabled={loggingOut} className="btn-ghost mt-3 !py-2 text-xs">
          {loggingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
          Log out
        </button>
      </Card>

      <ResponsibleUseCard />
    </div>
  );
}
