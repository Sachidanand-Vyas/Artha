"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import { authService } from "@/lib/services/authService";
import { ApiError } from "@/lib/services/api";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { Logo } from "@/components/layout/Logo";

const USERNAME_RE = /^[A-Za-z0-9_.]{3,32}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function SignupPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const u = username.trim();
    const em = email.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) {
      setError("Username must be 3–32 characters: letters, digits, '_' or '.' only.");
      return;
    }
    if (!EMAIL_RE.test(em)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { token, user } = await authService.signup({ username: u, email: em, password });
      setSession(token, user);
      // New accounts always start with onboarding — the guard enforces it.
      router.replace("/onboarding");
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
            <h1 className="text-xl font-bold tracking-tight text-ink">Create your account</h1>
            <p className="mt-1 text-sm text-secondary">
              Then answer four quick questions so Artha can calibrate what it shows you.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-[12px] font-medium text-secondary">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="e.g. rahul_invests"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12px] font-medium text-secondary">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="input"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium text-secondary">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-[12px] font-medium text-secondary">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat it"
                  className="input"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-neg/30 bg-negsoft/50 px-3 py-2 text-[12.5px] text-neg">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-5 border-t border-edge/60 pt-4 text-center text-[13px] text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-gold hover:underline">
              Log in <ArrowRight size={12} className="inline" />
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
          Your password is salted and hashed (PBKDF2) — never stored in plain text. Educational — not
          financial advice.
        </p>
      </div>
    </div>
  );
}
