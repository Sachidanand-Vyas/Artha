/**
 * THEME — dark (default, black + gold) and light (white + green).
 *
 * The chosen theme is persisted to localStorage and applied to
 * <html data-theme> by an inline script BEFORE first paint (see
 * app/layout.tsx), so there is no flash and a reload keeps the choice.
 * Components that can't react to CSS variables (canvas charts) subscribe
 * via useTheme() and re-render on change.
 */

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "artha-theme";
const CHANGE_EVENT = "artha-theme-changed";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode — theme still applies for this page view */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function toggleTheme(): void {
  setTheme(getTheme() === "light" ? "dark" : "light");
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // changed in another tab
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Current theme; re-renders the component when the theme changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme);
}
