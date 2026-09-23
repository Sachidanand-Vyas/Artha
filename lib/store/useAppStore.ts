import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdvisorMessage, Conversation } from "@/lib/types";
import { defaultWatchlist } from "@/lib/mock/stocks";

interface AppState {
  watchlist: string[];
  toggleWatchlist: (symbol: string) => void;

  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  createConversation: (title?: string) => string;
  addMessage: (convId: string, message: AdvisorMessage) => void;
  deleteConversation: (id: string) => void;
}

let convCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now()}-${convCounter++}`;

const makeConversation = (title: string): Conversation => ({
  id: newId("conv"),
  title,
  updatedAt: Date.now(),
  messages: [],
});

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      watchlist: defaultWatchlist,

      toggleWatchlist: (symbol) =>
        set((s) => ({
          watchlist: s.watchlist.includes(symbol)
            ? s.watchlist.filter((x) => x !== symbol)
            : [...s.watchlist, symbol],
        })),

      conversations: [],
      activeConversationId: null,

      setActiveConversation: (id) => set({ activeConversationId: id }),

      createConversation: (title = "New conversation") => {
        const conv = makeConversation(title);
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeConversationId: conv.id,
        }));
        return conv.id;
      },

      addMessage: (convId, message) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  updatedAt: Date.now(),
                  title:
                    c.messages.length === 0 && message.role === "user"
                      ? message.text.slice(0, 42)
                      : c.title,
                }
              : c,
          ),
        })),

      deleteConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeConversationId:
            s.activeConversationId === id ? null : s.activeConversationId,
        })),
    }),
    {
      name: "artha-store",
      partialize: (s) => ({
        watchlist: s.watchlist,
        conversations: s.conversations,
        activeConversationId: s.activeConversationId,
      }),
    },
  ),
);

/** Seed a first conversation when the store is empty (called once from the advisor page). */
export function ensureSeedConversation() {
  const s = useAppStore.getState();
  if (s.conversations.length === 0) {
    const id = useAppStore.getState().createConversation("My first question");
    useAppStore.getState().addMessage(id, {
      id: newId("msg"),
      role: "assistant",
      text: "Welcome to Artha. I can explain financial concepts (P/E, SIPs, compounding…), pull your real portfolio and stock data from the backend, run exact calculations, and walk you through why a signal looks the way it does. Ask me anything finance.",
      ts: Date.now(),
    });
  }
}
