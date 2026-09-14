"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  readonly className?: string;
}

const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

function subscribeTheme(callback: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot(): "dark" | "light" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerThemeSnapshot(): "dark" | "light" {
  return "light";
}

/**
 * Accessible Dark / Light mode switcher for V2.
 *
 * Synchronizes with:
 * 1. `document.documentElement.classList.contains("dark")`
 * 2. `localStorage.getItem("theme")`
 * 3. System `(prefers-color-scheme: dark)`
 *
 * Emits accessible name matching `/Tema|Karanlık|Aydınlık|Dark|Light/i`.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const mounted = React.useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
  const theme = React.useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const shouldBeDark = stored === "dark" || (!stored && prefersDark);
      if (shouldBeDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // localStorage may fail in sandboxed iframes
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const next = isDark ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Ignore write errors in restricted storage
    }
  }, []);

  const label = theme === "dark" ? "Aydınlık temaya geç (Tema)" : "Karanlık temaya geç (Tema)";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`size-9 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-2xs ${
        className || ""
      }`}
    >
      {!mounted ? (
        <span className="size-4 opacity-0" aria-hidden="true" />
      ) : theme === "dark" ? (
        <Sun className="size-4 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="size-4 text-slate-700 dark:text-slate-200 hover:-rotate-12 transition-transform" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
