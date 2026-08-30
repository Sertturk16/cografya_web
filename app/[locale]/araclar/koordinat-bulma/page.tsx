import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
import type { ProvinceArea } from "@/components/tools/tool-island";
import { ToolMap } from "@/components/tools/tool-map";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { ProvinceListItem } from "@/lib/api/types";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { ContentSurface } from "@/lib/seo/indexing";
import { JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { buildProvincePoints } from "@/lib/tools/province-points";
import { COORDINATE_TOOL, DISTANCE_TOOL, TOOL_HUB_PATHNAME } from "@/lib/tools/tool-registry";
import styles from "../tools.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/** Same surface as the hub: TR indexable, `/en/tools/coordinates` `noindex, follow`. */
const TOOLS_SURFACE: ContentSurface = "trNarrative";

/**
 * The two provinces the prose names, by plaka kodu.
 *
 * The CODE is hardcoded and the SLUG is not, for the reason the distance page states at
 * length: `SEO-POLICY.md` §B4 4.5 bans deriving a locale's slug by hand, while a plaka kodu is
 * a stable identifier rather than a URL. Ankara and Iğdır are the textbook's own local-time
 * worked example (printed p.45).
 */
const ANKARA_PLATE = "06";
const IGDIR_PLATE = "76";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Tools.koordinat" });

  return buildMetadata({
    locale,
    hrefForLocale: () => COORDINATE_TOOL.pathname,
    title: t("metaTitle"),
    description: t("metaDescription"),
    surface: TOOLS_SURFACE,
  });
}

/**
 * `/araclar/koordinat-bulma` ↔ `/en/tools/coordinates` — latitude and longitude on the
 * Türkiye map.
 *
 * ## The order is the doorway defence, and it is a BLOCKER-level requirement
 *
 * SPEC §4.3 fixes it: heading → explanatory text → tool → how to read the result → cross
 * links. A reader who arrives from a search and never touches the tool must still leave with
 * the answer to "what are enlem and boylam, and why are there two ways of writing them"
 * (`SEO-POLICY.md` §B12.2.a/.b). That is why the text is server-rendered prose rather than
 * something the island prints.
 *
 * ## Where the text comes from
 *
 * `Owner's Inbox/cbs-p2/prose/arac-prose-draft.md` §3, Rev.3 (NOVA), through an independent
 * fact-check (§B13 13.1). The DMS block is the corrected one: the earlier claim that the
 * curriculum never divides a degree into minutes was disproved on the very page it cited, so
 * the paragraph now states what the book actually prints and no reader-facing sentence awards
 * DMS a curriculum status it does not have (→ AK-28, `GLOSSARY.md` §4.3).
 *
 * ## Rendering and the api read
 *
 * SSG with one api read — the province list, which supplies three things: the picker's
 * il-merkezi points (AK-27 md.2), the two cross-link slugs in the prose, and the names and
 * slugs the island needs to report which province a placed point fell inside (SPEC §6.2).
 * `getProvincesResilient` degrades to `[]` at BUILD (web CI has no api) and re-throws at
 * RUNTIME, so a transient blip leaves the last good static page in place instead of caching
 * one with no picker. Everything indexable is in the first response either way: the prose, the
 * map and the attribution do not depend on the api at all.
 */
export default async function CoordinateToolPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Tools.koordinat");
  const tHub = await getTranslations("Tools.hub");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: COORDINATE_TOOL.pathname });

  const provinces = await getProvincesResilient();
  const provincePoints = buildProvincePoints(provinces);

  // The island may NAME a province only when it can also LINK it, so the list carries the slug
  // the api published for this locale and nothing is derived by hand (§B4 4.5, A4/3).
  const provinceAreas: ProvinceArea[] = provinces.map((province) => ({
    plateCode: province.plateCode,
    name: province.nameTr,
    slug: locale === "en" ? province.slugEn : province.slugTr,
  }));

  // A4/3: a province the api does not publish gets NO link — the name stays plain text rather
  // than pointing at a page that may not exist.
  const provinceLink = (plateCode: string, chunks: ReactNode): ReactNode => {
    const province: ProvinceListItem | undefined = provinces.find(
      (candidate) => candidate.plateCode === plateCode,
    );
    if (province === undefined) return <>{chunks}</>;
    return (
      <Link
        href={{
          pathname: "/turkiye/[slug]",
          params: { slug: locale === "en" ? province.slugEn : province.slugTr },
        }}
      >
        {chunks}
      </Link>
    );
  };

  // The explanatory text exists in Turkish only (§B14): on `/en` the page is the tool plus its
  // chrome, and `EnWorkInProgressNotice` says so in the reader's own language.
  const rendersProse = locale === routing.defaultLocale;

  return (
    <div className="container page">
      <JsonLd
        schema={learningResourceJsonLd({
          name: t("heading"),
          description: t("metaDescription"),
          path,
          locale,
          learningResourceType: COORDINATE_TOOL.learningResourceType,
          teaches: t("teaches"),
        })}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("araclar"), href: TOOL_HUB_PATHNAME },
          { label: tHub("koordinatName"), href: COORDINATE_TOOL.pathname },
        ]}
      />

      <h1>{t("heading")}</h1>
      <EnWorkInProgressNotice locale={locale} />

      {rendersProse && (
        <div className={styles.prose}>
          <p className="lede">{t("lede")}</p>

          <h2>{t("sistemHeading")}</h2>
          <p>{t("sistemP1")}</p>
          <p>{t("sistemP2")}</p>

          <h2>{t("derecekmHeading")}</h2>
          <p>{t("derecekmP1")}</p>
          <p>
            {t.rich("derecekmP2", {
              mesafe: (chunks) => <Link href={DISTANCE_TOOL.pathname}>{chunks}</Link>,
            })}
          </p>

          <h2>{t("gosterimHeading")}</h2>
          <p>{t("gosterimP1")}</p>
          <p>{t("gosterimP2")}</p>
          <p>{t("gosterimP3")}</p>
        </div>
      )}

      <section className={styles.toolSection} aria-labelledby="tool-heading">
        <h2 id="tool-heading">{t("toolHeading")}</h2>
        <ToolMap
          locale={locale}
          mode="coordinate"
          provincePoints={provincePoints}
          provinceAreas={provinceAreas}
          downloadName="cografya-koordinat"
        />
      </section>

      {rendersProse && (
        <div className={styles.prose}>
          <h2>{t("sonucHeading")}</h2>
          <p>{t("sonucP1")}</p>
          <p>{t("sonucP2")}</p>
          <p>
            {t.rich("sonucP3", {
              ankara: (chunks) => provinceLink(ANKARA_PLATE, chunks),
              igdir: (chunks) => provinceLink(IGDIR_PLATE, chunks),
            })}
          </p>

          <p className={styles.sourceLine}>{t("kaynak")}</p>
        </div>
      )}
    </div>
  );
}
