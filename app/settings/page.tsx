"use client";

import { useState } from "react";
import { Bell, Check, ChevronRight, Database, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
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
    name: "AI Assistant (LLM)",
    key: "aiService",
    status: "mock" as const,
    note: "Finance assistant: knowledge base + real backend data + exact calculations. Optional LLM via env config.",
  },
  {
    name: "News & Sentiment",
    key: "newsService",
    status: "mock" as const,
    note: "Mock articles with sentiment labels and AI summaries — clearly labelled demo content.",
  },
  {
    name: "Analytics Engine",
    key: "analyticsService",
    status: "mock" as const,
    note: "Portfolio metrics + real Monte Carlo math on sample inputs.",
  },
  {
    name: "User Account & Data",
    key: "auth / database",
    status: "planned" as const,
    note: "No accounts yet — watchlist & chats persist in localStorage.",
  },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between py-3"
      role="switch"
      aria-checked={on}
    >
      <span className="text-[13px] text-secondary">{label}</span>
      <span
        className={cn(
          "relative h-5.5 w-10 rounded-full transition-colors",
          on ? "bg-gold" : "bg-surface3",
        )}
        style={{ height: 22 }}
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

export default function SettingsPage() {
  const [toggles, setToggles] = useState({
    priceAlerts: true,
    newsDigest: true,
    monthlyReport: false,
    marketing: false,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Profile, preferences and an honest view of which systems are real versus demo."
      />

      {/* Profile */}
      <Card className="p-5">
        <CardHeader title="Profile" subtitle="Your identity on Artha" />
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-goldbright to-gold text-lg font-bold text-[#171207]">
            S
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">Sachidanand Sharma</p>
            <p className="text-xs text-muted">Retail investor · India</p>
          </div>
          <StatusPill tone="gold">Research plan</StatusPill>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Email", value: "sachidanand@example.com" },
            { label: "Currency preference", value: "₹ INR" },
            { label: "Market focus", value: "India + US" },
            { label: "Account created", value: "Aug 2026 (demo)" },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-edge bg-surface2/40 px-3.5 py-2.5">
              <p className="text-[11px] text-muted">{f.label}</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{f.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-5">
        <CardHeader title="Preferences" />
        <div className="mt-2 divide-y divide-edge/60">
          <Toggle
            label="Price alerts (sample)"
            on={toggles.priceAlerts}
            onChange={(v) => setToggles((t) => ({ ...t, priceAlerts: v }))}
          />
          <Toggle
            label="Daily AI news digest"
            on={toggles.newsDigest}
            onChange={(v) => setToggles((t) => ({ ...t, newsDigest: v }))}
          />
          <Toggle
            label="Monthly portfolio report"
            on={toggles.monthlyReport}
            onChange={(v) => setToggles((t) => ({ ...t, monthlyReport: v }))}
          />
          <Toggle
            label="Product updates"
            on={toggles.marketing}
            onChange={(v) => setToggles((t) => ({ ...t, marketing: v }))}
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <Bell size={11} />
          Notification delivery requires a backend — toggles are local state in this demo.
        </p>
      </Card>

      {/* Data sources / API readiness */}
      <Card className="p-5">
        <CardHeader
          title="Data Sources & API Readiness"
          subtitle="Artha is built API-first. This page shows exactly what is real data and what is still mocked."
          right={
            <span className="flex items-center gap-1.5 text-[11px] text-pos">
              <Database size={12} /> 1 live · 3 demo · 1 planned
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

      {/* Responsible use */}
      <Card className="border-gold/25 bg-gradient-to-b from-goldsoft/40 to-surface p-5">
        <CardHeader
          title="How Artha stays honest"
          right={<ShieldCheck size={18} className="text-gold" />}
        />
        <div className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-secondary">
          <p>
            Artha is an <strong className="text-ink">educational and analytical</strong> platform. It explains{" "}
            <em>why</em> a decision carries risk or opportunity — it does not predict markets, guarantee returns, or
            substitute for professional advice.
          </p>
          <p className="flex items-start gap-2 text-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/60" />
            Prices, technicals and fundamentals come from real market data (Yahoo Finance, latest available, may be
            delayed). Demo sections — news, transactions, goals, learning — are labelled as such.
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
    </div>
  );
}
