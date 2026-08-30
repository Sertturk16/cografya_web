import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
import { ToolMap } from "@/components/tools/tool-map";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { ProvinceListItem } from "@/lib/api/types";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { ContentSurface } from "@/lib/seo/indexing";
import { JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { buildProvincePoints } from "@/lib/tools/province-points";
import { DISTANCE_TOOL, TOOL_HUB_PATHNAME } from "@/lib/tools/tool-registry";
import styles from "../tools.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/** Same surface as the hub: TR indexable, `/en/tools/distance` `noindex, follow`. */
const TOOLS_SURFACE: ContentSurface = "trNarrative";

/**
 * The two provinces the prose names, by plaka kodu.
 *
 * The CODE is hardcoded and the SLUG is not, and the split is the point: `SEO-POLICY.md` §B4
 * 4.5 bans deriving a locale's slug by hand, so the URL is built from the api's own
 * `slugTr`/`slugEn`. A plaka kodu is a stable identifier, not a URL, and joining on it is the
 * pattern the neighbour blocks and the map already use.
 */
const ANKARA_PLATE = "06";
const KAYSERI_PLATE = "38";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Tools.mesafe" });

  return buildMetadata({
    locale,
    hrefForLocale: () => DISTANCE_TOOL.pathname,
    title: t("metaTitle"),
    description: t("metaDescription"),
    surface: TOOLS_SURFACE,
  });
}

/**
 * `/araclar/mesafe-olcme` ↔ `/en/tools/distance` — great-circle distance on the Türkiye map.
 *
 * ## The order is the doorway defence, and it is a BLOCKER-level requirement
 *
 * SPEC §4.3 fixes it: heading → explanatory text → tool → how to read the result → cross
 * links. A reader who arrives from a search and never touches the tool must still leave with
 * the answer to "what is kuş uçuşu mesafe and how does it differ from a road distance"
 * (`SEO-POLICY.md` §B12.2.a/.b). That is why the text is server-rendered prose rather than
 * something the island prints.
 *
 * ## Where the text comes from, and the one block that is NOT here
 *
 * `Owner's Inbox/cbs-p2/prose/arac-prose-draft.md` Rev.3 (NOVA), through an independent
 * fact-check (§B13 13.1). The road-distance block is the Rev.3 rewrite: it names the
 * DIRECTION of the difference and carries no kilometre figure, because the source that would
 * have supplied one is barred by `CONVENTIONS.md` §7 — KGM's own site terms read "Ticari
 * amaçla kullanılamaz." (→ Atlas ruling AK-32; the measurement is in `provenance/datasets.md`,
 * `2026-08-19 · KGM`). The visible source line names MEB only, because crediting a source a
 * page does not use is the mirror of failing to credit one it does.
 *
 * ## The 2026-08-30 editorial rewrite and the "Büyük daire" heading that disappeared
 *
 * `Owner's Inbox/araclar-editoryal-yenileme/plan.md` §5.2 is the source of the current prose:
 * an owner-flagged pass that cut AI-sounding padding and repeated ideas. The "Büyük daire" H2
 * (three paragraphs) was removed as a standalone section — its one load-bearing sentence, the
 * AK-30 honesty note that the drawn line is straight while the tool measures over the sphere,
 * now lives in `sonucP2` below, where it reads as "how to read the result" rather than a
 * geodesy lecture (AK-30 itself asks for "a short method note", not three paragraphs). The
 * "Harita ölçeği ve çizgi ölçek" section shrank from three paragraphs to one for the same
 * reason: the concept (a çizgi ölçek exists and recalculates on zoom) stays, the precision
 * mechanism behind it (the specific %4.3/%4.7 figures `lib/map/measure.ts` computes) does not
 * — that is implementation detail about how the tool's own scale bar works, not something a
 * reader needs to use the tool or understand kuş uçuşu mesafe.
 *
 * ## Rendering and the api read
 *
 * SSG with one api read — the province list, which supplies the picker's il-merkezi points
 * (AK-27 md.2) and the two cross-link slugs. `getProvincesResilient` degrades to `[]` at
 * BUILD (web CI has no api) and re-throws at RUNTIME, so a transient blip leaves the last
 * good static page in place instead of caching a page with no picker. Everything indexable is
 * in the first response either way: the prose, the map and the attribution do not depend on
 * the api at all.
 */
export default async function DistanceToolPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Tools.mesafe");
  const tHub = await getTranslations("Tools.hub");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: DISTANCE_TOOL.pathname });

  const provinces = await getProvincesResilient();
  const provincePoints = buildProvincePoints(provinces);

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
          learningResourceType: DISTANCE_TOOL.learningResourceType,
          teaches: t("teaches"),
        })}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("araclar"), href: TOOL_HUB_PATHNAME },
          { label: tHub("mesafeName"), href: DISTANCE_TOOL.pathname },
        ]}
      />

      <h1>{t("heading")}</h1>
      <EnWorkInProgressNotice locale={locale} />

      {rendersProse && (
        <div className={styles.prose}>
          <p className="lede">{t("lede")}</p>

          <h2>{t("nedirHeading")}</h2>
          <p>{t("nedirP1")}</p>
          <p>{t("nedirP2")}</p>

          <h2>{t("karayoluHeading")}</h2>
          <p>
            {t.rich("karayoluP1", {
              ankara: (chunks) => provinceLink(ANKARA_PLATE, chunks),
              kayseri: (chunks) => provinceLink(KAYSERI_PLATE, chunks),
            })}
          </p>
          <p>{t("karayoluP2")}</p>

          <h2>{t("olcekHeading")}</h2>
          <p>{t("olcekP1")}</p>
        </div>
      )}

      <section className={styles.toolSection} aria-labelledby="tool-heading">
        <h2 id="tool-heading">{t("toolHeading")}</h2>
        <ToolMap
          locale={locale}
          mode="distance"
          provincePoints={provincePoints}
          downloadName="cografya-mesafe"
        />
      </section>

      {rendersProse && (
        <div className={styles.prose}>
          <h2>{t("sonucHeading")}</h2>
          <p>{t("sonucP1")}</p>
          <p>{t("sonucP2")}</p>
          <p>{t("sonucP3")}</p>

          <p className={styles.sourceLine}>{t("kaynak")}</p>
        </div>
      )}
    </div>
  );
}
