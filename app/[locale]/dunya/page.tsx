import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EntityIndex } from "@/components/entity-index/entity-index";
import { WorldMapSection } from "@/components/map/world-map-section";
import { getCountriesResilient } from "@/lib/api/countries";
import type { CountryListItem } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { bucketByInitial } from "@/lib/geo/alphabet";
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

/** Same-page anchor for the alphabetical section — locale-independent, never a URL. */
const INDEX_SECTION_ID = "ulkeler";

/** The localized slug (slug_tr for tr, slug_en for en). */
function slugForLocale(country: CountryListItem, locale: Locale): string {
  return locale === "en" ? country.slugEn : country.slugTr;
}

/**
 * The localized display name. Unlike provinces, country DTOs carry both names, so the EN
 * hub shows English names — which is also why the country index collates with the PAGE
 * locale (English names under English rules) while the province index is pinned to Turkish.
 */
function nameForLocale(country: CountryListItem, locale: Locale): string {
  return locale === "en" ? country.nameEn : country.nameTr;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dunya" });
  // See the twin comment in `/turkiye`: the count is interpolated from the same resilient
  // list the body renders (deduped fetch), so the description cannot promise more than the
  // page lists, and an empty list falls back to the count-less variant (§B2.6).
  const countries = await getCountriesResilient();

  return buildMetadata({
    locale,
    hrefForLocale: () => "/dunya",
    title: t("metaTitle"),
    description:
      countries.length > 0
        ? t("metaDescription", { count: countries.length })
        : t("metaDescriptionFallback"),
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
  // `nameForLocale`, not `nameTr`: the ItemList now carries the SAME name the reader sees
  // in the list and on the map, in both locales. It previously emitted Turkish names on the
  // English hub, which was a latent §B5.7 ("data in the JSON-LD that is not visible on the
  // page") divergence that only became obvious once the names became visible text.
  const entries: ItemListEntry[] = countries.map((country) => ({
    name: nameForLocale(country, locale),
    path: getPathname({
      locale,
      href: { pathname: "/dunya/[slug]", params: { slug: slugForLocale(country, locale) } },
    }),
  }));

  // ONE ordering feeds both the visible A→Z list and the ItemList (SEO-POLICY §B5.7).
  const buckets = bucketByInitial(entries, (entry) => entry.name, locale, INDEX_SECTION_ID);
  const items: ItemListEntry[] = buckets.flatMap((bucket) => [...bucket.items]);
  const description =
    items.length > 0 ? t("metaDescription", { count: items.length }) : t("metaDescriptionFallback");

  return (
    <div className="container page">
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: t("heading"),
            description,
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

      {/* The alphabetical index (→ DEC 2026-08-04i §2), mirroring `/turkiye` one level up.
          The six sovereignty-sensitive entries appear as plain rows under the exact display
          names the map and hover cards already use — no added framing, no omissions
          (owner ruling on plan Q4); the names come from the api, never from this file. */}
      <EntityIndex
        sectionId={INDEX_SECTION_ID}
        headingId="dunya-index-heading"
        heading={t("indexHeading")}
        description={t("indexDescription", { count: items.length })}
        letterNavLabel={t("indexLetterNavLabel")}
        buckets={buckets}
      />
    </div>
  );
}
