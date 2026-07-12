import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { WorldMapSection } from "@/components/map/world-map-section";
import { getCountriesResilient } from "@/lib/api/countries";
import type { CountryListItem } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  collectionPageJsonLd,
  itemListJsonLd,
  type ItemListEntry,
  JsonLd,
} from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/** The localized slug (slug_tr for tr, slug_en for en). */
function slugForLocale(country: CountryListItem, locale: Locale): string {
  return locale === "en" ? country.slugEn : country.slugTr;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dunya" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/dunya",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/**
 * `/dunya` — the interactive world map as a dedicated, indexable hub page (→ DEC 2026-07-13),
 * mirroring `/turkiye` one level up. The map (`WorldMapSection`) is server-rendered with real
 * crawlable `<a>` links to every seeded country, so this page carries full HTML content in the
 * first response (SEO §6 #1) and targets real Turkish world-map/country search intent ("dünya
 * haritası" / "ülkeler"). JSON-LD is a `CollectionPage` (the page IS a curated collection of
 * countries) plus an `ItemList` enumerating the concrete published country pages — only pages
 * that actually exist, never a soft-404 URL.
 */
export default async function DunyaPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dunya");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: "/dunya" });

  // The published-country list is the authoritative set of pages that exist; the ItemList
  // enumerates ONLY these (never an unseeded country → no soft-404 in structured data).
  // Resilient fetch: a transient failure yields an empty list (→ ItemList with zero items)
  // rather than breaking the page — the map section degrades the same way.
  const countries = await getCountriesResilient();
  const items: ItemListEntry[] = countries.map((country) => ({
    name: country.nameTr,
    path: getPathname({
      locale,
      href: { pathname: "/dunya/[slug]", params: { slug: slugForLocale(country, locale) } },
    }),
  }));

  return (
    <div className="container page">
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: t("heading"),
            description: t("metaDescription"),
            path,
            locale,
          }),
          itemListJsonLd({ name: t("heading"), items }),
        ]}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("dunya"), href: "/dunya" },
        ]}
      />
      <h1>{t("heading")}</h1>
      <p className="lede">{t("intro")}</p>

      <WorldMapSection locale={locale} />
    </div>
  );
}
