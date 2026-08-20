import type { AppPathname } from "@/i18n/routing";

/**
 * A route that needs no params — which every tool route is, by ruling.
 *
 * `AppPathname` also covers the `[slug]` routes, and a value of that union cannot be handed
 * to `getPathname` or `<Link>` on its own: those routes need a params object. Narrowing here
 * is what lets a tool's pathname travel as a plain string, and it is the type-level statement
 * of Atlas ruling AK-31/V-1 — the tool tier is four static routes rather than one dynamic
 * one, so `SEO-POLICY.md` §B4 4.5's hand-derived-slug hazard has no surface to appear on.
 */
type StaticPathname = Exclude<AppPathname, `${string}[${string}`>;

/**
 * The CBS tool tier's register: which tools are LIVE, where each one lives, and what its
 * `LearningResource` node calls it.
 *
 * ## What it is for
 *
 * Three things have to agree about a tool and nothing but this file makes them: the route in
 * `i18n/routing.ts`, the page directory under `app/[locale]/araclar/`, and the hub's card +
 * `ItemList` entry. `tool-registry.test.ts` derives all three from each other, so a tool that
 * gains a page without a route (or a card without a page) fails CI rather than shipping a
 * dead hub link — `SEO-POLICY.md` A4/3 and §B8 8.8 rate that a BLOCKER.
 *
 * ## It holds all three of Faz-1's tools, and it reached three one at a time
 *
 * A register entry is what puts a card, an `ItemList` position and a sitemap row behind a URL,
 * and all three of those are promises — so an entry landed only in the PR that built its page
 * (→ `Owner's Inbox/cbs-p2/pr-b/TASK-CONTEXT.md` md.7), distance in PR-B, coordinate lookup in
 * PR-C, area calculation in PR-D. The dead-link rule outranked `plan-web.md` §1.1's three-row
 * table for as long as the pages were missing; with the tier complete the two agree again, and
 * the ordering stands as a recorded deviation rather than an oversight.
 *
 * ## Why the message keys are NOT in here
 *
 * next-intl types message keys, and a key assembled from a registry field
 * (`t(\`hub.\${stem}Name\`)`) opts out of that check silently — the `/oyun` hub records the
 * same reasoning at its own card tuple. So the hub names its cards with literal keys and uses
 * this file for the parts a literal cannot carry: the route and the schema type. There is
 * deliberately no `id` field: it would be a key stem this file forbids assembling, and nothing
 * read it (→ PR #73 review `SIMP73-M2`).
 */
export interface ToolRegistryEntry {
  /** The tool's own route, as declared in `i18n/routing.ts`. */
  readonly pathname: StaticPathname;
  /**
   * `schema.org/LearningResource.learningResourceType` — the page's real shape.
   *
   * Deliberately NOT `/deniz`'s `"Article"` (`SEO-POLICY.md` §B5, tool-surface mapping: "the
   * page's real shape; `/deniz`'s `Article` is not copied"). This page is an instrument the
   * reader operates, and the explanatory text around it exists to make the instrument
   * legible — calling it an article would describe the page less accurately, which is the
   * same 5.7 boundary the `SoftwareApplication` ban sits on.
   */
  readonly learningResourceType: string;
}

/** Distance measurement (`/araclar/mesafe-olcme` ↔ `/en/tools/distance`) — Faz-1's first tool. */
export const DISTANCE_TOOL = {
  pathname: "/araclar/mesafe-olcme",
  learningResourceType: "Interactive tool",
} as const satisfies ToolRegistryEntry;

/**
 * Coordinate lookup (`/araclar/koordinat-bulma` ↔ `/en/tools/coordinates`).
 *
 * The TR term is `GLOSSARY.md` §4.3's canonical one: "koordinat bulma", and explicitly NOT
 * "koordinat okuma" (AK-25 md.1). The slug follows from the term rather than the other way
 * round.
 */
export const COORDINATE_TOOL = {
  pathname: "/araclar/koordinat-bulma",
  learningResourceType: "Interactive tool",
} as const satisfies ToolRegistryEntry;

/**
 * Area calculation (`/araclar/alan-hesaplama` ↔ `/en/tools/area`).
 *
 * The TR term is `GLOSSARY.md` §4.3's canonical one: "alan hesaplama", and explicitly NOT
 * "alan ölçme" (AK-25 md.1) — the route-derived form won over AK-24's free recollection, and
 * the slug follows from the term rather than the other way round. GLOSSARY §3's
 * `yüzölçümü = area` row names a DATA FIELD and does not collide with it: this names a tool.
 */
export const AREA_TOOL = {
  pathname: "/araclar/alan-hesaplama",
  learningResourceType: "Interactive tool",
} as const satisfies ToolRegistryEntry;

/**
 * Every tool that has a published page today, in the order the hub lists them.
 *
 * The order is the hub's card order and its `ItemList` position order, so it is editorial
 * rather than incidental: distance first because it is the tier's entry point and the one the
 * home page links, coordinate lookup second, area calculation third — the same order the hub's
 * intro walks the curriculum's point, line and area layers in.
 */
export const TOOL_REGISTRY = [
  DISTANCE_TOOL,
  COORDINATE_TOOL,
  AREA_TOOL,
] as const satisfies readonly ToolRegistryEntry[];

/** The tool hub's own route — one constant, so the pages and the sitemap cannot disagree. */
export const TOOL_HUB_PATHNAME: StaticPathname = "/araclar";
