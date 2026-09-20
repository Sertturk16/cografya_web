"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelLeave, confirmLeave, releaseAllUnsavedChanges } from "@/lib/forms/unsaved-changes";
import { useUnsavedChangesState } from "@/lib/forms/use-unsaved-changes.client";

/**
 * "You have unsaved changes" (T-062) — rendered ONCE, in `app/[locale]/layout.tsx`.
 *
 * That is the only mount point that covers both route groups: `(site)` and `(play)` are groups
 * under `[locale]`, so one instance here serves the settings page, the registration wizard and
 * the fullscreen game screens alike. One per layout would be two mount points and two chances to
 * forget one.
 *
 * ## The safe answer is the default one
 *
 * Focus opens on "stay", not on "leave". The member's intent was to leave, so this looks backwards
 * for a moment — but the cost of an accidental Enter on "leave" is the lost edit this whole
 * pattern exists to prevent, and the cost of an accidental Enter on "stay" is one more click.
 * Escape and the backdrop both mean stay, for the same reason, and `showCloseButton={false}`
 * removes the fourth exit: an X in the corner of this dialog does not say which of the two
 * answers it gives.
 *
 * ## Why `next/navigation`'s router
 *
 * `pendingPath` is what an `<a>` already resolved, or what `getPathname` resolved for a
 * programmatic push — locale prefix included. Pushing it through next-intl's router would prefix
 * it a second time and send an `/en` reader to `/en/en/…`. This is the same exception
 * `v2-login-card.tsx` and `v2-verify-email-card.tsx` record for the BFF's `safeReturnPath()`
 * output, and `lib/forms/navigation-import-discipline.test.ts` holds the list of files allowed it.
 */
export function UnsavedChangesDialog() {
  const t = useTranslations("Common.unsavedChanges");
  const router = useRouter();
  const { pendingPath } = useUnsavedChangesState();
  const stayRef = React.useRef<HTMLButtonElement | null>(null);

  /**
   * What had focus when the guard fired — the link the member clicked.
   *
   * Base UI returns focus to a dialog's TRIGGER, and this dialog has none: it opens because a
   * store changed, not because anything in it was activated. Without this, choosing "stay" left
   * focus on `<body>` and a keyboard member's next Tab restarted from the top of the page,
   * which is the failure WCAG 2.4.3 describes. Capturing it here rather than in the store keeps
   * the module state to plain values, the way `lib/auth/auth-modal.client.ts` requires: the
   * element is live only while the dialog is open, and the guard leaves focus exactly where it
   * was, because a prevented click never moves it.
   */
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const open = pendingPath !== null;
  React.useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) returnFocusRef.current = active;
  }, [open]);

  const leave = () => {
    const path = confirmLeave();
    if (path === null) return;
    // The held sources belong to forms that are about to unmount. Releasing them first is what
    // stops the guard from catching the very navigation it was just told to allow.
    releaseAllUnsavedChanges();
    router.push(path);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cancelLeave();
      }}
    >
      <DialogContent
        size="sm"
        showCloseButton={false}
        initialFocus={stayRef}
        finalFocus={returnFocusRef}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={leave}>
            {t("leave")}
          </Button>
          <Button ref={stayRef} variant="primary" onClick={() => cancelLeave()}>
            {t("stay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
