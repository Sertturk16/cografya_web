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
 * ## Why it holds ONE tool today
 *
 * `plan-web.md` §1.1 describes three. Area calculation and coordinate lookup land WITH their
 * pages in PR-C and PR-D (→ `Owner's Inbox/cbs-p2/pr-b/TASK-CONTEXT.md` md.7): a register
 * entry is what puts a card, an `ItemList` position and a sitemap row behind a URL, and all
 * three of those are promises. The dead-link rule outranks the plan's four-row file list, and
 * that ordering is the recorded deviation rather than an oversight.
 *
 * ## Why the message keys are NOT in here
 *
 * next-intl types message keys, and a key assembled from a registry field
 * (`t(\`hub.\${entry.id}Name\`)`) opts out of that check silently — the `/oyun` hub records
 * the same reasoning at its own card tuple. So the hub names its cards with literal keys and
 * uses this file for the parts a literal cannot carry: the route and the schema type.
 */
export interface ToolRegistryEntry {
  /** Stable id — also the message-key stem inside `Tools` (`Tools.mesafe.*`). */
  readonly id: string;
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

/** Distance measurement (`/araclar/mesafe-olcme` ↔ `/en/tools/distance`) — Faz-1's tool. */
export const DISTANCE_TOOL = {
  id: "mesafe",
  pathname: "/araclar/mesafe-olcme",
  learningResourceType: "Interactive tool",
} as const satisfies ToolRegistryEntry;

/** Every tool that has a published page today, in the order the hub lists them. */
export const TOOL_REGISTRY = [DISTANCE_TOOL] as const satisfies readonly ToolRegistryEntry[];

/** The tool hub's own route — one constant, so the pages and the sitemap cannot disagree. */
export const TOOL_HUB_PATHNAME: StaticPathname = "/araclar";
