"use client";

import { useEffect, useRef, useState } from "react";

import { Bot, MessageSquarePlus, Send, Sparkles, Trash2, User } from "lucide-react";
import type { AdvisorMessage } from "@/lib/types";
import { aiService } from "@/lib/services/aiService";
import { suggestedPrompts } from "@/lib/advisor/knowledge";
import { useAppStore, ensureSeedConversation } from "@/lib/store/useAppStore";
import { useAsync } from "@/lib/hooks/useAsync";
import { portfolioService } from "@/lib/services/portfolioService";
import { analyticsService } from "@/lib/services/analyticsService";
import { cn, inr, timeAgo } from "@/lib/utils";
import { StatusPill } from "@/components/ui/Badge";

const STRUCTURED_LABELS: { key: "risk" | "upside" | "impact"; title: string }[] = [
  { key: "risk", title: "Risk" },
  { key: "upside", title: "Potential Upside" },
  { key: "impact", title: "Portfolio Impact" },
];

function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function ChatMessage({ msg }: { msg: AdvisorMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-goldsoft text-gold" : "border border-edge bg-surface2 text-gold",
        )}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className={cn("max-w-[85%] space-y-2", isUser && "text-right")}>
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-[13.5px] leading-relaxed",
            isUser
              ? "rounded-tr-sm border-gold/25 bg-goldsoft/60 text-ink"
              : "rounded-tl-sm border-edge bg-surface2/60 text-secondary",
          )}
        >
          {rich(msg.text)}
        </div>

        {!isUser && msg.structured && (
          <div className="rounded-2xl rounded-tl-sm border border-edge bg-surface2/40 p-4 text-left">
            {STRUCTURED_LABELS.map(({ key, title }) => (
              <div key={key} className="mb-3 last:mb-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">{title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-secondary">
                  {rich(msg.structured![key])}
                </p>
              </div>
            ))}
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">Key Concerns</p>
              <ul className="mt-1 space-y-1">
                {msg.structured.concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-secondary">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/70" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 border-t border-edge/60 pt-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-info">What to learn</p>
              <p className="mt-1 text-[12px] leading-relaxed text-secondary">{rich(msg.structured.learn)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContextPanel() {
  const { data: summary } = useAsync(() => portfolioService.getSummary(), []);
  const { data: metrics } = useAsync(() => analyticsService.getMetrics(), []);
  const { data: sectors } = useAsync(() => portfolioService.getSectorAllocation(), []);

  return (
    <div className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
      <div className="card p-4">
        <p className="section-label">Context snapshot</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          What Artha can reference while answering. Portfolio value comes from the backend at latest available
          prices; the risk score is a demo metric.
        </p>
        <div className="mt-3 space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-muted">Portfolio</span>
            <span className="font-semibold tnum text-ink">{summary ? inr(summary.totalValue) : "…"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Cash</span>
            <span className="font-semibold tnum text-ink">{summary ? inr(summary.availableCash) : "…"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Risk score</span>
            <span className="font-semibold tnum text-ink">{metrics ? `${metrics.riskScore}/100` : "…"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Top sector</span>
            <span className="font-semibold text-ink">
              {sectors?.length ? `${sectors[0].sector} (${sectors[0].pct.toFixed(0)}%)` : "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <p className="section-label flex items-center gap-1.5 !text-gold">
          <Sparkles size={11} /> Try asking
        </p>
        <div className="mt-2.5 space-y-1.5">
          {suggestedPrompts.map((p) => (
            <button
              key={p}
              onClick={() => document.dispatchEvent(new CustomEvent("artha:prompt", { detail: p }))}
              className="w-full rounded-lg border border-edge/70 bg-surface2/40 px-3 py-2 text-left text-[12px] text-secondary transition-colors hover:border-gold/30 hover:text-ink"
            >
              “{p}”
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-edgestrong p-4">
        <p className="text-[11px] font-semibold text-secondary">How it works</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Artha routes each question to the finance knowledge base, the backend stock/portfolio/market services or the
          calculation engine (<span className="font-mono">aiService</span> → FastAPI). An LLM can be plugged in via
          env config; without one, answers are rendered locally from the same real data.
        </p>
      </div>
    </div>
  );
}

export default function AdvisorPage() {
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeConversationId);
  const setActive = useAppStore((s) => s.setActiveConversation);
  const createConversation = useAppStore((s) => s.createConversation);
  const addMessage = useAppStore((s) => s.addMessage);
  const deleteConversation = useAppStore((s) => s.deleteConversation);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureSeedConversation();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setInput(detail);
      void send(detail);
    };
    document.addEventListener("artha:prompt", handler);
    return () => document.removeEventListener("artha:prompt", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversations, activeId, busy]);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const shownId = active?.id;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    setInput("");
    const convId = shownId ?? createConversation();
    const mid = () => `m${Date.now()}-${msgIdRef.current++}`;
    // Prior turns give the Advisor context for follow-ups ("Why?", "What about TCS?").
    const history = (active?.messages ?? []).map((m) => ({ role: m.role, text: m.text }));
    addMessage(convId, { id: mid(), role: "user", text: trimmed, ts: Date.now() });
    setBusy(true);
    try {
      const reply = await aiService.getAdvisorReply(trimmed, history);
      addMessage(convId, {
        id: mid(),
        role: "assistant",
        text: reply.text,
        structured: reply.structured,
        ts: Date.now(),
      });
    } catch {
      addMessage(convId, {
        id: mid(),
        role: "assistant",
        text: "Something went wrong reaching the Advisor. Please try again — if it keeps happening, check that the FastAPI backend is running on port 8000.",
        ts: Date.now(),
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[520px] gap-5">
      {/* Conversations */}
      <div className="hidden w-60 shrink-0 flex-col md:flex">
        <button
          onClick={() => createConversation()}
          className="btn-primary w-full !py-2 text-xs"
        >
          <MessageSquarePlus size={14} /> New conversation
        </button>
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto pr-1 hide-scrollbar">
          <p className="section-label px-1 pb-1">History</p>
          {conversations.length === 0 && (
            <p className="px-1 text-xs text-muted">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <div key={c.id} className="group relative">
              <button
                onClick={() => setActive(c.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                  c.id === shownId ? "bg-goldsoft text-gold" : "text-secondary hover:bg-surface2",
                )}
              >
                <p className="truncate text-[13px] font-medium">{c.title}</p>
                <p className="text-[10.5px] text-muted">{timeAgo(c.updatedAt)}</p>
              </button>
              <button
                onClick={() => deleteConversation(c.id)}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md p-1 text-muted hover:bg-negsoft hover:text-neg group-hover:block"
                aria-label="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="card flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Bot size={15} className="text-gold" />
              {active?.title ?? "AI Advisor"}
            </p>
            <p className="text-[11px] text-muted">
              Explains the reasoning — it never just tells you what to do.
            </p>
          </div>
          <StatusPill tone="gold">Finance Assistant</StatusPill>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {conversations.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-goldsoft text-gold">
                <Bot size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Ask Artha anything about your finances</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
                  Try a stock, a SIP, diversification, taxes or retirement — every answer explains why.
                </p>
              </div>
            </div>
          )}
          {active?.messages.map((m) => <ChatMessage key={m.id} msg={m} />)}
          {busy && (
            <div className="flex items-center gap-2 pl-11">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:300ms]" />
              </span>
              <span className="text-xs text-muted">Artha is thinking…</span>
            </div>
          )}
        </div>

        <div className="border-t border-edge p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask Artha anything about finance…"
              className="input max-h-32 min-h-[42px] flex-1 resize-none !rounded-xl !py-2.5"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="btn-primary h-[42px] !rounded-xl !px-3.5"
              aria-label="Send"
            >
              <Send size={15} />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted">
            Concepts, exact calculations and real backend data (latest available, may be delayed) — educational, not
            financial advice. Optional LLM formatting via env config; works without one.
          </p>
        </div>
      </div>

      <ContextPanel />
    </div>
  );
}
