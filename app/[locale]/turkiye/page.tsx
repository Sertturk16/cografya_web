import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EntityIndex } from "@/components/entity-index/entity-index";
import { TurkeyMapSection } from "@/components/map/turkey-map-section";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { ProvinceListItem } from "@/lib/api/types";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { type AlphabetBucket, bucketByInitial, flattenBuckets } from "@/lib/geo/alphabet";
import { PROVINCE_INDEX_SECTION_ID } from "@/lib/geo/hub-index";
import { pickHubDescription } from "@/lib/seo/hub-description";
import {
  collectionPageJsonLd,
  itemListJsonLd,
  type ItemListEntry,
  JsonLd,
} from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./turkiye.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/**
 * Province labels are Turkish in BOTH locales — `ProvinceListItem` carries no `nameEn` —
 * so the index collates with Turkish rules even on `/en/turkiye`. Collating Turkish names
 * with English rules is what would mis-file "Ağrı" and "Çanakkale"
 * (see `lib/geo/alphabet.ts`).
 */
const PROVINCE_COLLATION_LOCALE = "tr";

/** The localized slug (slug_tr for tr, slug_en for en). */
function slugForLocale(province: ProvinceListItem, locale: Locale): string {
  return locale === "en" ? province.slugEn : province.slugTr;
}

/**
 * The page's one derivation of the province index: fetch → localized entries → buckets →
 * flat render order. `generateMetadata` and the body BOTH go through here (review CR-M1),
 * so the count in the meta description is by construction the count the page renders —
 * previously metadata used the raw api list while the body used the post-bucket list, two
 * numbers that could disagree.
 *
 * The two calls per render share one fetch through Next's request memoization, the same
 * coupling every hub in this repo relies on (FENER F-M2). Worth noting rather than
 * defending: even if that memoization lapsed, both callers now run identical code over the
 * same endpoint, so a divergence would need the api itself to change mid-render.
 */
async function loadProvinceIndex(
  locale: Locale,
): Promise<{ buckets: AlphabetBucket<ItemListEntry>[]; items: ItemListEntry[] }> {
  // The published-province list is the authoritative set of pages that exist; the ItemList
  // enumerates ONLY these (never an unseeded il → no soft-404 in structured data).
  // Resilient fetch: a transient failure yields an empty list (→ no section, ItemList with
  // zero items) rather than breaking the page — the map section degrades the same way.
  const provinces = await getProvincesResilient();
  const entries: ItemListEntry[] = provinces.map((province) => ({
    name: province.nameTr,
    path: getPathname({
      locale,
      href: { pathname: "/turkiye/[slug]", params: { slug: slugForLocale(province, locale) } },
    }),
  }));

  const buckets = bucketByInitial(
    entries,
    (entry) => entry.name,
    PROVINCE_COLLATION_LOCALE,
    PROVINCE_INDEX_SECTION_ID,
  );
  return { buckets, items: flattenBuckets(buckets) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Turkiye" });
  // The count is interpolated rather than written into the string, so the description can
  // never claim more than the page lists (`SEO-POLICY.md` §A2.2 encourages page-specific
  // data in programmatic descriptions). The empty case routes to the count-less variant —
  // see `pickHubDescription`.
  const { items } = await loadProvinceIndex(locale);

  return buildMetadata({
    locale,
    hrefForLocale: () => "/turkiye",
    title: t("metaTitle"),
    description: pickHubDescription(
      t("metaDescription", { count: items.length }),
      t("metaDescriptionFallback"),
      items.length,
    ),
  });
}

/**
 * `/turkiye` — the interactive Türkiye map as a dedicated, indexable hub page
 * (IA restructure → DEC 2026-07-13, replacing the retired `/iller` plain list).
 *
 * The map (`TurkeyMapSection`) is server-rendered with real crawlable `<a>` links to
 * every published province, so this page carries full HTML content in the first
 * response (SEO §6 #1) and targets real Turkish map/province-index search intent
 * ("türkiye haritası" / "türkiye'nin illeri"). JSON-LD is a `CollectionPage` (the page
 * IS a curated collection of the provinces) plus an `ItemList` enumerating the concrete
 * published province pages — only pages that actually exist, never a soft-404 URL.
 */
export default async function TurkiyePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Turkiye");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: "/turkiye" });

  // ONE ordering feeds the visible A→Z list, the ItemList below and the meta description,
  // so structured data can never enumerate a name or an order the reader does not see
  // (SEO-POLICY §B5.7).
  const { buckets, items } = await loadProvinceIndex(locale);
  const description = pickHubDescription(
    t("metaDescription", { count: items.length }),
    t("metaDescriptionFallback"),
    items.length,
  );

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
          { label: tb("turkiye"), href: "/turkiye" },
        ]}
      />
      <h1>{t("heading")}</h1>
      <p className="lede">{t("intro")}</p>

      <TurkeyMapSection locale={locale} />

      {/* The alphabetical index (→ DEC 2026-08-04i §2). It sits directly under the map
          because it is the SECOND way into the same 81 pages, not a footnote: the UX review
          found the map was the only entry point and called that the site's single most
          critical gap. Deliberately above the two CTA cards, which are cross-links, not
          content. */}
      <EntityIndex
        sectionId={PROVINCE_INDEX_SECTION_ID}
        headingId="turkiye-index-heading"
        heading={t("indexHeading")}
        description={t("indexDescription", { count: items.length })}
        letterNavLabel={t("indexLetterNavLabel")}
        buckets={buckets}
      />

      {/* Hub-and-spoke link to the map game (SPEC §10.4, CONVENTIONS §6 #10). It lives in
          the PAGE body, deliberately outside `TurkeyMapSection`: that component owns the
          81 crawlable province links and is not opened by game work. */}
      <section className="section" aria-labelledby="turkiye-game-heading">
        <div className={`card ${styles.ctaCard}`}>
          <h2 id="turkiye-game-heading">{t("gameCtaHeading")}</h2>
          {/* The descriptive paragraph under this heading is gone (→ DEC 2026-07-30t/u,
              CONTENT-STYLE §22): it narrated the game's mechanic ("ekranda çıkan ili …
              işaretlersiniz"), which the heading and the button already imply. */}
          <Link href="/oyun" className="btn btn-primary">
            {t("gameCtaLink")}
          </Link>
        </div>
      </section>

      {/* Hub-and-spoke cross-link to the marine hub (owner answer S8, CONVENTIONS §6 #10).
          It belongs on THIS page specifically: 27 of the 81 provinces indexed above have a
          coast, and `/deniz` is where their offshore reference points and the measurement
          catalogue live. The link is deliberately thematic, not navigational duplication —
          the header already carries the nav entry. */}
      <section className="section" aria-labelledby="turkiye-marine-heading">
        <div className={`card ${styles.ctaCard}`}>
          <h2 id="turkiye-marine-heading">{t("marineCtaHeading")}</h2>
          <Link href="/deniz" className="btn btn-primary">
            {t("marineCtaLink")}
          </Link>
        </div>
      </section>
    </div>
  );
}
