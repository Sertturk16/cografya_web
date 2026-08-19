/**
 * How one video solution is NAMED and ADDRESSED — the two things that change when the book is
 * not a deneme book.
 *
 * ## Why these three functions sit together in a file of their own
 *
 * `DEC 2026-08-17i` binds the book surface to stay generic: books are not only deneme books, and
 * a video's title is not necessarily `Soru N` — in a konu-anlatım book the videos map to topic
 * headings. Nothing on this page assumes otherwise EXCEPT the two answers below, and they were
 * previously spread across the page component, the JSON-LD call site and (after the bench) the
 * timeline. Collected here they become one seam: when the api grows a per-video display title
 * (`FU-BOOK-GENERIC-CONTRACT`, triggered before the second book's data), `videoTitle` is the one
 * function that learns to prefer it, and every consumer follows without being found first.
 *
 * **This file does not make the surface generic and does not pretend to.** It makes the
 * dependency countable. The fragment scheme in particular is BINDING IA (`SEO-POLICY.md` §B4's
 * book row names `#deneme-12` and `#deneme-12-soru-3` in as many words), so changing it is a
 * ruling rather than a refactor; what this file buys is that the ruling has one place to land.
 */

/** The minimum a video has to carry to be named and addressed. Deliberately structural rather
 *  than `BookVideo`: the JSON-LD call site and the stage both hold less than a full DTO.
 *
 *  Not exported, and neither is `VideoTitleTranslator` below: both exist to type `videoTitle`'s
 *  parameters, every caller satisfies them structurally, and an exported name nothing imports is
 *  surface that reads as an API (→ PR #70 review `SIMP70-M6`). Exporting either is a one-word
 *  change on the day a consumer needs to name it. */
interface VideoIdentity {
  readonly denemeNo: number;
}

/** The stable fragment id of one video's block (`SEO-POLICY.md` §B4's book row). */
export function denemeFragment(denemeNo: number): string {
  return `deneme-${denemeNo}`;
}

/** The stable fragment id of one question row — `#deneme-12-soru-3`, IA, not a route. */
export function questionFragment(denemeNo: number, questionNo: number): string {
  return `${denemeFragment(denemeNo)}-soru-${questionNo}`;
}

/**
 * The translator shape this needs, and nothing wider.
 *
 * Structural rather than next-intl's own `t` type on purpose: both a server `getTranslations`
 * and a client `useTranslations` binding satisfy it, so the same function serves the page, the
 * stage and the structured-data call site without either side importing the other's runtime.
 */
type VideoTitleTranslator = (key: "denemeHeading", values: { no: number }) => string;

/**
 * The video's visible title — the string the reader sees on the index row, on the stage caption
 * and inside `VideoObject.name`.
 *
 * All three MUST agree: §B5 5.7 bars structured data carrying anything the page does not show,
 * and `VideoObject.name` is composed from this title plus the book's `<h1>`. One function is what
 * makes that agreement structural instead of three call sites happening to pass the same
 * arguments.
 *
 * THE STAGE CAPTION WAS THE ONE CONSUMER OUTSIDE THE SEAM until PR #70's review, and the docblock
 * above counted it while the code did not import it (→ `FENER70-M1` / `CODE70-M4`). That is the
 * exact shape this file exists to prevent: when `FU-BOOK-GENERIC-CONTRACT` teaches this function a
 * per-video display title, a caption still spelling `t("denemeHeading", …)` by hand keeps printing
 * "Deneme 12" while the row beside it prints the real one.
 */
export function videoTitle(t: VideoTitleTranslator, video: VideoIdentity): string {
  return t("denemeHeading", { no: video.denemeNo });
}
