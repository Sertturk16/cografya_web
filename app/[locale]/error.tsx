"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Locale segment error boundary (App Router `error.tsx`). It renders INSIDE the
 * locale layout's `NextIntlClientProvider`, so `useTranslations` resolves the
 * localized fallback (keys `Error.*`). It catches render/runtime errors thrown by
 * any page below `[locale]` and offers `reset()` to re-attempt the segment.
 *
 * Error pages are not indexed, so there is no SEO surface here (no metadata/JSON-LD).
 */
export default function LocaleError({ error, reset }: ErrorProps) {
  const t = useTranslations("Error");
  const tNotFound = useTranslations("NotFound");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Surface the error for diagnostics. A real logging sink (Sentry/etc.) lands
    // with the observability work in a later phase.
    console.error(error);
    // This boundary can swap page content in place mid-session, so move AT focus
    // to the error heading — same tabIndex={-1} + focus() technique used for
    // #main-content in the layout — signalling the state change (WCAG 4.1.3).
    headingRef.current?.focus();
  }, [error]);

  return (
    <div className="container page">
      <h1 ref={headingRef} tabIndex={-1}>
        {t("heading")}
      </h1>
      <p className="lede">{t("body")}</p>
      <div className="hero-actions">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          {t("retry")}
        </button>
        <Link className="btn btn-ghost" href="/">
          {tNotFound("backHome")}
        </Link>
      </div>
    </div>
  );
}
