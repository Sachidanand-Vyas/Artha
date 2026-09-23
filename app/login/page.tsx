"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { authService } from "@/lib/services/authService";
import { ApiError } from "@/lib/services/api";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { Logo } from "@/components/layout/Logo";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Enter your username/email and password.");
      return;
    }
    setBusy(true);
    try {
      const { token, user } = await authService.login(identifier.trim(), password);
      setSession(token, user);
      // The auth guard sends incomplete onboarding to /onboarding.
      router.replace(user.onboarding_completed ? "/" : "/onboarding");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Cannot reach the Artha backend. Start it with: cd backend && uvicorn main:app --port 8000",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="card p-6 sm:p-7">
          <div className="mb-5">
            <h1 className="text-xl font-bold tracking-tight text-ink">Welcome back</h1>
            <p className="mt-1 text-sm text-secondary">
              Log in to your Artha account — your portfolio and preferences are waiting.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="mb-1.5 block text-[12px] font-medium text-secondary">
                Username or email
              </label>
              <input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="you or you@example.com"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium text-secondary">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Your password"
                className="input"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-neg/30 bg-negsoft/50 px-3 py-2 text-[12.5px] text-neg">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="mt-5 border-t border-edge/60 pt-4 text-center text-[13px] text-muted">
            New to Artha?{" "}
            <Link href="/signup" className="font-semibold text-gold hover:underline">
              Create an account <ArrowRight size={12} className="inline" />
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
          Passwords are stored only as salted PBKDF2 hashes. Educational — not financial advice.
        </p>
      </div>
    </div>
  );
}
