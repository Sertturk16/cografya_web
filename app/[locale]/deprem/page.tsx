import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EarthquakeAttribution } from "@/components/earthquake/earthquake-attribution";
import { EarthquakeFilters } from "@/components/earthquake/earthquake-filters";
import { EarthquakeList } from "@/components/earthquake/earthquake-list";
import { EarthquakeMap } from "@/components/earthquake/earthquake-map";
import { getEarthquakeListResilient, getEarthquakeMetaResilient } from "@/lib/api/earthquakes";
import { getProvincesResilient } from "@/lib/api/provinces";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./deprem.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/**
 * `/deprem` ↔ `/en/earthquakes` — the earthquake hub (PR-A, `deprem-sayfalari` plan).
 *
 * RENDERING (§5.2). `ENGINEERING.md` §3 names this leg by name: "Live-data feeds
 * (earthquake/AQI/SST, Faz-2+) = SSR or short-ISR shell with a client live-numbers island."
 * The default view (magnitude ≥ 2.5, last 7 days, page 1 — the api's own defaults) is fetched
 * server-side with a SHORT ISR window mirrored from the api's own `s-maxage`
 * (`lib/api/earthquakes.ts`: 120 s list, 3600 s meta) — the full server-rendered HTML is the
 * indexable content, satisfying `ENGINEERING.md` §4 #1 without needing a client fetch for the
 * first paint.
 *
 * NO LIVE COUNT REACHES THE HEAD. `metaTitle`/`metaDescription` are structural strings only
 * (`messages/{tr,en}.json`), never a live event count baked into `<title>` at revalidate time —
 * the same reasoning `/deniz`'s own docblock states ("a number baked into <title> would sit
 * wrong in the SERP for hours").
 *
 * RESILIENCE (§5.3). `…Resilient` reads — the list and map ARE this page, mirroring
 * `getMarinePointsResilient`'s reasoning. The COLD state (`dataStatus: "unavailable"`,
 * `items: []`) renders honestly (§5.11): an empty `items` array is a real "no earthquakes
 * match the current window" answer, never treated as a fetch failure to fall back from.
 *
 * PAGINATION/FILTERING STAY CLIENT-ONLY (§5.10) — no `?minMagnitude=`/`?page=` canonical
 * variant. `EarthquakeFilters` (`"use client"`) owns that, reading `/api/earthquakes`, this
 * repo's own Route Handler proxy, never the api directly.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Earthquake" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/deprem",
    title: t("metaTitle"),
    description: t("metaDescription"),
    // `"localized"` (§5.14) — the substance here is data (events, coordinates, magnitudes,
    // timestamps, place names), not a translation the way `/deniz`'s seven explainer blocks
    // are; fully indexable in both locales from day one.
  });
}

export default async function EarthquakePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Earthquake");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: "/deprem" });

  const [list, meta, provinces] = await Promise.all([
    getEarthquakeListResilient(),
    getEarthquakeMetaResilient(),
    getProvincesResilient(),
  ]);

  const provinceNameByPlateCode = new Map(provinces.map((p) => [p.plateCode, p.nameTr]));

  const listStrings = {
    tableSummary: t("list.tableSummary"),
    scrollRegionLabel: t("list.scrollRegionLabel"),
    colMagnitude: t("list.colMagnitude"),
    colPlace: t("list.colPlace"),
    colTime: t("list.colTime"),
    emptyState: t("list.emptyState"),
    bindingOffshoreNear: (province: string) => t("binding.offshoreNear", { province }),
    bindingAcrossBorder: (province: string) => t("binding.acrossBorder", { province }),
  };

  return (
    <div className="container page">
      <JsonLd
        schema={[
          // `CollectionPage` only — no `ItemList`, no per-event node (§5.9): every
          // node/field derived from a measurement result is out of scope for structured
          // data (SEO-POLICY §5.2's tool-surface rule, applied by analogy), and there is
          // no per-event page to link an `ItemList` entry to (`DEC 2026-08-12k` D-E).
          collectionPageJsonLd({
            name: t("heading"),
            description: t("metaDescription"),
            path,
            locale,
          }),
        ]}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("deprem"), href: "/deprem" },
        ]}
      />
      <h1>{t("heading")}</h1>
      <p className="lede">{t(`lede.${list.meta.dataStatus}`)}</p>

      <dl className={styles.metaFacts}>
        <div className={styles.metaFact}>
          <dt>{t("meta.magnitudeFloorLabel")}</dt>
          <dd>
            {t("meta.magnitudeFloorValue", {
              value: new Intl.NumberFormat(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }).format(meta.minMagnitudeDefault),
            })}
          </dd>
        </div>
        <div className={styles.metaFact}>
          <dt>{t("meta.scopeBufferLabel")}</dt>
          <dd>{t("meta.scopeBufferValue", { km: meta.scopeBufferKm })}</dd>
        </div>
        <div className={styles.metaFact}>
          <dt>{t("meta.freshnessLabel")}</dt>
          <dd>{t(`meta.freshness.${meta.dataStatus}`)}</dd>
        </div>
      </dl>

      <EarthquakeFilters
        locale={locale}
        defaultMinMagnitude={list.meta.filter.minMagnitude}
        defaultWindowDays={meta.defaultWindowDays}
        provinceNameByPlateCode={provinceNameByPlateCode}
      >
        <EarthquakeMap
          locale={locale}
          events={list.items}
          title={t("map.title")}
          description={t("map.description", { count: list.items.length })}
          idSuffix="default"
        />
        <EarthquakeList
          locale={locale}
          events={list.items}
          provinceNameByPlateCode={provinceNameByPlateCode}
          strings={listStrings}
        />
      </EarthquakeFilters>

      <EarthquakeAttribution attributions={meta.attributions} disclaimerTr={meta.disclaimerTr} />
    </div>
  );
}
