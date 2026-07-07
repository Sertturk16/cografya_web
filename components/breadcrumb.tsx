import { getTranslations } from "next-intl/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";

type Href = Parameters<typeof getPathname>[0]["href"];

export interface Crumb {
  label: string;
  /** next-intl internal href (localized automatically per locale). */
  href: Href;
}

/**
 * Renders the visual breadcrumb <nav> AND its matching BreadcrumbList JSON-LD
 * from a single source of truth (CONVENTIONS §6 #10). The last crumb is the
 * current page (not a link). JSON-LD item URLs are the absolute localized paths.
 */
export async function Breadcrumb({ locale, items }: { locale: Locale; items: Crumb[] }) {
  const t = await getTranslations("Breadcrumb");

  const jsonItems = items.map((crumb) => ({
    name: crumb.label,
    path: getPathname({ locale, href: crumb.href }),
  }));

  return (
    <>
      <JsonLd schema={breadcrumbJsonLd(jsonItems)} />
      <nav aria-label={t("label")} className="breadcrumb">
        <ol>
          {items.map((crumb, index) =>
            index < items.length - 1 ? (
              <li key={index}>
                <Link href={crumb.href}>{crumb.label}</Link>
              </li>
            ) : (
              <li key={index}>
                <span aria-current="page">{crumb.label}</span>
              </li>
            ),
          )}
        </ol>
      </nav>
    </>
  );
}
