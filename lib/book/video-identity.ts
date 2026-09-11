import type { Locale } from "@/i18n/routing";

interface VideoIdentity {
  readonly orderNo: number;
}

export function videoFragment(orderNo: number): string {
  return `video-${orderNo}`;
}

interface TagIdentity {
  readonly orderNo: number;
  readonly nameTr: string | null;
}

/** Disambiguates against the video's OWN sibling tags (`CODE134-I1`/`A11Y134-NEW-M1`, PR #134
 *  fix round). `SEO-POLICY.md` §B4's book-layer note states the video-order prefix already
 *  makes the fragment unique — true across videos, but it says nothing about two NAMED tags
 *  within the same video's own list folding to the same string, which `foldTagName` can do
 *  (Turkish-char/punctuation variants of one concept, e.g. "İklim-Bitki" vs "İklim Bitki"). This
 *  guard restores the uniqueness the policy text already asserts rather than contradicting it. */
export function tagFragment(
  videoOrderNo: number,
  tag: TagIdentity,
  siblingTags: readonly TagIdentity[],
): string {
  if (tag.nameTr === null) return `${videoFragment(videoOrderNo)}-etiket-${tag.orderNo}`;
  const folded = foldTagName(tag.nameTr);
  const collisionCount = siblingTags.filter(
    (sibling) => sibling.nameTr !== null && foldTagName(sibling.nameTr) === folded,
  ).length;
  return collisionCount > 1
    ? `${videoFragment(videoOrderNo)}-${folded}-${tag.orderNo}`
    : `${videoFragment(videoOrderNo)}-${folded}`;
}

type VideoTitleTranslator = (key: "videoFallbackHeading", values: { no: number }) => string;

export function videoTitle(
  t: VideoTitleTranslator,
  locale: Locale,
  video: VideoIdentity & { readonly titleTr: string | null; readonly titleEn: string | null },
): string {
  const authored = locale === "en" ? video.titleEn : video.titleTr;
  if (authored !== null) return authored;
  return t("videoFallbackHeading", { no: video.orderNo });
}

/** GLOSSARY.md §5's 4-step fold (lowercase → Turkish-char fold → non-alnum runs to one
 *  hyphen → trim), reused here rather than re-invented per that section's own note. Reachable
 *  only once a video's tag carries a non-null `nameTr` — no seeded row does yet
 *  (`FU-BOOK-GENERIC-CONTRACT`), so this is proven by a synthetic unit case (§5.7), not by
 *  live data.
 *
 *  `toLocaleLowerCase("tr")`, NOT the plain `toLowerCase()` a first draft of this function
 *  carried: the ASCII-only default lowercases `İ` (dotted capital I) to a TWO-code-point
 *  sequence (`i` + a combining dot above, U+0307), which this function's own character class
 *  cannot fold as one unit — the combining mark falls through as a non-alphanumeric character
 *  and becomes a stray hyphen (`"İklim"` → `"i-klim"`, caught by this file's own unit case
 *  before it shipped). `lib/search/normalize.ts`'s `foldForSearch` already carries this exact
 *  lesson ("Turkish lowercasing runs FIRST so İ→i … follow Turkish rules rather than English
 *  ones") for the same reason; this function follows it rather than re-deriving it. With
 *  Turkish casing, `İ` folds to plain `i` directly, so the FOLD table needs no combining-mark
 *  entry at all. */
function foldTagName(value: string): string {
  const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return value
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (ch) => FOLD[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
