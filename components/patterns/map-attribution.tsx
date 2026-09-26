"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
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
  /**
   * The map is fullscreen (`useLandscapeMode().active`): the credit starts open and shrinks to an
   * ⓘ button (see `FullscreenCredit`), positioned over the bottom-right corner of the nearest
   * positioned ancestor, so the surface's `<figure>` must be `relative`.
   */
  fullscreen?: boolean;
  className?: string;
}

/** How long the fullscreen credit stays open before shrinking to its ⓘ (OSMF guidelines: 5 s). */
export const CREDIT_AUTO_COLLAPSE_MS = 5000;

/** The events that count as "using the map" for the fullscreen credit's first-interaction collapse. */
const INTERACTION_EVENTS = ["pointerdown", "wheel", "keydown"] as const;

/**
 * Whether an event shrinks the open fullscreen credit. Pure so the rule is testable without a DOM.
 * Anything inside the credit is someone reading or following it, and Tab (or a bare modifier) is
 * someone moving focus, possibly TO the credit, not using the map.
 */
export function collapsesCredit(event: {
  type: string;
  key?: string;
  insideCredit: boolean;
}): boolean {
  if (event.insideCredit) return false;
  if (event.type !== "keydown") return true;
  return !["Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key ?? "");
}

export function MapAttribution({
  boundaries = true,
  inlandWater = false,
  context = false,
  world = false,
  fullscreen = false,
  className,
}: MapAttributionProps) {
  const t = useTranslations("Map");

  const lines = (
    <>
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
    </>
  );

  if (fullscreen) return <FullscreenCredit>{lines}</FullscreenCredit>;

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
        // would read better still and is exactly what the `{" "}` note in `lines` forbids: it would
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
      {lines}
    </p>
  );
}

/**
 * The fullscreen credit: open on entry, then an ⓘ button (T-117).
 *
 * The OSMF Attribution Guidelines accept, for an interactive map, a credit that hides on the
 * first interaction or after 5 seconds as long as it stays reachable behind an "(i)" button; the
 * JRC wording rides along because it is the same credit. Mounted fresh by every fullscreen entry
 * (the surface passes `fullscreen={landscape.active}`, and leaving fullscreen unmounts this), so
 * each session starts open without an effect resetting state.
 *
 * The auto-collapse fires once. After that the reader owns it: ⓘ opens it and it stays open until
 * ⓘ closes it again, as Leaflet's and MapLibre's compact attribution controls do.
 *
 * Placed over the bottom-right corner of the map, the one corner no fullscreen surface uses
 * (fullscreen toggle top-left, zoom top-right, scale bar bottom-left). It is `absolute` against the
 * surface's `relative` `<figure>`, so the `<figcaption>` stays where it is in the JSX, under the map
 * (`v2-map-credit-placement.test.ts` still holds), collapses to zero height, and the map takes the
 * strip the page-view credit needs. `z-30`, the scale bar's own layer, and later in the DOM than the
 * plate that holds it: at 360 px and 740x360 the open panel reaches the bottom-left corner, and
 * under the scale bar it lost a line of the credit. The rotate-device hint sits one layer higher.
 *
 * `hidden`, not unmounted, while collapsed, so `aria-controls` always names an element; Tailwind's
 * preflight gives `[hidden]` `display: none !important`, which outranks the `flex` row class.
 */
function FullscreenCredit({ children }: { children: ReactNode }) {
  const t = useTranslations("Map");
  const [open, setOpen] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const armedRef = useRef(true);
  const panelId = useId();

  useEffect(() => {
    const root = rootRef.current;
    const collapse = () => {
      if (!armedRef.current) return;
      armedRef.current = false;
      setOpen(false);
    };
    // Not while focus is inside: the timer must not pull the panel out from under someone who has
    // tabbed to the OSM link.
    const timer = window.setTimeout(() => {
      if (!root?.contains(document.activeElement)) collapse();
    }, CREDIT_AUTO_COLLAPSE_MS);
    const onInteraction = (event: Event) => {
      const insideCredit = event.target instanceof Node && Boolean(root?.contains(event.target));
      const key = event instanceof KeyboardEvent ? event.key : undefined;
      if (collapsesCredit({ type: event.type, key, insideCredit })) collapse();
    };
    // Capture on the document: the map's own pan and pinch handlers see the press first otherwise,
    // and in fullscreen the fullscreen target is the whole document anyone can press on.
    for (const type of INTERACTION_EVENTS) {
      document.addEventListener(type, onInteraction, { capture: true, passive: true });
    }
    return () => {
      window.clearTimeout(timer);
      for (const type of INTERACTION_EVENTS) {
        document.removeEventListener(type, onInteraction, { capture: true });
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="absolute right-3 bottom-3 z-30 flex max-w-[min(40rem,calc(100%-1.5rem))] items-end justify-end gap-1.5"
    >
      <p
        id={panelId}
        hidden={!open}
        className={cn(
          SOURCE_NOTE,
          "flex flex-wrap gap-x-4 gap-y-0.5 rounded-xl border border-border/80 bg-card/90 px-2.5 py-1.5 shadow-md backdrop-blur-md",
        )}
      >
        {children}
      </p>
      <button
        type="button"
        onClick={() => {
          armedRef.current = false;
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("attributionToggle")}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/80 bg-card/90 text-foreground shadow-md backdrop-blur-md transition-colors hover:bg-muted"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
