/**
 * AUTH STORE — the logged-in session, persisted to localStorage.
 *
 * - `token` is the opaque bearer token issued by FastAPI (see backend/services/auth.py).
 * - `user` is the authoritative profile straight from the backend: real
 *   username/email and the onboarding preferences the user actually chose.
 * - On hydration the token is handed to the API client so every request is
 *   authenticated; a 401 from the backend clears the session (expired/invalid).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invalidateCache, onUnauthorized, setAuthToken } from "@/lib/services/api";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  country: string;
  currency: string;
  onboarding_completed: boolean;
  investment_goal: string | null;
  monthly_range: string | null;
  risk_profile: string | null;
  experience: string | null;
  initial_preference: string | null;
  pref_price_alerts: boolean;
  pref_daily_digest: boolean;
  pref_monthly_report: boolean;
  pref_product_updates: boolean;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      setSession: (token, user) => {
        setAuthToken(token);
        // A new session must never see the previous account's cached data.
        invalidateCache("/api/portfolio");
        set({ token, user });
      },
      setUser: (user) => set({ user }),
      clearSession: () => {
        setAuthToken(null);
        invalidateCache("/api/portfolio");
        set({ token: null, user: null });
      },
    }),
    {
      name: "artha-auth",
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        setAuthToken(state?.token ?? null);
      },
    },
  ),
);

// Any 401 from the backend means the session is gone — drop it centrally.
onUnauthorized(() => useAuthStore.getState().clearSession());
