import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the book detail surface (the `components/site-nav/
 * messages.test.ts` pattern, applied to the namespace this PR grew).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path in
 * place of the copy. On this namespace that is worse than a visible typo in one place:
 * `jumpNoVideo` is the ONLY accessible name of the jump strip's uncovered tiles, because the
 * digit beside it is `aria-hidden`. A one-locale addition or a rename therefore ships
 * "BookDetail.jumpNoVideo" as the accessible name of ten controls per book page, with typecheck,
 * lint and every rendered frame perfectly clean (→ PR #66 review `TA66-M5`).
 *
 * Both locales, always. The English twin is permanently `noindex` (→ DEC 2026-08-15c) but it is
 * still a page a reader can open, so "missing in en" is a defect rather than a translation
 * backlog.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts that keys resolve to non-empty strings,
 * never what the copy says.
 */

const BOOK_DETAIL_KEYS = [
  "kunyeHeading",
  "videosHeading",
  "denemeHeading",
  // The accordion's closed row (this PR).
  "denemeQuestionCount",
  // The jump strip (this PR). `jumpNoVideo` is an accessible name with no visible twin.
  "jumpHeading",
  "jumpNoVideo",
  "questionLabel",
  "questionLabelAria",
  "watch",
  "watchAria",
  "watchOnYoutube",
  "watchOnYoutubeAria",
  "playerTitle",
  "durationLabel",
  "publishedLabel",
  "badgeVideos",
  "badgeQuestions",
  "coverAlt",
  "purchase",
  "purchaseAria",
  "publisherLabel",
  "authorsLabel",
  "isbnLabel",
  "pageCountLabel",
  "denemeCountLabel",
  "examLabel",
  "sourcesLabel",
  "sourceNewTab",
] as const;

const catalogues = { tr: trMessages.BookDetail, en: enMessages.BookDetail } as const;

/**
 * The list above is hand-maintained, so on its own it can only prove that yesterday's keys still
 * resolve. Discovering every `BookDetail` consumer ties the list to the code, so a key added at a
 * new call site cannot fall outside this guard while both locales stay in perfect parity.
 */
const ROOTS = [
  { label: "components", url: new URL("../", import.meta.url) },
  { label: "app", url: new URL("../../app/", import.meta.url) },
] as const;

const consumerSources = ROOTS.flatMap(({ label, url }) =>
  readdirSync(url, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(?:ts|tsx)$/.test(name) && !name.includes("node_modules"))
    .map((name) => ({
      path: `${label}/${name}`,
      source: readFileSync(fileURLToPath(new URL(name, url)), "utf8").replace(
        /\/\*[\s\S]*?\*\//g,
        " ",
      ),
    }))
    .filter(({ source }) => /(?:use|get)Translations\("BookDetail"\)/.test(source)),
);

describe("BookDetail message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(BOOK_DETAIL_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    });
  }

  it("carries the SAME key set in both locales", () => {
    expect(Object.keys(enMessages.BookDetail).sort()).toEqual(
      Object.keys(trMessages.BookDetail).sort(),
    );
  });

  it("has no key the code stopped asking for", () => {
    // The other direction: `coverageNote` was deleted from the page in this PR, and a key left
    // behind in both catalogues is dead copy that the next reader takes for live copy.
    expect(Object.keys(trMessages.BookDetail).sort()).toEqual([...BOOK_DETAIL_KEYS].sort());
  });

  it("discovers at least one BookDetail consumer", () => {
    expect(consumerSources.length).toBeGreaterThan(0);
  });

  it.each(consumerSources)(
    "$path asks the BookDetail namespace for keys the list knows",
    ({ source }) => {
      // The derivation is only sound while `t` is the BookDetail translator. `page.tsx` legally
      // holds two — `t` for BookDetail and `tb` for Breadcrumb — so requiring a single namespace
      // per file would be wrong here; what has to hold is the BINDING the key scan below reads.
      expect(source).toMatch(/\bconst t = await getTranslations\("BookDetail"\)/);
      // EVERY `t` binding, not exactly one: `deneme-facade.tsx` holds two components and binds
      // the same namespace in each. What must not exist is a `t` bound to a different namespace.
      const tBindings = [
        ...source.matchAll(/\bconst t = (?:await )?(?:use|get)Translations\("([^"]+)"\)/g),
      ].map((match) => match[1]);
      expect(tBindings.length).toBeGreaterThan(0);
      expect([...new Set(tBindings)]).toEqual(["BookDetail"]);

      const requested = [...source.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]);
      // Anchors the scan: a refactor that renamed the translator would pass vacuously.
      expect(requested.length).toBeGreaterThan(0);
      for (const key of requested) {
        expect(BOOK_DETAIL_KEYS).toContain(key);
      }
    },
  );
});
