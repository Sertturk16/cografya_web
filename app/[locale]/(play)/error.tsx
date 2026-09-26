"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V2Header } from "@/components/v2/v2-header";

/**
 * The play group's error boundary, sibling of `app/[locale]/(site)/error.tsx`.
 *
 * Without it a throw on a game screen (e.g. `getMapSummaryResilient()` failing with no cached
 * copy of the page) fell through to `app/global-error.tsx`: an unstyled last-resort shell that
 * replaces the whole document, header included.
 *
 * The `(play)` layout has no chrome, so the page renders `V2Header` itself and this boundary
 * replaces the page. It therefore draws the header and its own `<main>` again, the way
 * `V2GameScreen` does. The ticker is left out: it fetches live feeds on its own, and the likely
 * reason to be here is that the API is down.
 *
 * Focus moves to the heading on mount and the `error` argument is neither logged nor rendered,
 * for the reasons the `(site)` boundary records.
 */
export default function V2PlayError({
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
      <V2Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-5">
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
      </main>
    </>
  );
}
