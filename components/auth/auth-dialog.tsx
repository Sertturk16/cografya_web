"use client";

import { useEffect, useRef } from "react";
import { dismissAuth, resolveAuth, useAuthModalState } from "@/lib/auth/auth-modal.client";
import type { Locale } from "@/i18n/routing";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { AuthDialogBody } from "./auth-dialog-body";
import styles from "./auth-dialog.module.css";

/**
 * The auth modal's native `<dialog>` shell (uyelik-auth-redesign plan §5.7) — modelled
 * directly on `components/game/game-summary.tsx`'s own `showModal()` dialog, the repo's one
 * real modal precedent (plan §2.5): focus trapping, Esc-to-close, an inert background and
 * top-layer stacking come from the platform, and a modal costs no layout shift because it
 * never participates in page flow.
 */
export function AuthDialog({ locale }: { readonly locale: Locale }) {
  const modal = useAuthModalState();
  const [, setAuthState] = useAuthSession();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal.open && !dialog.open) {
      dialog.showModal();
      // `<dialog>` autofocuses the first focusable control; move focus to the heading instead
      // so the mode/intent are read out first (WCAG 4.1.3) — identical to `GameSummary`'s own
      // reasoning.
      headingRef.current?.focus();
    } else if (!modal.open && dialog.open) {
      dialog.close();
    }
  }, [modal.open]);

  // Auth succeeded: the shared session store propagates to every mounted consumer, and
  // `resolveAuth()` lets each gated call site's own resume effect pick up its own request.
  const handleAuthenticated = () => {
    setAuthState("authenticated");
    resolveAuth();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="auth-dialog-heading"
      onClose={dismissAuth}
      // Native `<dialog>` has no built-in backdrop-click-to-close; a click on the dialog
      // ELEMENT ITSELF (its own box, which the backdrop paints over) is the click that closes
      // it — the inner `.dialogBody` swallows any click that lands on real content.
      onClick={(event) => {
        if (event.target === dialogRef.current) dismissAuth();
      }}
    >
      <AuthDialogBody
        headingRef={headingRef}
        intent={modal.intent}
        mode={modal.mode}
        locale={locale}
        onAuthenticated={handleAuthenticated}
        onClose={dismissAuth}
      />
    </dialog>
  );
}
