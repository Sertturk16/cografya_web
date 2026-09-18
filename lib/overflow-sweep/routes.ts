/**
 * The horizontal-overflow sweep's plan: which routes, which viewports, which themes.
 *
 * Why this file exists at all, and why it is not just a list inside the script:
 *
 * Every tripwire this programme has built so far counts SOURCE TEXT. Those caught a great
 * deal and they cannot catch the defect class that keeps recurring, because that class is
 * not in the JSX tree at any depth:
 *
 *   - the mandated ECMWF licence notice overflowing at 320px (T-038) — a text node with no
 *     wrapping opportunity;
 *   - `/turkiye/istanbul` scrolling 36px sideways at 320 because `climate.module.css`'s
 *     `.chartFrame` carried a bare `min-width: 300px` (T-046) — a CSS-Module declaration;
 *   - `v2-sources-section.tsx`'s `shrink-0` badge row overflowing on 7 region routes
 *     (introduced and fixed inside T-046) — a flex child's shrink behaviour.
 *
 * All three were found the same way: `document.documentElement.scrollWidth` compared with
 * `clientWidth` in a real browser. `scripts/sweep-overflow.mjs` is that comparison; this
 * module is the part of it that can be unit-tested without a browser, so a routing rename
 * or a new CSS Module turns the vitest suite red instead of quietly shrinking the sweep.
 *
 * ROUTE SELECTION — two rules, both checked by `routes.test.ts`:
 *
 * 1. Every `pathname` here must be a live key of `routing.pathnames`. The list is derived
 *    from the routing table rather than hand-written as URLs, so renaming a segment (the
 *    `/turkey` → `/turkiye` correction in T-032 is the precedent) cannot leave the sweep
 *    silently pointing at 404s that measure as "no overflow".
 * 2. Every surviving `*.module.css` must be named by at least one route's `modules`. Two of
 *    the three recorded defects were CSS-Module declarations, so the modules are the part of
 *    the tree the sweep must not lose coverage of. A new module with no route here fails
 *    `routes.test.ts`, which is the moment someone still remembers which page renders it.
 *
 * It is deliberately a set of SHAPES, not of instances: 992 routes exist, and the 81
 * province pages are one page with 81 datasets. What differs between them is content
 * length, which is why the longest-named province rather than a random one is the entry.
 */

/** A locale the sweep can visit. Mirrors `routing.locales` without importing it. */
export type SweepLocale = "tr" | "en";

export type SweepShape = {
  /** Stable id used in report lines and JSON keys. */
  readonly id: string;
  /** A key of `routing.pathnames`. Validated against the real table by `routes.test.ts`. */
  readonly pathname: string;
  /** Values for the `[param]` holes in the pathname template. */
  readonly params?: Readonly<Record<string, string>>;
  /** Locales to visit. TR-only unless the EN page composes DIFFERENT blocks. */
  readonly locales: readonly SweepLocale[];
  /** `*.module.css` basenames this route renders. Drives the coverage test. */
  readonly modules: readonly string[];
  /** Why this shape is in the list. Asserted non-empty. */
  readonly why: string;
};

export const SWEEP_SHAPES: readonly SweepShape[] = [
  {
    id: "home",
    pathname: "/",
    locales: ["tr", "en"],
    modules: ["site-search.module.css", "marine.module.css"],
    why:
      "The homepage: the densest single composition on the site (hero, live ticker, card " +
      "grids). It claimed `home.module.css` too, and that claim was the clearest thing this " +
      "map got wrong — the stylesheet's only importer was `components/home/featured-cards.tsx`, " +
      "a component the homepage stopped rendering when it took the card grids inline, so the " +
      "route reached the file through nothing. T-042 deleted both. Both locales — every string " +
      "on it is translated, and TR and EN copy differ in length on the same fixed-width cards. " +
      "`marine.module.css` is listed here because `VintageLine` renders it on this page; the " +
      "`/deniz` routes used to claim it and never imported it. Flag-gated (`MARINE_ENABLED`), " +
      "so the measurement is real only on a render where the marine block appears — which is " +
      "still strictly more coverage than the route that never loaded the file.",
  },
  {
    id: "about",
    pathname: "/hakkimizda",
    locales: ["tr"],
    modules: [],
    why:
      "The plain-prose shape: long paragraphs, no data widget, no map. It is the control " +
      "case — if this one overflows, the fault is in the shared `(site)` container rather " +
      "than in any page's own CSS.",
  },
  {
    id: "turkiye-hub",
    pathname: "/turkiye",
    locales: ["tr"],
    modules: [],
    why:
      "A hub whose main element is a fixed-`viewBox` SVG map inside a responsive frame. " +
      "SVG-in-a-box is its own overflow shape: the frame scales, the legend and the province " +
      "list beside it do not.",
  },
  {
    id: "province",
    pathname: "/turkiye/[slug]",
    params: { slug: "istanbul" },
    locales: ["tr", "en"],
    modules: [
      "climate.module.css",
      "air-pollution.module.css",
      "locator-map.module.css",
      "marine.module.css",
    ],
    why:
      "The detail page with the climate table, and the recorded scene of two of the three " +
      "defects this sweep exists for (T-038's licence notice, T-046's `.chartFrame` " +
      "`min-width`). It renders FOUR of the eight CSS Modules — `marine.module.css` among them, " +
      "through `ProvinceMarineSection`, which is where that stylesheet actually reaches a " +
      "swept route rather than on `/deniz`. Both locales: the EN column headers of the " +
      "climate table are materially longer than the TR ones.",
  },
  {
    id: "region-index",
    pathname: "/turkiye/bolge",
    locales: ["tr"],
    modules: [],
    why: "The index-of-cards shape: a grid that has to collapse to one column by 320px.",
  },
  {
    id: "region",
    pathname: "/turkiye/bolge/[slug]",
    params: { slug: "marmara" },
    locales: ["tr"],
    modules: [],
    why:
      "The region detail. `v2-sources-section.tsx`'s `shrink-0` badge row overflowed on all " +
      "seven of these routes inside T-046 — a flex child's shrink behaviour, invisible to " +
      "every source-text scanner in the suite.",
  },
  {
    id: "dunya-hub",
    pathname: "/dunya",
    locales: ["tr"],
    modules: [],
    why:
      "The world hub: a second, differently-built map surface (zoom/pan, its own projection " +
      "and its own controls). `/turkiye` does not cover it — they share no component.",
  },
  {
    id: "country",
    pathname: "/dunya/[slug]",
    params: { slug: "almanya" },
    locales: ["tr"],
    modules: ["locator-map.module.css"],
    why:
      "The country detail: metric strips, a flag and comparison tables — the numeric-table " +
      "shape, which is the one most likely to refuse to wrap.",
  },
  {
    id: "continent",
    pathname: "/dunya/kita/[slug]",
    params: { slug: "avrupa" },
    locales: ["tr"],
    modules: [],
    why:
      "The continent detail: a long country grid whose tiles carry country names of wildly " +
      "different lengths at a fixed tile width.",
  },
  {
    id: "sea",
    pathname: "/deniz/karadeniz",
    locales: ["tr", "en"],
    modules: [],
    why:
      "The mandated ECMWF/Copernicus licence notice — the T-038 defect verbatim: a legally " +
      "required, unshortenable string that must fit at 320px. Both locales: the EN page drops " +
      "the TR-only explainer blocks, so it is a different composition rather than a " +
      "translation of this one. " +
      "NO `marine.module.css`: this entry claimed it and never rendered it. Its only importers " +
      "are `components/marine/{vintage-line,value-cell,direction-arrow,province-marine-" +
      "section}.tsx`, and the import chain reaches exactly two routes — `/` (VintageLine) and " +
      "`/turkiye/[slug]` (ProvinceMarineSection). The claim moved to those two entries, where " +
      "the stylesheet is actually on the page.",
  },
  {
    id: "sea-hub",
    pathname: "/deniz",
    locales: ["tr"],
    modules: [],
    why:
      "The FAQ ACCORDION, which `/deniz/karadeniz` does not have. T-035 PR5 moved this block " +
      'onto `FaqSection`\'s `mechanism="accordion"`, and an accordion trigger is the one FAQ ' +
      "shape with a horizontal budget: an unbroken Turkish question and a chevron on one row, " +
      "inside a button that must still fit at 320. The `sea` route ABOVE measures the licence " +
      "notice, which does not reach this page's accordion. Neither route measures " +
      "`marine.module.css`: no `deniz` route imports it — the claim moved to `home` and " +
      "`province`, which do. `tr` only — the block is gated to Turkish because " +
      "`messages/en.json` has no `Deniz.q*`, so an EN visit would measure a page with no FAQ " +
      "on it at all.",
  },
  {
    id: "earthquake",
    pathname: "/deprem",
    locales: ["tr"],
    modules: ["earthquake.module.css"],
    why:
      "`earthquake.module.css`: a live AFAD list whose rows carry magnitude, depth, time and " +
      "a place name of unbounded length. The only route where the content width is decided " +
      "by upstream data rather than by the repo.",
  },
  {
    id: "book",
    pathname: "/kitaplar/[slug]",
    params: { slug: "ayt-cografya-konu-ozetli-brans-denemeleri" },
    locales: ["tr", "en"],
    modules: ["book-detail.module.css", "book-video.module.css"],
    why:
      "The book detail: two CSS Modules, including the embedded-video aspect box — a " +
      "fixed-ratio iframe is the classic 320px overflow. Both locales: the EN twin is a " +
      "permanent `noindex` page with its own reduced composition.",
  },
  {
    id: "tool",
    pathname: "/araclar/mesafe-olcme",
    locales: ["tr", "en"],
    modules: [],
    why:
      "An interactive map tool that wants all the width it can get, inside site chrome that " +
      "will not give it any. It claimed `tools.module.css` until T-042 deleted that file with " +
      "the four dead components that imported it; the live workbench is Tailwind throughout, so " +
      "the route is swept for its SHAPE rather than for a stylesheet. Both locales: the EN twin " +
      "omits the narrative blocks, leaving the tool panel alone on the page.",
  },
  {
    id: "game",
    pathname: "/oyun/81-il",
    locales: ["tr"],
    modules: [],
    why:
      "The `(play)` group — the only pages on the site that opt out of the `(site)` layout " +
      "and its single padded `<main>`. Whatever the shared container guarantees, it does not " +
      "guarantee it here, so the fullscreen game screen has to be measured separately.",
  },
  {
    id: "auth",
    pathname: "/giris",
    locales: ["tr"],
    modules: [],
    why:
      "The auth shape: a narrow centred card with form controls. Inputs and buttons carry " +
      "intrinsic minimum widths that no amount of container padding can shrink.",
  },
  {
    id: "design-system",
    pathname: "/design-system",
    locales: ["tr"],
    modules: [],
    why:
      "The gallery index, which lives outside both `(site)` and `(play)` and therefore under " +
      "no shared container at all.",
  },
  {
    id: "design-system-category",
    pathname: "/design-system/[category]",
    params: { category: "duzen" },
    locales: ["tr"],
    modules: [],
    why:
      "Where the primitives actually render, several to a row, at every size they ship in. " +
      "`/design-system` alone is a list of links and proves nothing about the components. " +
      "`duzen` rather than `veri` since T-035 PR5: the accordion and the `FaqSection` specimens " +
      "live in the layout category, and a FAQ block's overflow risk is a long unbroken question " +
      "on one row — exactly what a specimen page renders at every width without needing the API.",
  },
];

export type SweepViewport = {
  readonly name: string;
  readonly width: number;
  readonly height: number;
};

/**
 * 320 is the floor the repo commits to (`CLAUDE.md`: "check 320, 360, 390 px and desktop").
 * 360 and 390 are the two commonest real phone widths and are NOT redundant with 320: a
 * `min-width: 300px` inside a 320-wide column overflows while the same rule at 360 does not,
 * and a two-column grid that survives 320 by collapsing can still break at 390 where it does
 * not collapse. 1440 is the desktop check.
 *
 * 768 CLOSES THE WIDEST PART OF A 1050px BLIND BAND. With only 320/360/390/1440, a review
 * demonstrated that `md:min-w-[900px] lg:min-w-0` passes all eight checks: it is inactive
 * below 768 and harmless at 1440, so nothing measured it where it bites. Every one of
 * Tailwind's four used breakpoints sits inside that band — `sm:` 640 (608 utilities in this
 * repo), `md:` 768 (61), `lg:` 1024 (119), `xl:` 1280 (6).
 *
 * One width at 768 catches more than its own breakpoint, because a breakpoint-scoped utility
 * is active at every width AT OR ABOVE it: any `sm:`- or `md:`-scoped fixed width wider than
 * 768 now overflows a swept viewport. What remains is two narrower bands, and they are worth
 * naming rather than leaving as "the gap":
 *   - 390–768, which holds a width active ONLY in [640, 768) — an `sm:` rule cancelled at
 *     `md:` — and wider than the viewport it lives on;
 *   - 768–1440, which holds a `lg:`- or `xl:`-scoped width that exceeds 1024 or 1280 but
 *     still fits 1440.
 * Closing either costs another 44 checks and ~10s; neither has a recorded defect behind it
 * yet, which is the only reason they are still open.
 */
export const SWEEP_VIEWPORTS: readonly SweepViewport[] = [
  { name: "320", width: 320, height: 900 },
  { name: "360", width: 360, height: 900 },
  { name: "390", width: 390, height: 900 },
  { name: "768", width: 768, height: 1000 },
  { name: "desktop", width: 1440, height: 1000 },
];

/**
 * Both themes. Not theatre: `marine-attribution.module.css` shipped a mandated licence
 * notice at 2.34:1 in dark mode for a full round, and the dark palette can change a border,
 * a shadow spread or a badge's padding — all of which are width.
 */
export const SWEEP_THEMES = ["light", "dark"] as const;

export type SweepTheme = (typeof SWEEP_THEMES)[number];

/** Shape of `routing.pathnames` as far as this module needs to read it. */
export type PathnameTable = Readonly<Record<string, string | Readonly<Record<string, string>>>>;

export type SweepUrl = {
  readonly id: string;
  readonly shape: SweepShape;
  readonly locale: SweepLocale;
  /** Root-relative URL, e.g. `/turkiye/istanbul` or `/en/sea/black-sea`. */
  readonly url: string;
};

/** The default locale is unprefixed (`localePrefix: "as-needed"` in `i18n/routing.ts`). */
const DEFAULT_LOCALE: SweepLocale = "tr";

function resolveTemplate(pathnames: PathnameTable, pathname: string, locale: SweepLocale): string {
  const entry = pathnames[pathname];
  if (entry === undefined) {
    throw new Error(
      `sweep route "${pathname}" is not a key of routing.pathnames — the route was renamed ` +
        `or removed; update lib/overflow-sweep/routes.ts`,
    );
  }
  if (typeof entry === "string") return entry;
  const localized = entry[locale];
  if (localized === undefined) {
    throw new Error(`sweep route "${pathname}" has no "${locale}" segment in routing.pathnames`);
  }
  return localized;
}

function fillParams(
  template: string,
  params: Readonly<Record<string, string>>,
  id: string,
): string {
  const filled = template.replace(/\[(\w+)\]/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`sweep route "${id}" has no value for the [${name}] segment`);
    }
    return value;
  });
  if (filled.includes("[")) {
    throw new Error(`sweep route "${id}" still has an unfilled segment: ${filled}`);
  }
  return filled;
}

/**
 * Turn the shape table into the concrete root-relative URLs the browser will visit.
 *
 * Takes the pathname table as an argument rather than importing `i18n/routing.ts` itself:
 * the sweep script runs under plain Node (type-stripping, no `@/` alias resolution), so this
 * module has to stay import-free to be loadable from both the script and vitest.
 */
export function buildSweepUrls(
  pathnames: PathnameTable,
  shapes: readonly SweepShape[] = SWEEP_SHAPES,
): SweepUrl[] {
  const urls: SweepUrl[] = [];
  for (const shape of shapes) {
    for (const locale of shape.locales) {
      const template = resolveTemplate(pathnames, shape.pathname, locale);
      // Always, even with no params: a dynamic pathname whose `params` were forgotten would
      // otherwise be requested verbatim, and `/turkiye/[slug]` is a 404 — a page with no
      // horizontal overflow, i.e. a green check measuring nothing.
      const path = fillParams(template, shape.params ?? {}, shape.id);
      const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
      const url = path === "/" ? prefix || "/" : `${prefix}${path}`;
      urls.push({ id: `${shape.id}:${locale}`, shape, locale, url });
    }
  }
  return urls;
}

/**
 * Routing keys no shape covers. Printed as a footer by the script rather than thrown on:
 * the sweep is a representative set on purpose, and a new route is a prompt to decide
 * whether it is a new SHAPE, not an automatic failure.
 */
export function uncoveredPathnames(
  pathnames: PathnameTable,
  shapes: readonly SweepShape[] = SWEEP_SHAPES,
): string[] {
  const covered = new Set(shapes.map((shape) => shape.pathname));
  return Object.keys(pathnames).filter((key) => !covered.has(key));
}
