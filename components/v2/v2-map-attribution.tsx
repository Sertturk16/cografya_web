"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * The credit line every V2 map surface carries, scoped to the layers it actually draws.
 *
 * ## Why one component and not eight copies
 *
 * The obligation travels WITH the material: a surface that draws a layer but not its credit is a
 * licence breach, and a surface that credits a source it does not draw claims something untrue.
 * V1 kept that honest by having ONE render site per layer; the V2 rewrite gave eight components
 * their own inline SVG maps, each importing the generated shapes directly, and the credit did not
 * come with them. Seven live surfaces drew JRC Global Surface Water and Natural Earth geometry
 * with no attribution at all, and the eighth (`V2ProvinceLocatorMap`) credited only OSM.
 *
 * `lib/map/tr-inland-water-jrc.test.ts` had guarded exactly this rule — against a HAND-WRITTEN
 * list of four V1 files. The list is why it did not fire: the eight V2 surfaces were never added
 * to it. That test now derives the surface list from the imports instead, so a ninth map cannot
 * be written without this component.
 *
 * ## The three sources
 *
 * - **Boundaries** — `tr-provinces.generated.ts` / `world-countries.generated.ts`, traced from
 *   OpenStreetMap. ODbL requires the credit.
 * - **Inland water** — `tr-inland-water.generated.ts`, which is OSM **plus** JRC Global Surface
 *   Water. The JRC half has its own required wording, published verbatim in English and marked
 *   `lang="en"` so a screen reader on the Turkish page does not read it with Turkish phonetics
 *   (WCAG 3.1.2), with the Turkish scope label beside it rather than instead of it.
 * - **Context** — `tr-context.generated.ts`, Natural Earth, public domain. Credited because the
 *   line states its scope; the other two lines would otherwise read as covering it too.
 *
 * `"use client"` because seven of the eight consumers are client components. The one server
 * component among them renders this as a client child, which is free — the strings are already
 * in the client bundle for the other seven.
 */
interface V2MapAttributionProps {
  /** The map draws OSM-derived province or country boundaries. */
  boundaries?: boolean;
  /** The map draws the JRC Global Surface Water inland-water layer. */
  inlandWater?: boolean;
  /** The map draws Natural Earth neighbouring-country context shapes. */
  context?: boolean;
  className?: string;
}

export function V2MapAttribution({
  boundaries = true,
  inlandWater = false,
  context = false,
  className,
}: V2MapAttributionProps) {
  const t = useTranslations("Map");

  return (
    <p
      className={cn(
        "flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {/* THE `{" "}` BETWEEN LINES IS LOAD-BEARING, AND IT IS NOT WHAT THE FLEX GAP DOES.
          `gap-x-2` separates the spans VISUALLY. It puts no character between them, so
          `textContent` — what a screen reader announces, what a copy-paste produces, what a
          crawler extracts — re-welds them into one run: "…ODbLMevsimlik göl sınırları:…". V1 hit
          exactly this with a `<br>` and `components/map/attribution-separation.test.ts` exists
          because of it; the first draft of THIS component reintroduced it with flex, and that
          same test caught it. Removing a separator renders identically on screen, which is what
          makes it worth a guard. */}
      {/* SCOPED, when there is anything to be scoped against (FEN121-I1). A bare
          "© OpenStreetMap katkıcıları, ODbL" standing beside "Mevsimlik göl sınırları: …" and
          "Komşu ülke sınırları: …" reads as covering those too — it claims OSM as the source of
          the JRC lakes and the Natural Earth countries. The label says which layer it is for.
          Alone on the line there is nothing to confuse it with, so it stays unlabelled. */}
      {boundaries && (
        <span>
          {(inlandWater || context) && `${t("attributionProvinceLabel")} `}
          {t("attribution")}
        </span>
      )}{" "}
      {inlandWater && (
        <span>
          {t("attributionJrcLabel")} <span lang="en">{t("attributionJrcEnglish")}</span>
        </span>
      )}{" "}
      {context && <span>{t("attributionContextLabel")}</span>}
    </p>
  );
}
