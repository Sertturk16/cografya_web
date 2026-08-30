import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
import { ToolMap } from "@/components/tools/tool-map";
import { getProvincesResilient } from "@/lib/api/provinces";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { ContentSurface } from "@/lib/seo/indexing";
import { JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { buildProvincePoints } from "@/lib/tools/province-points";
import {
  AREA_TOOL,
  COORDINATE_TOOL,
  DISTANCE_TOOL,
  TOOL_HUB_PATHNAME,
} from "@/lib/tools/tool-registry";
import styles from "../tools.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/** Same surface as the hub: TR indexable, `/en/tools/distance` `noindex, follow`. */
const TOOLS_SURFACE: ContentSurface = "trNarrative";

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
 * `SEO-POLICY.md` §B12.2.a/.b (doorway abuse) is the live rule this order defends against: a
 * reader who arrives from a search and never touches the tool must still leave with the answer
 * to "what is kuş uçuşu mesafe and how does it differ from a road distance" ON THIS PAGE. The
 * shape — heading → explanatory text → tool → how to read the result → cross links — is fixed
 * by that rule, not by a plan file; an earlier version of this note cited a `cbs-p2/SPEC.md`
 * §4.3 that no longer exists on disk (`Owner's Inbox/araclar-production-ready/SPEC.md` §9 item 3
 * records the same finding for all three tool pages and is why this citation moved). That is
 * why the text is server-rendered prose rather than something the island prints.
 *
 * ## Where the text comes from, and the one block that is NOT here
 *
 * The prose was drafted by NOVA and independently fact-checked (`SEO-POLICY.md` §B13 13.1); the
 * road-distance block names the DIRECTION of the difference and carries no kilometre figure,
 * because the source that would have supplied one is barred by `CONVENTIONS.md` §7 — KGM's own
 * site terms read "Ticari amaçla kullanılamaz." (→ Atlas ruling AK-32; the measurement is in
 * `provenance/datasets.md`, `2026-08-19 · KGM`). The visible source line names MEB only, because
 * crediting a source a page does not use is the mirror of failing to credit one it does.
 *
 * ## Two editorial passes, and what each one did
 *
 * The first pass (`Owner's Inbox/araclar-editoryal-yenileme/plan.md` §5.2) cut AI-sounding
 * padding and repeated ideas: the "Büyük daire" H2 (three paragraphs) was removed as a
 * standalone section — its one load-bearing sentence, the AK-30 honesty note that the drawn
 * line is straight while the tool measures over the sphere, moved into `sonucP2` below, where
 * it reads as "how to read the result" rather than a geodesy lecture. The "Harita ölçeği ve
 * çizgi ölçek" section shrank from three paragraphs to one in that pass.
 *
 * The second pass (`Owner's Inbox/araclar-production-ready/SPEC.md` §5.2, this one) went
 * further: measured against `phase0-research.md`'s Tier 1 depth test ("does this sentence help
 * the student use the tool or read its output"), the harita-ölçeği section failed it outright —
 * a çizgi ölçek exists and recalculates on zoom (`Tools.ui.scaleBar` says so on the map itself),
 * but kesir-ölçek-vs-çizgi-ölçek is Tier 2 curriculum content, not a Tier 1 prerequisite. The
 * whole `olcekHeading`/`olcekP1` section is now REMOVED, not shrunk, and `teaches` was edited to
 * match (`SEO-POLICY.md` §B5's teaches-names-the-prose row). `lede`, the road-distance block and
 * `sonucP1`/`sonucP3` were rewritten for register — natural voice over textbook framing, same
 * facts, no new claim (SPEC §8 P1). A "Diğer araçlar" related-links row was added at the end of
 * the page (`ENGINEERING.md` §4 #10, `SEO-POLICY.md` §B8 8.5): before this pass the breadcrumb
 * was the only way off the page.
 *
 * A third, narrower owner cut (2026-08-30) removed `sonucP1` outright — its zoom-rounding note
 * was the tool's own internal behaviour, not a geography fact — leaving `sonucP2`/`sonucP3` as
 * the section's opening paragraphs.
 *
 * ## Rendering and the api read
 *
 * SSG with one api read — the province list, which supplies the picker's il-merkezi points
 * (AK-27 md.2). The prose no longer names Ankara/Kayseri as province cross-links (owner
 * content edit, 2026-08-30) — `provinceLink` was removed with them. `getProvincesResilient`
 * degrades to `[]` at BUILD (web CI has no api) and re-throws at RUNTIME, so a transient blip
 * leaves the last good static page in place instead of caching a page with no picker.
 * Everything indexable is in the first response either way: the prose, the map and the
 * attribution do not depend on the api at all.
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
          <p>{t("karayoluP1")}</p>
          <p>{t("karayoluP2")}</p>
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
        <div className={`${styles.prose} ${styles.proseAfterTool}`}>
          <h2>{t("sonucHeading")}</h2>
          <p>{t("sonucP2")}</p>
          <p>{t("sonucP3")}</p>

          <p className={styles.sourceLine}>{t("kaynak")}</p>
        </div>
      )}

      {/* "Diğer araçlar" — closes the exit this page was missing (`ENGINEERING.md` §4 #10,
          `SEO-POLICY.md` §B8 8.5). Renders on both locales: the labels are already bilingual
          (`Tools.hub.*Name`, `Breadcrumb.araclar`), and the EN tool page was as much a dead end
          as the TR one. */}
      <section className="section">
        <h2>{tHub("otherToolsHeading")}</h2>
        <ul role="list" className={styles.relatedList}>
          <li>
            <Link href={COORDINATE_TOOL.pathname}>{tHub("koordinatName")}</Link>
          </li>
          <li>
            <Link href={AREA_TOOL.pathname}>{tHub("alanName")}</Link>
          </li>
          <li>
            <Link href={TOOL_HUB_PATHNAME}>{tb("araclar")}</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
