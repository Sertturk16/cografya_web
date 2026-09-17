"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Mounts `next-themes` for the whole app.
 *
 * A thin client wrapper so `app/[locale]/layout.tsx` can stay a server component: the
 * provider itself is client-only, but nothing else in that layout needs to be.
 *
 * `storageKey` is the key the previous hand-rolled toggle already wrote, so a returning
 * visitor keeps the preference they set before this change. `disableTransitionOnChange`
 * stops every `transition-colors` in the tree firing at once on a switch, which otherwise
 * reads as a slow smear rather than a theme change.
 *
 * Before this existed the theme was applied in a post-hydration `useEffect`, which
 * guaranteed a light flash on every load for anyone whose preference was dark.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
