import type { ReactNode } from "react";

/**
 * Fullscreen play surfaces.
 *
 * No header, no footer, no shared `<main>`: T-015 gave these screens a fullscreen mode and a
 * best-effort landscape lock, and site chrome fights both. Membership is decided by which
 * directory a route lives in, so opting out is a structural fact rather than a missing
 * import — the failure mode the `(site)` group exists to remove.
 *
 * The three mode screens are the only members. Anything else belongs in `(site)`.
 */
export default function PlayLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
