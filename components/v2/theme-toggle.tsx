"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  readonly className?: string;
}

type ThemeChoice = "light" | "dark" | "system";

/**
 * The cycle, and what the control PROMISES at each step.
 *
 * `label` names what the next press will do, not the current state — that is what a button's
 * accessible name is for. `announce` names the state just entered, for the live region,
 * because a screen-reader user gets no visual confirmation that anything happened.
 */
const CYCLE: readonly {
  readonly value: ThemeChoice;
  readonly next: ThemeChoice;
  readonly label: string;
  readonly announce: string;
}[] = [
  {
    value: "light",
    next: "dark",
    label: "Karanlık temaya geç (Tema: aydınlık)",
    announce: "Aydınlık tema",
  },
  {
    value: "dark",
    next: "system",
    label: "Sistem temasına geç (Tema: karanlık)",
    announce: "Karanlık tema",
  },
  {
    value: "system",
    next: "light",
    label: "Aydınlık temaya geç (Tema: sistem)",
    announce: "Sistem teması",
  },
];

/**
 * Three-state theme switcher: light → dark → system → light.
 *
 * `system` is a real destination, not just the initial state. The previous version was
 * binary, so the first press pinned a choice in `localStorage` and the visitor could never
 * get back to following their OS.
 *
 * The `mounted` guard is load-bearing: `useTheme()` returns `undefined` on the server and on
 * the first client render, so rendering an icon before then produces a hydration mismatch
 * and, worse, briefly shows the wrong icon. An invisible placeholder of the same size holds
 * the layout instead.
 */
const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  // `useSyncExternalStore` rather than `useState` + `useEffect`: the lint rule forbids
  // calling setState synchronously inside an effect, and this is the idiom the toggle this
  // file replaces already used for the same purpose — a value that is false while rendering
  // on the server and true once hydrated, with no state update at all.
  const mounted = React.useSyncExternalStore(NEVER_CHANGES, onClient, onServer);

  // The guard has to cover the LABEL, not just the icon. `next-themes` resolves the stored
  // theme synchronously, so the first client render already knows it is dark while the
  // server rendered with `theme === undefined` — and React compared the two `aria-label`
  // strings and threw a hydration mismatch. Pinning the pre-mount render to the same
  // fallback the server used makes the two agree; the real label arrives a tick later.
  const current = mounted ? (CYCLE.find((step) => step.value === theme) ?? CYCLE[2]!) : CYCLE[2]!;

  const toggleTheme = React.useCallback(() => {
    setTheme(current.next);
  }, [current.next, setTheme]);

  const Icon = current.value === "light" ? Sun : current.value === "dark" ? Moon : Monitor;

  return (
    <>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={current.label}
        title={current.label}
        className={cn(
          "size-9 rounded-xl border border-border/80 bg-card text-foreground",
          "flex items-center justify-center shadow-2xs transition-colors",
          "cursor-pointer hover:bg-muted",
          className,
        )}
      >
        {mounted ? (
          <Icon className="size-4 transition-transform" />
        ) : (
          <span className="size-4 opacity-0" aria-hidden="true" />
        )}
        <span className="sr-only">{current.label}</span>
      </button>
      {/* The switch is otherwise silent for anyone not watching the colours change. */}
      <span aria-live="polite" className="sr-only">
        {mounted ? current.announce : ""}
      </span>
    </>
  );
}
