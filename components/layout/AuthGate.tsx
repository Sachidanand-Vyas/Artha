"use client";

/**
 * AUTH GATE — route protection for the Artha app shell.
 *
 * Rules:
 *   - /login and /signup are public (and only usable while logged OUT).
 *   - Everything else requires a session; without one we go to /login.
 *   - A logged-in user who has not completed onboarding is sent to /onboarding.
 *   - On mount the stored token is validated against the backend; an invalid
 *     or expired session (401) clears the store and lands on /login.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/lib/services/authService";
import { useAuthStore } from "@/lib/store/useAuthStore";

const PUBLIC_ROUTES = ["/login", "/signup"];

/** True once the persisted session has been read from localStorage. */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const unsubHydrate = useAuthStore.persist.onFinishHydration(onChange);
      const unsubStore = useAuthStore.subscribe(onChange);
      return () => {
        unsubHydrate();
        unsubStore();
      };
    },
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}

export function useAuthGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const onOnboarding = pathname === "/onboarding";

  // Validate the stored session once per load (catches expired/revoked tokens).
  // `meDone` only flips inside async callbacks — no session, nothing to check.
  const [meDone, setMeDone] = useState(false);
  const sessionToken = token;
  useEffect(() => {
    if (!hydrated || !sessionToken) return;
    let alive = true;
    authService
      .me()
      .then((u) => {
        if (!alive) return;
        setUser(u);
        setMeDone(true);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const status = (e as { status?: number })?.status;
        if (status === 401) clearSession(); // expired / invalid session
        // Backend unreachable: keep the local profile; data pages show errors.
        setMeDone(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, sessionToken]);

  const validated = hydrated && (!token || meDone);

  useEffect(() => {
    if (!hydrated || !validated) return;
    if (!token) {
      if (!isPublic) router.replace("/login");
      return;
    }
    // Logged in:
    if (isPublic) {
      router.replace(user?.onboarding_completed ? "/" : "/onboarding");
      return;
    }
    if (!user?.onboarding_completed && !onOnboarding) {
      router.replace("/onboarding");
      return;
    }
    if (user?.onboarding_completed && onOnboarding) {
      router.replace("/");
    }
  }, [hydrated, validated, token, user, pathname, isPublic, onOnboarding, router]);

  return {
    hydrated,
    validated,
    token,
    user,
    isPublic,
    /** Ready to render app content (never render protected content before this). */
    ready: hydrated && validated,
  };
}
