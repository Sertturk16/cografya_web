"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * V2's error boundary.
 *
 * `docs/design.md`'s a11y floor requires a state change of this kind to announce itself:
 * focus moves to the heading on mount, which is why the heading is `tabIndex={-1}` —
 * focusable programmatically, never in the tab order. The boundary swaps page content in
 * place mid-session, so a reader who is not watching the viewport gets no other signal.
 *
 * `useTranslations` works here: this renders inside the locale layout's
 * `NextIntlClientProvider`, the same way `app/[locale]/(site)/error.tsx` already resolves the
 * `Error` namespace. A client component cannot `await getTranslations`, but it does not
 * need to.
 *
 * The `error` argument is deliberately neither logged nor rendered. It can carry a server
 * stack, and Next already reports server-side failures through its own channel; putting it
 * on screen or in the console adds nothing a reader or a developer does not already have.
 */
export default function V2Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-5">
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
      </div>
    </>
  );
}
