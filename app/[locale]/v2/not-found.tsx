import { getTranslations } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2Footer } from "@/components/v2/v2-footer";

/**
 * V2's own 404 boundary.
 *
 * Before this file existed, a V2 route calling `notFound()` rendered
 * `app/[locale]/not-found.tsx` INSIDE V1 header and footer: a not-found boundary replaces
 * `children`, so the `.v2-app` wrapper never rendered and the
 * `body:has(.v2-app) > header, footer` suppression rule in `app/globals.css` never matched.
 * A reader who mistyped a province slug got the V1 chrome back.
 *
 * The locale-less `getTranslations()` call and the missing localized `<title>` are the same
 * recorded limitation `app/[locale]/not-found.tsx` documents — `not-found.tsx` receives no
 * `params`, and resolving the locale statically is not available. Unchanged here on purpose:
 * the alternative flips every statically-prerendered route that can throw `notFound()` to
 * dynamic, which 500s instead of returning 404.
 *
 * No homepage link: a routing-aware `Link` needs the locale this boundary cannot resolve, and
 * the header already carries a working one.
 */
export default async function V2NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <V2Header />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">404</p>
          <h1 className="font-heading text-3xl font-bold text-foreground">{t("heading")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
      </div>
      <V2Footer />
    </div>
  );
}
