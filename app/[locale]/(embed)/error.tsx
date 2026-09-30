"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The `(embed)` group's error boundary, sibling of `(site)/error.tsx` and `(play)/error.tsx`.
 *
 * A group without one falls through to `app/global-error.tsx`, the unstyled shell that replaces
 * the whole document, header included. This renders inside the group's layout, so the header
 * and `<main>` stay; the box is a scrolling one because `<main>` is exactly one viewport
 * minus the header tall.
 *
 * Focus moves to the heading on mount, and the `error` argument is neither logged nor rendered,
 * for the reasons the `(site)` boundary records.
 */
export default function V2EmbedError({
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-24 sm:px-6 lg:px-8">
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
    </div>
  );
}
