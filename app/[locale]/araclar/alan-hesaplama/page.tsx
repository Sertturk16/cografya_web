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

/** Same surface as the rest of the tier: TR indexable, `/en/tools/area` `noindex, follow`. */
const TOOLS_SURFACE: ContentSurface = "trNarrative";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Tools.alan" });

  return buildMetadata({
    locale,
    hrefForLocale: () => AREA_TOOL.pathname,
    title: t("metaTitle"),
    description: t("metaDescription"),
    surface: TOOLS_SURFACE,
  });
}

/**
 * `/araclar/alan-hesaplama` ↔ `/en/tools/area` — area and perimeter of a polygon drawn on the
 * map of Türkiye, and the third and last of Faz-1's tools.
 *
 * ## The order is the doorway defence, and it is a BLOCKER-level requirement
 *
 * `SEO-POLICY.md` §B12.2.a/.b (doorway abuse) is the live rule this order defends against: a
 * reader who arrives from a search and never touches the tool must still leave with the answer
 * to "why is a drawn area not a province's yüzölçümü, and why is it computed on a sphere" ON
 * THIS PAGE — both answers are still fully present, in the first server-rendered HTML response,
 * below the tool. An earlier version of this note cited a `cbs-p2/SPEC.md` §4.3 that no longer
 * exists on disk (`Owner's Inbox/araclar-production-ready/SPEC.md` §9 item 3 records the same
 * finding for all three tool pages and is why this citation moved). That is why the text is
 * server-rendered prose rather than something the island prints.
 *
 * ## Where the text comes from
 *
 * The prose was drafted by NOVA and independently fact-checked (`SEO-POLICY.md` §B13 13.1).
 * The HGM source's OWN methodology caveat — 2014, 1:1.000.000, "resmî nitelik taşımaz" — is
 * `provenance/datasets.md`'s (→ legacy §1.2) wording; it now lives in the `kaynak` source line
 * only (owner content edit, 2026-08-30, dropped the dedicated caveat paragraph the prose used
 * to carry) and is transcribed byte-identically there, never paraphrased.
 *
 * ## The projection-theory cut, and why the HGM block moved below the tool
 *
 * `Owner's Inbox/araclar-production-ready/SPEC.md` §5.4: measured at 1789 characters / 7
 * paragraphs before the tool, this was the second-worst page in the section, and it carried the
 * one thing the owner's brief names by name as a cut candidate — unnecessary projection theory.
 * The whole `kureHeading`/`kureP1` section (projection theory: which map property survives the
 * projection) was REMOVED outright, not trimmed — a lise student does not need Coğrafya 9's
 * projection unit to trust a square-kilometre number. `kureP2`'s point (the tool measures on the
 * sphere, not in pixels) is still needed to TRUST the number, so it moved below the tool, right
 * where the number appears, with its "Araç bu yüzden…" opener rebuilt because it referred to the
 * now-deleted `kureP1`. The `yuzolcumu*` block (the HGM comparison) moved with it: "why isn't my
 * number the province's official area" is a post-result question. `teaches` was edited to match
 * — it no longer names projection area-preservation, because the prose no longer teaches it
 * (`SEO-POLICY.md` §B5's teaches-names-the-prose row). A "Diğer araçlar" related-links row was
 * added at the end of the page (`ENGINEERING.md` §4 #10, `SEO-POLICY.md` §B8 8.5): before this
 * pass the breadcrumb was the only way off the page. **`sinirP2` was reintroduced 2026-08-30**
 * with unrelated content (a bay/coastline worked example) — the key name is reused, not the
 * paper-plan paragraph this note used to describe.
 *
 * A further owner cut (2026-08-30, same day): `kureP2`'s "Araç, ekranda çizdiğiniz şeklin piksel
 * alanını ölçmez" opener was itself removed — another tool-internal-behaviour sentence, not a
 * geography fact — leaving the paragraph's küresel-hesap sentence to open it instead. The whole
 * `yuzolcumuHeading`/`yuzolcumuP1`–`P3` subsection (the İl-yüzölçümü comparison, including the
 * İstanbul/Ankara figures) was cut outright: `sinirHeading`'s point-count paragraph already makes
 * the same point more naturally, so this was a repeat. The `kaynak` source line stayed.
 *
 * ## Rendering and the api read
 *
 * SSG with one api read — the province list, which supplies the picker's il-merkezi points
 * (AK-27 md.2). The prose no longer names İstanbul/Ankara as province cross-links (owner content
 * edit, 2026-08-30) — `provinceLink` was removed with them. This page does NOT ask for
 * `provinceAreas`: naming which province a point fell inside is the coordinate tool's answer
 * to its own question, and a ring of three points is not inside one province anyway.
 * `getProvincesResilient` degrades to `[]` at BUILD (web CI has no api) and re-throws at
 * RUNTIME, so a transient blip leaves the last good static page in place. Everything indexable
 * is in the first response either way: the prose, the map and the attribution do not depend on
 * the api at all.
 */
export default async function AreaToolPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Tools.alan");
  const tHub = await getTranslations("Tools.hub");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: AREA_TOOL.pathname });

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
          learningResourceType: AREA_TOOL.learningResourceType,
          teaches: t("teaches"),
        })}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("araclar"), href: TOOL_HUB_PATHNAME },
          { label: tHub("alanName"), href: AREA_TOOL.pathname },
        ]}
      />

      <h1>{t("heading")}</h1>
      <EnWorkInProgressNotice locale={locale} />

      {rendersProse && (
        <div className={styles.prose}>
          <p className="lede">{t("lede")}</p>

          <h2>{t("sinirHeading")}</h2>
          <p>{t("sinirP1")}</p>
          <p>{t("sinirP2")}</p>
        </div>
      )}

      <section className={styles.toolSection} aria-labelledby="tool-heading">
        <h2 id="tool-heading">{t("toolHeading")}</h2>
        <ToolMap
          locale={locale}
          mode="area"
          provincePoints={provincePoints}
          downloadName="cografya-alan"
        />
      </section>

      {rendersProse && (
        <div className={`${styles.prose} ${styles.proseAfterTool}`}>
          <h2>{t("sonucHeading")}</h2>
          <p>{t("kureP2")}</p>
          <p>{t("sonucP1")}</p>
          <p>{t("sonucP2")}</p>

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
            <Link href={DISTANCE_TOOL.pathname}>{tHub("mesafeName")}</Link>
          </li>
          <li>
            <Link href={COORDINATE_TOOL.pathname}>{tHub("koordinatName")}</Link>
          </li>
          <li>
            <Link href={TOOL_HUB_PATHNAME}>{tb("araclar")}</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
