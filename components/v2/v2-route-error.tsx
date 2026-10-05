"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The body every route group's `error.tsx` renders: heading, one sentence, "Tekrar dene".
 *
 * `docs/design.md`'s a11y floor requires a state change of this kind to announce itself:
 * focus moves to the heading on mount, which is why the heading is `tabIndex={-1}` —
 * focusable programmatically, never in the tab order. The boundary swaps page content in
 * place mid-session, so a reader who is not watching the viewport gets no other signal.
 *
 * `useTranslations` works here: every boundary renders inside the locale layout's
 * `NextIntlClientProvider`. A client component cannot `await getTranslations`, but it does not
 * need to.
 *
 * It takes no `error`, on purpose. The error can carry a server stack, and Next already reports
 * server-side failures through its own channel; putting it on screen or in the console adds
 * nothing a reader or a developer does not already have.
 *
 * The narrow message column stays in each `error.tsx` (a `<div>`, or a `<main>` in `(play)`,
 * whose layout has none): the layout-container scanners read it there.
 */
export function V2RouteError({ reset }: { reset: () => void }) {
  const t = useTranslations("Error");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-3xl font-bold text-foreground"
      >
        {t("heading")}
      </h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <Button type="button" variant="primary" onClick={reset} leftIcon={<RotateCw />}>
        {t("retry")}
      </Button>
    </>
  );
}
