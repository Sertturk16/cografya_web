"use client";

import { useTranslations } from "next-intl";
import { OSM_COPYRIGHT_URL } from "@/lib/map/osm-credit";
import { SOURCE_NOTE } from "@/components/patterns/source-note";
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
 * - **World** — `world-countries.generated.ts`, Natural Earth again, and a SEPARATE line from
 *   `context` because the two are different claims: `context` says "neighbouring-country
 *   boundaries", which is what a map of Türkiye draws around its subject, and saying that on a
 *   map of the whole world would be false. Public domain, so this one is not a licence
 *   obligation — but the rule in this repo covers a source the surface uses, and three surfaces
 *   were drawing 199 country polygons with nothing naming where they came from. One of them,
 *   `V2ContinentLocatorMap`, printed "Projeksiyon: Natural Earth 1", which names a PROJECTION
 *   and reads like a source without being one.
 *
 * `"use client"` because seven of the eight consumers are client components. The one server
 * component among them renders this as a client child, which is free — the strings are already
 * in the client bundle for the other seven.
 */
interface MapAttributionProps {
  /** The map draws OSM-derived province or country boundaries. */
  boundaries?: boolean;
  /** The map draws the JRC Global Surface Water inland-water layer. */
  inlandWater?: boolean;
  /** The map draws Natural Earth neighbouring-country context shapes. */
  context?: boolean;
  /** The map draws the Natural Earth world-country layer (`COUNTRY_SHAPES`). */
  world?: boolean;
  className?: string;
}

export function MapAttribution({
  boundaries = true,
  inlandWater = false,
  context = false,
  world = false,
  className,
}: MapAttributionProps) {
  const t = useTranslations("Map");

  return (
    <p
      className={cn(
        // `m-0` IS A RESET, not spacing. `app/globals.css` gives every `<p>` a `0 0 1rem` prose
        // margin, and this element is the last child on five of its surfaces — where Tailwind's
        // `space-y-*` writes no margin at all, since it targets `:not(:last-child)`. So the
        // credit carried a 16px prose tail that belonged to body copy, invisible only while the
        // element was clipped inside the map box. The caption's own gap is set by the wrapper
        // that pairs it with its map, never from in here.
        //
        // `gap-x-4`, not `gap-x-2`: at desktop width the three clauses sit on ONE line, and 8px
        // is 2.8 space-widths at this size — a reader scanning "…ODbL Mevsimlik göl sınırları:…"
        // meets no boundary until the next colon arrives. This was hidden while the credit was
        // squeezed to half a plate and therefore always wrapped. A `::before` separator glyph
        // would read better still and is exactly what the `{" "}` note below forbids: it would
        // separate the clauses on screen while leaving `textContent` welded.
        //
        // `leading-snug`, not `leading-relaxed`: 1.625 is a body-prose leading, and at 320px this
        // footnote wraps to five lines and stands 93px tall under a 105px map on `/deprem`.
        //
        // The scale itself (`m-0`, 11px, snug, muted, underlined links) is `SOURCE_NOTE`, which
        // every other source line on the site now shares; only the flex row is this one's own.
        SOURCE_NOTE,
        "flex flex-wrap gap-x-4 gap-y-0.5",
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
          {(inlandWater || context || world) && `${t("attributionProvinceLabel")} `}
          {/* THE CREDIT IS A LINK, because ODbL asks for one in an interactive medium and this
              line was plain text on all ten surfaces. The href is OSM's own copyright page,
              which is the target its guidance names and which explains ODbL — so one link does
              the whole job and a second one on "ODbL" would only add noise to an 11px footnote.
              Same tab, no `target="_blank"`: that is what Leaflet's own attribution control does,
              it keeps the back button meaningful, and it avoids an unannounced new window.

              `underline` IS EXPLICIT, and it is the accessibility half of this change. Tailwind's
              preflight resets `text-decoration` on anchors, so `globals.css`'s `a` rule was
              setting a thickness for an underline that was never drawn. Measured on `/deprem`:
              the link clears its background comfortably (8.36:1 light, 8.20:1 dark) but sits at
              **1.05:1 against the muted text around it** — nowhere near the 3:1 that would let
              hue alone carry it, which is WCAG 1.4.1. The underline is the non-colour cue that
              makes it a link; it lifts on hover, this repo's usual direction. */}
          {t.rich("attribution", {
            osm: (chunks) => (
              <a href={OSM_COPYRIGHT_URL} className="underline hover:no-underline">
                {chunks}
              </a>
            ),
          })}
        </span>
      )}{" "}
      {inlandWater && (
        <span>
          {t("attributionJrcLabel")} <span lang="en">{t("attributionJrcEnglish")}</span>
        </span>
      )}{" "}
      {context && <span>{t("attributionContextLabel")}</span>}{" "}
      {world && <span>{t("attributionWorldLabel")}</span>}
    </p>
  );
}
