"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useAuthModalState } from "@/lib/auth/auth-modal.client";

/**
 * The `ssr: false` boundary for the auth dialog (uyelik-auth-redesign plan §5.7,
 * `ENGINEERING.md` §3 — the `tool-island-loader.tsx`/`game-island-loader.tsx` pattern:
 * `next/dynamic` with `ssr: false` is not allowed inside a Server Component, so the option
 * needs its own client module). `AuthDialog` pulls in `RegisterForm`, which pulls the
 * reference-list fetch logic and the profile-label tables — that must not be in the first-load
 * bundle of all 196 pages (K8).
 */
const AuthDialog = dynamic(() => import("./auth-dialog").then((mod) => mod.AuthDialog), {
  ssr: false,
});

/**
 * Mounted once at the locale layout (`app/[locale]/layout.tsx`). Renders NOTHING until the
 * modal store's `open` first becomes `true` — the dialog therefore contributes ZERO bytes to
 * every page's first response, holding `SEO-POLICY.md` §B12 12.3.a (byte-identical first
 * response regardless of identity) STRUCTURALLY rather than by inspection. Once opened, the
 * dialog module stays mounted for the rest of the document's life (a closed native `<dialog>`
 * costs nothing) rather than unmounting on every close — an ordinary "adjusting state during
 * render" transition, the same idiom this repo's own auth/register/tool components already use.
 */
export function AuthMount({ locale }: { readonly locale: Locale }) {
  const pathname = usePathname();

  const modal = useAuthModalState();
  const [hasOpened, setHasOpened] = useState(false);

  // On V2 routes, V2AuthDialog handles the auth modal; avoid double-dialog collision.
  const pathStr = (pathname as string) || "";
  if (pathStr.startsWith("/v2") || pathStr.includes("/v2")) {
    return null;
  }

  if (modal.open && !hasOpened) {
    setHasOpened(true);
  }
  if (!hasOpened) return null;
  return <AuthDialog locale={locale} />;
}

