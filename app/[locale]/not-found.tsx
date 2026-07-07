import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Localized 404 boundary. A real 404 status (not a soft-200) is returned for
// unknown slugs via notFound() (CONVENTIONS §6 #6) — verified via curl.
//
// KNOWN LIMITATION — no localized <title> is set on the 404 (it inherits the layout's
// default homepage title). This is deliberate, not an oversight:
//   • not-found.tsx receives no `params`, so the only way to resolve the locale is a
//     request read (getTranslations without an explicit locale). In this SSG setup that
//     flips the statically-prerendered dynamic route that threw notFound() "from static
//     to dynamic at runtime" and 500s instead of returning 404 — a real regression.
//   • Returning the title from the throwing route's own generateMetadata does not work
//     either: once notFound() fires, Next resolves the title from THIS boundary, which
//     cannot statically know the locale (above).
// The only fix would force the core province route SSG→SSR, violating SEO §6 #1/#9 for
// zero benefit (404s are never indexed). Tracked as a follow-up (revisit if a future
// next-intl/Next exposes the locale to not-found statically).
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="container page">
      <h1>{t("heading")}</h1>
      <p className="lede">{t("body")}</p>
      <p className="section">
        <Link className="btn btn-primary" href="/">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
