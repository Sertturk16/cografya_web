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
  // The index row's fact strip.
  "denemeQuestionCount",
  // The jump strip. `jumpNoVideo` is an accessible name with no visible twin.
  "jumpHeading",
  "jumpNoVideo",
  "questionLabel",
  "questionLabelAria",
  // The bench's timeline. Another accessible name with no visible twin: the strip's meaning is
  // carried by the ticks' POSITION, which is exactly the part that does not reach the
  // accessibility tree, so a missing key here leaves a group of six links named by a dotted path.
  "timelineLabel",
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

/** BOTH comment forms, not only the C-style one: a `t("…")` written in a line comment as an
 *  example would otherwise enter the key scan and fail this guard on a change that broke nothing
 *  (→ PR #66 review `CODE66R2-M6`). */
const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");

/**
 * BOTH binding shapes, in the discovery filter AND in the assertions built on it.
 *
 * This repo's idiom for a translator that needs an explicit locale is the OBJECT form,
 * `getTranslations({ locale, namespace: "X" })` — eight live call sites, and the shape every
 * `generateMetadata` is forced into. A filter that reads only the string form finds today's two
 * consumers by coincidence of style rather than by construction, and the next `BookDetail` string
 * reached from metadata would sit outside the guard entirely (→ `TA66R2-M3`). The binding
 * assertion below reads the same alternation, so a consumer this filter admits cannot fail on a
 * shape the filter itself permits (→ `CODE66R2-M6`).
 */
const NAMESPACE = String.raw`(?:"([^"]+)"|\{[^)]*namespace:\s*"([^"]+)")`;
const CONSUMES_BOOK_DETAIL = new RegExp(
  String.raw`(?:use|get)Translations\(\s*(?:"BookDetail"|\{[^)]*namespace:\s*"BookDetail")`,
);
const T_BINDING = new RegExp(
  String.raw`\bconst t = (?:await )?(?:use|get)Translations\(\s*` + NAMESPACE,
  "g",
);
const KEY_REQUEST = /\bt\("([^"]+)"/g;

const consumerSources = ROOTS.flatMap(({ label, url }) =>
  readdirSync(url, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(?:ts|tsx)$/.test(name) && !name.includes("node_modules"))
    .map((name) => ({
      path: `${label}/${name}`,
      source: stripComments(readFileSync(fileURLToPath(new URL(name, url)), "utf8")),
    }))
    .filter(({ source }) => CONSUMES_BOOK_DETAIL.test(source)),
);

/** Every key the code actually asks for, across every discovered consumer. */
const requestedKeys = [
  ...new Set(
    consumerSources.flatMap(({ source }) =>
      [...source.matchAll(KEY_REQUEST)].map((match) => match[1] ?? ""),
    ),
  ),
].sort();

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
    //
    // Asserted against the DERIVED set, not against the hand-maintained list. The previous form
    // compared the catalogue to `BOOK_DETAIL_KEYS` — the list against itself — so deleting a
    // `t("x")` call site while leaving `x` in the list and in both catalogues passed every
    // assertion here, which is precisely the retirement shape this PR performed (→ `TA66R2-M4`).
    // The list is now a derived fact rather than a second source of truth.
    expect(requestedKeys).toEqual([...BOOK_DETAIL_KEYS].sort());
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
      //
      // EVERY `t` binding, not exactly one: a file may hold more than one component and bind the
      // same namespace in each (`deneme-meta.tsx` did while it also held the facade). What must
      // not exist is a `t` bound to a different namespace.
      const tBindings = [...source.matchAll(T_BINDING)].map((match) => match[1] ?? match[2]);
      expect(tBindings.length).toBeGreaterThan(0);
      expect([...new Set(tBindings)]).toEqual(["BookDetail"]);

      const requested = [...source.matchAll(KEY_REQUEST)].map((match) => match[1]);
      // Anchors the scan: a refactor that renamed the translator would pass vacuously.
      expect(requested.length).toBeGreaterThan(0);
      for (const key of requested) {
        expect(BOOK_DETAIL_KEYS).toContain(key);
      }
    },
  );
});
