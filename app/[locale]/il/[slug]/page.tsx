import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import {
  byPlateCode,
  getProvinceBySlug,
  getProvinces,
  getProvincesResilient,
} from "@/lib/api/provinces";
import type { ProvinceDetail, ProvinceListItem } from "@/lib/api/types";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { administrativeAreaJsonLd, type GeoPropertyValue, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./province-detail.module.css";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

/** The localized slug (slug_tr for tr, slug_en for en) for a province. */
function slugForLocale(province: ProvinceDetail | ProvinceListItem, locale: Locale): string {
  return locale === "en" ? province.slugEn : province.slugTr;
}

// SSG the real provinces; unknown slugs fall through to notFound() (never a
// soft-200), per CONVENTIONS §6 #6. Build-safe: if the api is unreachable during
// `next build` the list is empty and pages render on-demand via ISR at runtime.
export async function generateStaticParams() {
  const provinces = await getProvincesResilient();
  return routing.locales.flatMap((locale) =>
    provinces.map((province) => ({ locale, slug: slugForLocale(province, locale) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const province = await getProvinceBySlug(slug);
  // Unknown slug → the page component throws notFound() (real 404, CONVENTIONS §6 #6).
  // Returning nothing bespoke here is deliberate: once notFound() fires Next resolves
  // the document title from the not-found boundary, so any title returned here is
  // discarded (see not-found.tsx for the full rationale).
  if (!province) return {};

  const t = await getTranslations({ locale, namespace: "ProvinceDetail" });
  const tRegions = await getTranslations({ locale, namespace: "Regions" });
  const name = province.nameTr;
  const region = tRegions(province.region);

  return buildMetadata({
    locale,
    // localized-slug alternates: slug_tr for tr, slug_en for en.
    hrefForLocale: (l) => ({
      pathname: "/il/[slug]",
      params: { slug: slugForLocale(province, l) },
    }),
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name, region }),
    openGraphType: "article",
  });
}

export default async function ProvinceDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const province = await getProvinceBySlug(slug);
  if (!province) {
    notFound();
  }

  const t = await getTranslations("ProvinceDetail");
  const tb = await getTranslations("Breadcrumb");
  const tp = await getTranslations("Provinces");
  const tRegions = await getTranslations("Regions");
  const format = await getFormatter();

  const name = province.nameTr;
  const region = tRegions(province.region);
  const selfHref = {
    pathname: "/il/[slug]",
    params: { slug: slugForLocale(province, locale) },
  } as const;
  const path = getPathname({ locale, href: selfHref });

  // Neighbour cross-links (hub-and-spoke, CONVENTIONS §6 #10). Resolve each
  // neighbour plaka code to a province that actually has a page; codes without a
  // published page are omitted (never rendered as a dead link). Best-effort: the
  // block is progressive enhancement, so a list-fetch failure just hides it
  // rather than breaking the (already-loaded) detail page.
  let neighbors: ProvinceListItem[] = [];
  try {
    const all = byPlateCode(await getProvinces());
    neighbors = province.neighborPlateCodes
      .map((code) => all.get(code))
      .filter((p): p is ProvinceListItem => p !== undefined);
  } catch (error) {
    console.warn(`[province:${slug}] neighbour resolution skipped: ${String(error)}`);
  }

  // schema.org PropertyValue facts — only the values the api actually has (null
  // fields are skipped, never invented). Labels come from i18n so JSON-LD and the
  // visible fact sheet stay in step.
  const additionalProperty: GeoPropertyValue[] = [];
  if (province.population !== null) {
    additionalProperty.push({
      name: province.populationYear
        ? t("populationWithYear", { year: province.populationYear })
        : t("population"),
      value: province.population,
    });
  }
  if (province.areaKm2 !== null) {
    additionalProperty.push({
      name: t("area"),
      value: province.areaKm2,
      unitText: t("areaUnit"),
      unitCode: "KMK",
    });
  }
  if (province.districtCount !== null) {
    additionalProperty.push({ name: t("districtCount"), value: province.districtCount });
  }
  if (province.elevationM !== null) {
    additionalProperty.push({
      name: t("elevation"),
      value: province.elevationM,
      unitText: t("elevationUnit"),
      unitCode: "MTR",
    });
  }

  // Precompute nullable-field bundles so TS narrows cleanly (no non-null asserts).
  const geo =
    province.latitude !== null && province.longitude !== null
      ? { latitude: province.latitude, longitude: province.longitude }
      : null;
  const climate =
    province.climateClassTr !== null && province.climateKoppen !== null
      ? { className: province.climateClassTr, koppen: province.climateKoppen }
      : null;

  return (
    <div className="container page">
      <JsonLd
        schema={administrativeAreaJsonLd({
          name,
          path,
          locale,
          geo,
          additionalProperty,
          containedInPlace: { name: "Türkiye" },
          dateModified: province.updatedAt,
        })}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tp("heading"), href: "/iller" },
          { label: name, href: selfHref },
        ]}
      />
      <h1>{t("heading", { name })}</h1>
      <p className="lede">{t("summary", { name, region })}</p>

      <section className="section">
        <h2>{t("keyFactsHeading")}</h2>
        <dl className={styles.factSheet}>
          <div className={styles.fact}>
            <dt>{t("region")}</dt>
            <dd>{region}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{t("plateCode")}</dt>
            <dd>{province.plateCode}</dd>
          </div>
          {province.population !== null && (
            <div className={styles.fact}>
              <dt>
                {province.populationYear
                  ? t("populationWithYear", { year: province.populationYear })
                  : t("population")}
              </dt>
              <dd>{format.number(province.population)}</dd>
            </div>
          )}
          {province.areaKm2 !== null && (
            <div className={styles.fact}>
              <dt>{t("area")}</dt>
              <dd>
                {format.number(province.areaKm2)} {t("areaUnit")}
              </dd>
            </div>
          )}
          {province.districtCount !== null && (
            <div className={styles.fact}>
              <dt>{t("districtCount")}</dt>
              <dd>{format.number(province.districtCount)}</dd>
            </div>
          )}
          {province.elevationM !== null && (
            <div className={styles.fact}>
              <dt>{t("elevation")}</dt>
              <dd>
                {format.number(province.elevationM)} {t("elevationUnit")}
              </dd>
            </div>
          )}
          {geo && (
            <div className={styles.fact}>
              <dt>{t("coordinates")}</dt>
              <dd>
                {geo.latitude}, {geo.longitude}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {climate && (
        <section className="section">
          <h2>{t("climateHeading")}</h2>
          <p className={styles.climateValue}>
            {t("climateValue", { className: climate.className, koppen: climate.koppen })}
          </p>
          {province.climateNoteTr !== null && (
            <p className={styles.climateNote}>
              <span className={styles.climateNoteLabel}>{t("climateNoteLabel")}:</span>{" "}
              {province.climateNoteTr}
            </p>
          )}
        </section>
      )}

      {neighbors.length > 0 && (
        <section className="section">
          <h2>{t("neighborsHeading")}</h2>
          <ul className="province-grid">
            {neighbors.map((neighbor) => (
              <li key={neighbor.plateCode}>
                <Link
                  className="province-card"
                  href={{
                    pathname: "/il/[slug]",
                    params: { slug: slugForLocale(neighbor, locale) },
                  }}
                >
                  <span>{neighbor.nameTr}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.sources}>
        <span className={styles.sourcesLabel}>{t("sourcesLabel")}:</span> {t("sources")}
      </p>

      <p className="section">
        <Link href="/iller">← {t("backToProvinces")}</Link>
      </p>
    </div>
  );
}
