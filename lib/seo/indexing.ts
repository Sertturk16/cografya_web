import { routing, type Locale } from "@/i18n/routing";

/**
 * Per-locale indexing policy — the ONE place the EN de-index is switched.
 *
 * ## Why this exists (owner ruling 2026-07-18)
 *
 * Every narrative field the api ships is Turkish-only (`introTr`, `landformNoteTr`,
 * `climateNoteTr`, `hydrographyNoteTr`, `settlementNoteTr`, …) and the detail pages gate
 * them behind `isTr`. So an EN detail page renders English CHROME around a fact sheet and
 * a templated intro sentence — no unique prose. Across ~200 countries + 81 provinces that
 * is a large set of thin, near-identical pages: exactly Google's **scaled content abuse**
 * pattern (https://developers.google.com/search/docs/essentials/spam-policies#scaled-content).
 *
 * The ruling: those EN pages get `noindex, follow` until real EN content lands. `follow`
 * is deliberate — the internal link graph must keep being crawled.
 *
 * ## What this is NOT
 *
 * NOT a `robots.txt` Disallow. Google must be able to CRAWL a page to ever see its
 * `noindex` ("If the page is blocked by a robots.txt file … the crawler will never see
 * the noindex rule" — Search Central, Block Indexing). Disallow would freeze the pages in
 * whatever state they are in, the opposite of the intent. This is the ferrumone pattern
 * pinned in `CONVENTIONS.md` §6 #8 / `ENGINEERING.md` §4 #8.
 *
 * ## Reverting
 *
 * When real EN narrative content ships, flip {@link EN_CONTENT_READY} to `true` — that one
 * edit restores indexability, the full tr/en/x-default hreflang cluster, and the EN sitemap
 * entries everywhere at once. No per-page edits.
 */

/**
 * Master switch: does the platform have genuine, per-entity ENGLISH narrative content?
 *
 * `false` today. Flip to `true` ONLY when the api actually serves EN narrative fields AND
 * the detail pages render them (i.e. when the `isTr` gates in
 * `app/[locale]/{turkiye,dunya}/[slug]/page.tsx` are removed). Flipping it while the pages
 * still render TR-gated chrome would re-expose the scaled-content surface.
 */
export const EN_CONTENT_READY: boolean = false;

/**
 * The content shape of a route, which is what decides whether EN is indexable.
 *
 * - `"localized"` — every locale has genuine, hand-written copy for this page. Today: the
 *   home page, `/hakkimizda` ↔ `/en/about`, and the `/turkiye` + `/dunya` map hubs, whose
 *   headings, ledes and meta strings are real EN prose in `messages/en.json` (verified, not
 *   assumed) and whose value — the interactive map + the province/country index — is
 *   locale-independent. These stay fully indexable in both locales.
 * - `"trNarrative"` — the page's substance comes from TR-only api narrative fields, so the
 *   EN rendering is chrome-only. Today: `/turkiye/[slug]` and `/dunya/[slug]`.
 * - `"noindex"` — the page is deliberately kept out of the index in EVERY locale. Today:
 *   the per-mode game screens under `/oyun` (→ DEC 2026-07-30p). They are application
 *   screens, not documents: what a crawler would see is a map and a control strip, and
 *   three of them would repeat the hub's own thin copy. The hub `/oyun` carries the query;
 *   these carry the play. Opening them up later is a one-word change here plus a sitemap
 *   line — the reversible direction.
 */
export type ContentSurface = "localized" | "trNarrative" | "noindex";

/**
 * The locales in which a page of this surface may be indexed.
 *
 * The narrowed branch keeps the DEFAULT locale rather than excluding `"en"` by name. The
 * two are identical while `routing.locales` is `["tr", "en"]`, but they mean different
 * things: the invariant this module documents is *"the locale that owns the narrative is
 * never de-indexed"*, not *"English is de-indexed"*. Expressed this way, a future third
 * locale is de-indexed on TR-narrative surfaces by default and must opt IN — the same
 * fail-safe direction as `surface` defaulting to `"localized"`.
 */
export function indexableLocales(surface: ContentSurface): readonly Locale[] {
  return indexableLocalesFor(surface, EN_CONTENT_READY);
}

/**
 * The same policy with the switch passed IN — the form the tests can interrogate.
 *
 * {@link EN_CONTENT_READY} is a module constant, so a test importing
 * {@link indexableLocales} can only ever see today's `false`, and under `false` the two
 * possible branch orders below produce identical output for EVERY surface. That made the
 * ordering — the one thing standing between a one-word flag flip and re-indexing a
 * deliberately de-indexed surface — untestable in practice. Taking the flag as a parameter
 * is the whole fix: the real function stays a one-liner over the constant, and the branch
 * order is pinned at the combination where it actually matters.
 */
export function indexableLocalesFor(
  surface: ContentSurface,
  enContentReady: boolean,
): readonly Locale[] {
  // Checked FIRST, before the EN switch: a fully de-indexed surface is a property of the
  // page, not of how much English content exists, so flipping `EN_CONTENT_READY` must
  // never quietly index it. An empty list is also what keeps every downstream consumer
  // honest without a second rule — `buildAlternates` emits a self-canonical and no
  // `languages` map (the DEC 2026-07-18c "a noindex page leaves the hreflang cluster
  // entirely" shape), and `sitemapEntriesFor` emits no `<url>` at all.
  if (surface === "noindex") return [];
  if (surface === "localized" || enContentReady) return routing.locales;
  return routing.locales.filter((locale) => locale === routing.defaultLocale);
}

/** Whether THIS (locale, surface) pair is indexable. */
export function isIndexable(locale: Locale, surface: ContentSurface): boolean {
  return indexableLocales(surface).includes(locale);
}
