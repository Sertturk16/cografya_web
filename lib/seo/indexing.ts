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
 *
 * ## THE FLIP HAS A SECOND HALF: three visible notices (→ PR #47 review CR-M2)
 *
 * `<EnWorkInProgressNotice>` (`components/en-work-in-progress-notice.tsx`) tells an English
 * reader that the detailed sections exist in Turkish only (→ DEC 2026-08-04i §4). It is NOT
 * wired to this constant — it renders on `locale === "en"`, full stop — so flipping this
 * switch alone would leave a "work in progress" banner sitting on top of finished English
 * pages, which is the same class of dishonesty in the opposite direction.
 *
 * The three call sites, so the EN content wave does not have to hunt for them:
 *   · `app/[locale]/turkiye/[slug]/page.tsx`
 *   · `app/[locale]/dunya/[slug]/page.tsx`
 *   · `app/[locale]/deniz/page.tsx`
 *
 * They are exactly today's `"trNarrative"` members. If a future surface joins or leaves that
 * set, the notice list moves with it.
 *
 * ## AND A THIRD HALF: two EN source-credit strings (→ PR #54 `CR54-M2`, `n`)
 *
 * `messages/en.json` → `CountryDetail.sources` and `CountryDetail.sourcesNoPopulation` name
 * the institutions behind the fields an English country page actually renders. The UN M49
 * subregion, the official languages, the currency and the government form are `isTr`-gated
 * fact-sheet cards; the landform, climate and hydrography prose is `isTr`-gated narrative;
 * and the independence note is `isTr`-gated too, though it is a HISTORY section rather than
 * physical geography (→ PR #55 `FEN-M2`) and carries its own attribution row. None of them is
 * drawn in English TODAY, so those two sentences deliberately do not credit them — crediting
 * a field the reader cannot see is what `CR54-M2` found, on all 199 pages: both variants
 * carried it (→ PR #55 `CR55-M5`).
 *
 * That correctness is pegged to the gates, not to the fields' existence — and the gated
 * columns are `…Tr` with no EN counterpart, so pulling the `isTr` gates out ALONE would
 * render TURKISH text on an English page (→ PR #55 `CR55-M3`), not English. The flip is this
 * switch's own precondition above: the api serves the English counterparts AND the gates come
 * out. At that moment the same two sentences become UNDER-credited — the identical defect
 * pointing the other way, and silent, because nothing fails.
 *
 * So the wave widens both strings and narrows `TR_GATED_FIELD_LEXEMES`
 * (`lib/seo/en-gated-lexemes.ts`), the ONE list holding today's narrower wording. Three
 * places move with it, and the checklist names all three rather than the first one
 * (→ PR #55 `CR55-M2`):
 *
 *   · `lib/geo/country-sources.test.ts` — the credit ban, the positive floor under it, and a
 *     tripwire that fails the moment this switch flips;
 *   · `lib/seo/country-description.test.ts` — the same list applied to the meta-description
 *     templates, which must not PROMISE those sections either;
 *   · the `isTr` fact-sheet gates in `app/[locale]/dunya/[slug]/page.tsx` themselves.
 *
 * NOT a mechanical "restore the deleted words" (→ PR #55 `SG55-N1`). What came out included
 * the UN M49 SUBREGION credit, and M49 attribution is not uniformly supportable across this
 * corpus: the sovereignty gate recorded that QN and XK are not enumerated in UNSD's M49
 * country-or-area list, and that TW's M49 entry carries a name contradicting the owner-ruled
 * entity name (DEC 2026-07-13 §4). That question is OPEN and is the owner's; this note exists
 * so the wave surfaces it instead of restoring a UN-recognition implication on the two rows
 * where recognition is the contested question.
 *
 * The continent credit is not part of any of this — `country.continent` has no locale gate,
 * so it is earned in both locales now and after the flip. The full refutation of `CR54-M2`'s
 * second half lives once, in `lib/seo/en-gated-lexemes.ts`; it must not be "re-fixed" here.
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
 * - `"trNarrative"` — the page's substance is TURKISH-ONLY, so the EN rendering is
 *   chrome-only. Today: `/turkiye/[slug]` and `/dunya/[slug]`, whose substance is the api's
 *   TR-only narrative fields, and `/deniz`, whose substance is seven hand-written Turkish
 *   explainer blocks in `messages/tr.json` that are deliberately NOT machine-translated
 *   (`SEO-POLICY.md` §B14). The surface is named after the api case because that is where
 *   it started; what it actually encodes is "the narrative exists in one locale only",
 *   whatever holds the narrative. Flipping `EN_CONTENT_READY` still fixes every member at
 *   once — for `/deniz` that means writing the English blocks, not translating them.
 * - `"noindex"` — the page is deliberately kept out of the index in EVERY locale. Today:
 *   the per-mode game screens under `/oyun` (→ DEC 2026-07-30p). They are application
 *   screens, not documents: what a crawler would see is a map and a control strip, and
 *   three of them would repeat the hub's own thin copy. The hub `/oyun` carries the query;
 *   these carry the play. Opening them up later is a one-word change here plus a sitemap
 *   line — the reversible direction.
 * - `"trOnly"` — TR is indexable and the English twin is **permanently** out, so
 *   {@link EN_CONTENT_READY} does not reach it. Today: the book tier, `/kitaplar` and
 *   `/kitaplar/[slug]` (→ DEC 2026-08-15c for the detail page, DEC 2026-08-15g V-4 for the
 *   hub). A Turkish exam-prep book has no English audience, and indexing the twin would
 *   incur a debt of hand-written English prose that, unpaid, leaves a thin near-duplicate
 *   page behind — so the answer does not change when the English wave lands.
 *
 *   THIS IS THE MEMBER THE OTHER THREE COULD NOT EXPRESS, and the gap was real rather than
 *   cosmetic: `"trNarrative"` says "English is waiting for content" and OPENS on the flip,
 *   `"noindex"` closes Turkish too — and Turkish is the entire value of this surface.
 *   Named for the content shape, like its siblings, and deliberately not for the mechanism
 *   (`"enPermanentNoindex"`): what is being described is a page whose substance exists in
 *   one locale by nature, not a robots directive.
 */
export type ContentSurface = "localized" | "trNarrative" | "noindex" | "trOnly";

/**
 * The locales in which a page of this surface may be indexed.
 *
 * The invariant this module documents is *"the locale that owns the narrative is never
 * de-indexed"*, not *"English is de-indexed"* — see {@link defaultLocaleOnly}, which is
 * where that distinction is now expressed and explained.
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
  // Checked before the switch for the SAME reason, and it is the only thing separating
  // this surface from `"trNarrative"`: both narrow to the default locale today, and under
  // today's `EN_CONTENT_READY = false` they are indistinguishable — the difference appears
  // only on the flip, where `"trNarrative"` opens and this must not. Placed after the
  // switch, the one-word flag flip documented above would silently index a surface that
  // was ruled permanently out. `indexing.test.ts` pins this ordering at `true`, which is
  // the only combination in which a test can see it.
  if (surface === "trOnly") return defaultLocaleOnly();
  if (surface === "localized" || enContentReady) return routing.locales;
  return defaultLocaleOnly();
}

/**
 * The narrowed locale set: the locale that OWNS the narrative, never "everything but
 * English".
 *
 * Extracted because two branches above now return it, and the distinction it encodes is
 * worth stating once rather than twice. Filtering to `routing.defaultLocale` and excluding
 * `"en"` by name are identical while `routing.locales` is `["tr", "en"]`, but they mean
 * different things: a future third locale is de-indexed BY DEFAULT on these surfaces and
 * has to opt in — the same fail-safe direction as `surface` defaulting to `"localized"`.
 */
function defaultLocaleOnly(): readonly Locale[] {
  return routing.locales.filter((locale) => locale === routing.defaultLocale);
}

/** Whether THIS (locale, surface) pair is indexable. */
export function isIndexable(locale: Locale, surface: ContentSurface): boolean {
  return indexableLocales(surface).includes(locale);
}
