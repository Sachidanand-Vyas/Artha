"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Lightbulb, MessageSquareText, RefreshCcw } from "lucide-react";
import type { Stock, StockQa } from "@/lib/types";
import { aiService } from "@/lib/services/aiService";
import { StatusPill } from "@/components/ui/Badge";

function renderRich(text: string) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  return text.split("\n").map((line, i) => {
    const m = line.match(/^(\d+)\.\s+(.*)$/);
    if (m) {
      return (
        <div key={i} className="mt-1.5 flex gap-2">
          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[10px] font-bold text-gold tnum">
            {m[1]}
          </span>
          <span className="text-secondary">{bold(m[2])}</span>
        </div>
      );
    }
    if (line.startsWith("| ") && line.endsWith(" |")) {
      return <pre key={i} className="mt-1.5 overflow-x-auto rounded-lg bg-surface2/70 p-2 font-mono text-[10.5px] leading-relaxed text-secondary">{line}</pre>;
    }
    return (
      <p key={i} className={i === 0 ? "text-secondary" : "mt-1.5 text-secondary"}>
        {bold(line)}
      </p>
    );
  });
}

const ACTIONS = [
  { key: "followup", label: "Ask follow-up", icon: MessageSquareText },
  { key: "simpler", label: "Explain simpler", icon: Lightbulb },
  { key: "calc", label: "Show calculation", icon: RefreshCcw },
  { key: "compare", label: "Compare with another stock", icon: ChevronDown },
];

export function AskArthaPanel({ stock }: { stock: Stock }) {
  const [qa, setQa] = useState<StockQa[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    aiService
      .askAboutStock(stock.symbol, "Why is this stock considered risky?")
      .then((r) => {
        if (alive) {
          setQa([r]);
          setBusy(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [stock.symbol]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [qa, busy]);

  const ask = async (q: string) => {
    setBusy(true);
    const reply =
      q === "Compare with another stock"
        ? await aiService.compareStocks(stock.symbol)
        : await aiService.askAboutStock(stock.symbol, q);
    setQa((prev) => [...prev, reply]);
    setBusy(false);
  };

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-gradient-to-b from-goldsoft/50 to-transparent px-5 py-4 text-left"
      >
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Bot size={15} className="text-gold" />
            Ask Artha
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            Explainable answers — every conclusion shows its reasoning.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone="gold">Educational</StatusPill>
          <ChevronDown size={15} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4">
          {qa.map((item, i) => (
            <div key={i}>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
                <MessageSquareText size={11} />
                {i === 0 ? "Why is this stock considered risky?" : item.question}
              </p>
              <div className="rounded-xl rounded-tl-sm border border-edge bg-surface2/50 p-3.5 text-[12.5px] leading-relaxed">
                {renderRich(item.answer)}
                {item.points && (
                  <div className="mt-2 border-t border-edge/60 pt-2">
                    {item.points.map((p, j) => (
                      <p key={j} className="flex items-start gap-1.5 text-[11px] text-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/60" />
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 rounded-xl border border-edge bg-surface2/50 px-3.5 py-3">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold [animation-delay:300ms]" />
              </span>
              <span className="text-xs text-muted">Artha is thinking…</span>
            </div>
          )}

          {!busy && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() =>
                    ask(
                      a.key === "followup"
                        ? "What else should I understand about this stock?"
                        : a.key === "simpler"
                          ? "Explain simpler"
                          : a.key === "calc"
                            ? "Show calculation"
                            : "Compare with another stock",
                    )
                  }
                  className="btn-ghost !px-2.5 !py-1.5 text-[11px]"
                >
                  <a.icon size={12} />
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="border-t border-edge bg-surface2/40 px-5 py-2.5">
        <p className="flex items-center gap-1.5 text-[10.5px] text-muted">
          <Lightbulb size={11} className="shrink-0 text-gold" />
          Explanations are generated deterministically from this stock&apos;s real backend data — educational, not
          a prediction or advice.
        </p>
      </div>
    </div>
  );
}
