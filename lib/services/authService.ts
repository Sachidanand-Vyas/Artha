/**
 * AUTH SERVICE — signup / login / logout / profile (FastAPI backend).
 *
 * Passwords are hashed on the backend (PBKDF2); the raw password only ever
 * travels over the request body and is never stored client-side.
 */

import type { AuthUser } from "@/lib/store/useAuthStore";
import { apiFetch, apiSend } from "@/lib/services/api";

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface SignupInput {
  username: string;
  email: string;
  password: string;
}

export interface PreferencesInput {
  investment_goal?: string | null;
  monthly_range?: string | null;
  risk_profile?: string | null;
  experience?: string | null;
  initial_preference?: string | null;
  onboarding_completed?: boolean;
  pref_price_alerts?: boolean;
  pref_daily_digest?: boolean;
  pref_monthly_report?: boolean;
  pref_product_updates?: boolean;
}

export interface AuthService {
  signup(input: SignupInput): Promise<AuthResponse>;
  login(identifier: string, password: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  /** Refresh the profile for the current session (also validates the token). */
  me(): Promise<AuthUser>;
  updatePreferences(input: PreferencesInput): Promise<AuthUser>;
}

export const authService: AuthService = {
  signup(input) {
    return apiSend<AuthResponse>("/api/auth/signup", input);
  },
  login(identifier, password) {
    return apiSend<AuthResponse>("/api/auth/login", { identifier, password });
  },
  async logout() {
    try {
      await apiSend("/api/auth/logout");
    } catch {
      /* Session already invalid server-side — the local logout still runs. */
    }
  },
  me() {
    // Uncached GET: the profile must always be current.
    return apiFetch<AuthUser>("/api/auth/me");
  },
  updatePreferences(input) {
    return apiSend<AuthUser>("/api/user/preferences", input);
  },
};
