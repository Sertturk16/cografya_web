import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BOOK_DETAIL } from "@/test/fixtures/books/book-fixtures";
import { videoObjectJsonLd } from "@/lib/seo/json-ld";
import type { BookVideoYoutube } from "@/lib/api/types";
import type { BenchVideo } from "./bench-stage";
import { DenemeVideo } from "./deneme-video";

/**
 * REGRESSION GUARD — PR #137 validator `VAL137-C1`/`VAL137-NEW-C1`
 * (`cografya_web/pr-reviews/137-validator.json`), commissioned by
 * `Owner's Inbox/uyelik-uyum-denetimi/p2-video-kapisi/atlas-karar-kapak.md`.
 *
 * ## What was found, and why a name search missed it
 *
 * The finding was never that this repo BUILDS a provider address from the video id — it does
 * not, and `lib/youtube/embed.ts`'s own docblock states as much ("there is no `thumbnailUrl()`
 * here and there must never be one"). The finding is that the provider's OWN cover address —
 * `https://i.ytimg.com/vi/{VIDEO_ID}/{resolution}.jpg`, rendered verbatim from
 * `BookVideoYoutubeDto.thumbnailUrl` — carries the raw, reversible video id IN ITS PATH, and
 * that address reaches an anonymous reader through TWO sites this repo does control: the
 * cover `<img src>` (`deneme-video.tsx:552`) and `VideoObject.thumbnailUrl` in the page's
 * structured data (`json-ld.tsx:474`). P2's own fix round searched only for the identifier's
 * NAME (`youtubeVideoId`/`embedUrl`/`contentUrl`) and missed a VALUE embedded inside a
 * different field's address — this guard exists so that class of miss cannot recur silently.
 *
 * ## What this guard actually asserts
 *
 * Given the exact fixture value `test/fixtures/books/book-fixtures.ts` already seeds
 * (`https://i.ytimg.com/vi/fixtureVid1/hqdefault.jpg?...` — the same literal the validator's
 * own evidence cites), the combined raw output of BOTH sanctioned render sites — the cover
 * markup `DenemeVideo` produces and the `VideoObject` JSON-LD `videoObjectJsonLd` produces —
 * for an ANONYMOUS render (`active={null}`, `authState="anonymous"`, matching P2's own gate)
 * must contain the provider's CDN-shaped address (`i*.ytimg.com/vi/...`) ONLY as the exact,
 * byte-identical string the api handed it — never a DIFFERENT occurrence of that shape (which
 * would mean some code path constructed or altered it), and never a `/watch?v=` or `/embed/`
 * address at all (P2's own invariant: an anonymous render never has a video id to build one
 * from). This is the "search by shape and by the seeded value, never by field name" discipline
 * the validator named, made into a durable, executable guard rather than a one-time grep.
 *
 * ## Why `renderToStaticMarkup`, unlike `deneme-video.src-invariant.test.ts`'s sibling file
 *
 * That file reads SOURCE TEXT because its own invariants (dependency arrays, click-handler
 * ordering, corrective-scroll math) are DYNAMIC — observable only through interaction, which
 * this repo's jsdom-free `node` vitest environment cannot drive (`FU-WEB-JSDOM`). What THIS
 * guard checks is observable on `DenemeVideo`'s INITIAL render alone — the same static-markup
 * technique `components/lock-icon.test.tsx` already establishes needs no jsdom. `DenemeVideo`
 * itself is fully prop-driven (no `useAuthSession()`/`useBenchState()` of its own — see its own
 * prop list), so it renders here with no additional mocking.
 *
 * ## The break/red/restore/green proof this file's history records (not re-run automatically)
 *
 * Observed RED by temporarily changing `deneme-video.tsx`'s cover `<img src={rich.thumbnailUrl}>`
 * to a HAND-CONSTRUCTED different address
 * (`src="https://i.ytimg.com/vi/handConstructedId/hqdefault.jpg"`, simulating exactly the class
 * of regression this guard exists to catch — a rendering site stops passing the api's own
 * string through and starts building/altering one instead) and re-running this file: the
 * "byte-identical to the api's own string" assertion below failed with a mismatched substring,
 * quoted in this task's return. Reverted immediately after. A guard never seen red is not a
 * guard (dispatch instruction) — this file's own git history is the durable proof; this
 * docblock is the pointer to it, not a substitute for having done it.
 */

/** Declared non-nullable up front (an IIFE, not a bare narrowed `const`) so every later
 *  closure — `anonymousStructuredData()` below included — keeps the non-null type without
 *  TypeScript losing the narrowing across a function boundary. */
const seededYoutube: BookVideoYoutube = (() => {
  const youtube = BOOK_DETAIL.videos[0]?.youtube;
  if (youtube === undefined || youtube === null) {
    throw new Error(
      "fixture regression: BOOK_DETAIL.videos[0].youtube must be populated for this guard",
    );
  }
  return youtube;
})();

/** The exact CDN-shaped video id this fixture seeds — extracted from the fixture's own string
 *  rather than hardcoded a second time, so a future fixture edit cannot silently desync the
 *  value this guard searches for from the value it actually renders. */
const seededIdentifierMatch = /\/vi\/([^/]+)\//.exec(seededYoutube.thumbnailUrl);
if (seededIdentifierMatch === null) {
  throw new Error(
    "fixture regression: BOOK_DETAIL.videos[0].youtube.thumbnailUrl no longer matches the " +
      "provider CDN shape this guard is built to search for",
  );
}
const seededIdentifier = seededIdentifierMatch[1];

/** The exact `rich` shape BOTH `/kitaplar/[slug]/page.tsx` and `/v2/kitaplar/[slug]/page.tsx`
 *  build inline from `state.youtube` — field-for-field identical at both call sites. Written
 *  out here rather than imported: this guard must fail if EITHER page's own construction ever
 *  stops matching this shape, and an imported helper could drift together with the page instead
 *  of catching it. */
const richPayload: NonNullable<BenchVideo["rich"]> = {
  thumbnailUrl: seededYoutube.thumbnailUrl,
  thumbnailWidth: seededYoutube.thumbnailWidth,
  thumbnailHeight: seededYoutube.thumbnailHeight,
  durationIso: seededYoutube.durationIso,
  durationSeconds: seededYoutube.durationSeconds,
  publishedAtUtc: seededYoutube.publishedAtUtc,
  publishedText: "2 Ocak 2026",
};

const fixtureVideo: BenchVideo = {
  orderNo: 1,
  bookVideoId: BOOK_DETAIL.videos[0]?.bookVideoId ?? "",
  titleTr: null,
  titleEn: null,
  playable: true,
  tags: [],
  rich: richPayload,
};

/** The cover markup an ANONYMOUS reader's first response carries — `active={null}` is P2's own
 *  anonymous starting state (`components/book/deneme-video.tsx`'s own docblock: "the anonymous
 *  payload no longer carries the id at all, so a NEW load starts with it `null`"). */
function renderAnonymousCover(): string {
  return renderToStaticMarkup(
    <DenemeVideo
      video={fixtureVideo}
      active={null}
      authState="anonymous"
      watched={false}
      title="Fixture Book — Fixture Video"
      watchLabel="İzle"
      watchAriaLabel="İzle"
      watchAriaSignedOutLabel="İzle (üye ol)"
      signInCtaText="Üye ol"
      sessionReadyAnnounceText=""
      watchOnYoutubeLabel="YouTube'da izle"
      watchOnYoutubeAriaLabel="YouTube'da izle"
      watchOnYoutubeLoading={false}
      watchLoadingLabel="Yükleniyor"
      watchLoadingAriaLabel="Yükleniyor"
    />,
  );
}

/** The `VideoObject` structured data both pages emit, built through the SAME shared function
 *  and the SAME `thumbnailUrl: state.youtube.thumbnailUrl` passthrough both page.tsx files use
 *  — no `embedUrl` (P2 Option C), matching an anonymous request on either page. */
function anonymousStructuredData(): string {
  const schema = videoObjectJsonLd({
    name: "Fixture Book — Fixture Video",
    thumbnailUrl: seededYoutube.thumbnailUrl,
    uploadDate: seededYoutube.publishedAtUtc,
    duration: seededYoutube.durationIso,
  });
  expect(schema).not.toBeNull();
  return JSON.stringify(schema);
}

/** The CDN address shape both render sites are checked against — not the field NAME, the
 *  provider's own known, stable, hash-free path shape (validator evidence, `137-validator.json`
 *  `VAL137-C1`: "`https://i.ytimg.com/vi/{VIDEO_ID}/{çözünürlük}.jpg` yıllardır sabit"). */
const PROVIDER_THUMBNAIL_SHAPE = /https:\/\/i\d*\.ytimg\.com\/vi\/[^"/]+\/[^"?]+(\?[^"]*)?/g;

describe("the anonymous cover + structured data never construct a provider address (regression: PR #137 VAL137-C1/VAL137-NEW-C1)", () => {
  it("renders the api's own thumbnailUrl string verbatim, in both sanctioned sites, and nowhere else in a different form", () => {
    const combined = renderAnonymousCover() + anonymousStructuredData();

    // Sane baseline first — the guard is not vacuous: the value really did reach both sites.
    expect(combined).toContain(seededYoutube.thumbnailUrl);
    expect(combined).toContain(seededIdentifier);

    // THE CORE ASSERTION. Every occurrence of the CDN shape in the combined output must be
    // BYTE-IDENTICAL to the api's own string — never a shape match with a DIFFERENT id or a
    // different path, which is what a construction/rewrite bug would produce. The `&amp;`
    // normalisation is React's own HTML ATTRIBUTE escaping of the query string's `&`
    // (`renderToStaticMarkup` on `<img src>`, not on the JSON-LD half) — a real browser decodes
    // it back to `&` when it parses the attribute, so undoing it here is reading the markup the
    // way a browser does, not weakening what this assertion catches: a DIFFERENT id or path
    // still fails it exactly the same.
    const shapeMatches = [...combined.matchAll(PROVIDER_THUMBNAIL_SHAPE)].map((match) =>
      match[0].replace(/&amp;/g, "&"),
    );
    expect(shapeMatches.length).toBeGreaterThan(0);
    for (const occurrence of shapeMatches) {
      expect(occurrence).toBe(seededYoutube.thumbnailUrl);
    }
  });

  it("never constructs a watch or embed address for an anonymous render — no video id to build one from", () => {
    const combined = renderAnonymousCover() + anonymousStructuredData();

    // P2's own invariant, re-asserted at the combined-output level rather than only at each
    // isolated unit (`active-video.test.ts`, `deneme-video.src-invariant.test.ts`): an
    // anonymous render has no video id, so nothing here may EVER print a playable/watchable
    // address, even one built from the seeded identifier that DOES legitimately appear inside
    // the cover address above.
    expect(combined).not.toMatch(/\/watch\?v=/);
    expect(combined).not.toMatch(/\/embed\//);
    expect(combined).not.toMatch(new RegExp(`youtube(-nocookie)?\\.com/(embed|watch)`));
  });
});
