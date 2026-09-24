import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSpecialStatusRow, showsCountryFlag, showsSovereigntyNote } from "./sovereignty";
import { gatesGoverning, ungatedRenderSite } from "@/lib/testing/jsx-gate";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * The "Egemenlik ve Tanınma" section's GATE, and the weld between that gate and the flag
 * card (→ DEC 2026-08-08h, DEC 2026-08-08l B2 path (a)).
 *
 * ## What this file pins, and what it must never pin
 *
 * It pins the MECHANISM: that the marker is read from the api field, that the section is
 * TR-only, and that on a special-status row the flag and the note can only appear or
 * disappear together. It pins NO membership and NO content — no test here says which
 * countries are special-status, which recognises whom, or how any note begins
 * (→ DEC 2026-07-12: tests check structure and invariants; facts are a separate process).
 *
 * That restraint is not cosmetic here. The six rows are exactly the rows whose text is
 * owner-verbatim narrative on a contested surface; a test that froze the list would turn a
 * seed-side editorial decision into a CI failure, and a test that quoted a note would make
 * this repo a second, silently diverging home for it.
 *
 * The note strings below are deliberately synthetic placeholders. Any non-null string is
 * equivalent to the gate — that IS the mechanism — so nothing resembling a real note is
 * needed or wanted.
 */

/** Stands in for "the api sent a note"; its content is irrelevant to every gate here. */
const SOME_NOTE = "…";

const LOCALES = ["tr", "en"] as const;
const FIELD_STATES: readonly (string | null)[] = [null, SOME_NOTE];

describe("special-status marker — mechanism, not membership", () => {
  it("is a read of the api field, so any filled value marks the row, and takes no locale — a fold-in must fail this suite (RV133R4-NEW-I1)", () => {
    expect(isSpecialStatusRow(null)).toBe(false);
    expect(isSpecialStatusRow(SOME_NOTE)).toBe(true);

    // The two behavioural assertions above call this function with ONE argument, its only
    // current parameter. They would stay green even if the function grew an OPTIONAL second
    // (locale) parameter defaulting to "tr", because a 1-arg call always hits that default —
    // proved by §11.B2's break/prove, not assumed. Pin the function's own source text too, so a
    // widened signature (or any other change to this one-line body) fails HERE regardless of what
    // any caller passes.
    const sovereigntyModuleSrc = readFileSync(new URL("./sovereignty.ts", import.meta.url), "utf8");
    expect(sovereigntyModuleSrc).toContain(
      "export function isSpecialStatusRow(sovereigntyNoteTr: string | null): boolean {\n" +
        "  return sovereigntyNoteTr !== null;\n" +
        "}",
    );
  });
});

describe("sovereignty note gate", () => {
  it("renders on TR when the field is filled", () => {
    expect(showsSovereigntyNote("tr", SOME_NOTE)).toBe(true);
  });

  it("does not render on EN — the field is TR-only and SEO-POLICY §B14 forbids machine EN", () => {
    expect(showsSovereigntyNote("en", SOME_NOTE)).toBe(false);
  });

  it("does not render on TR when the field is null", () => {
    expect(showsSovereigntyNote("tr", null)).toBe(false);
  });

  it("does not render on EN when the field is null", () => {
    expect(showsSovereigntyNote("en", null)).toBe(false);
  });
});

describe("the pair falls together", () => {
  it("ties the flag to the note on every special-status row, in every locale", () => {
    for (const locale of LOCALES) {
      for (const note of FIELD_STATES) {
        if (!isSpecialStatusRow(note)) continue;

        expect(
          showsCountryFlag(locale, note),
          "A special-status row may never show the flag without the note that balances it, " +
            "nor the note without the flag (DEC 2026-08-08h). If this fails, one of the two " +
            "gates grew a condition the other does not have.",
        ).toBe(showsSovereigntyNote(locale, note));
      }
    }
  });

  it("leaves ordinary rows alone — they keep the flag in both locales", () => {
    for (const locale of LOCALES) {
      for (const note of FIELD_STATES) {
        if (isSpecialStatusRow(note)) continue;
        expect(showsCountryFlag(locale, note)).toBe(true);
      }
    }
  });
});

/**
 * The source-read half of the weld.
 *
 * The behavioural test above proves the two FUNCTIONS agree. It cannot prove the PAGE asks
 * them — a call site that gated the flag on `isTr` would keep every assertion above green
 * while shipping the exact imbalance the ruling forbids. Same reason, and same technique, as
 * `components/map/attribution-separation.test.ts`: the call site is an async server component
 * and vitest runs in node with no jsdom.
 *
 * Comments are stripped first, because this page documents the coupling at length and a scan
 * of the raw text would be satisfied by the prose after someone deleted the code.
 */
const countryPage = stripComments(
  readFileSync(
    new URL("../../app/[locale]/(site)/dunya/[slug]/page.tsx", import.meta.url),
    "utf8",
  ).replace(/\r\n/g, "\n"),
);

describe("country page reads both gates from the single decision module", () => {
  it("derives the note from showsSovereigntyNote over the api field", () => {
    expect(countryPage).toMatch(
      /const sovereigntyNote =\s*showsSovereigntyNote\(locale, country\.sovereigntyNoteTr\)/,
    );
  });

  it("derives the flag gate from showsCountryFlag over the same api field", () => {
    expect(countryPage).toMatch(
      /const showsFlag = showsCountryFlag\(locale, country\.sovereigntyNoteTr\);/,
    );
  });

  it("has exactly one flag call site, and it sits behind that gate", () => {
    /**
     * The V2 rewrite replaced the `CountryFlag` component with an inline `<img>`, so this no
     * longer names a component. The gate is what the test is about and it is intact — but the
     * inline form is why the flag's OWN contract is asserted here now rather than left to
     * `components/country/country-flag.test.ts`, which guards a component this page stopped
     * using (and T-032 PR4 deletes). Inlining a component silently drops whatever the component
     * guaranteed; here that had already cost the page its localized alt text.
     */
    // The SUBJECT country's flag: one call site, behind `showsFlag`.
    const subjectFlags = countryPage.match(/src=\{`\/flags\/\$\{country\.isoCode/g);
    expect(subjectFlags, "subject-country flag call sites").toHaveLength(1);
    expect(countryPage).toMatch(/\{showsFlag && hasFlag\(country\.isoCode\) && \(/);
  });

  it("takes the neighbours' flag decision from the module too, never a second copy of the rule", () => {
    /**
     * V1 listed neighbours as text and rendered no flag for them, so this guarantee is new: the
     * V2 page puts a flag on every neighbour card, which raises the same question the subject
     * flag raises — a flag is a visual sovereignty claim, and on a contested row it needs the
     * same gate.
     *
     * The page answered it correctly and in the wrong place. `hasFlag(nb.iso) && (isTr ||
     * !nbIsSpecialStatus)` is `showsCountryFlag` rewritten by hand: right today, and free to
     * drift the next time the rule is revisited in `lib/geo/sovereignty.ts` alone. Membership
     * genuinely cannot be shared (the list DTO carries no `sovereigntyNoteTr`); the consequence
     * can, and now is.
     */
    expect(countryPage).toContain("showsCountryFlagForStatus(locale, nbIsSpecialStatus)");
    // No hand-rolled restatement anywhere on the page.
    expect(countryPage).not.toMatch(/isTr \|\| !nbIsSpecialStatus/);
    expect(countryPage).not.toMatch(/!nbIsSpecialStatus \|\| isTr/);

    // Every neighbour flag sits behind that one derived boolean.
    expect(
      ungatedRenderSite(countryPage, "src={`/flags/${nb.iso", "showsNeighbourFlag"),
    ).toBeNull();
  });

  it("gives the flag a localized alt and explicit dimensions", () => {
    // An informative image: a real alt, from the catalogue, never a literal and never `alt=""`.
    // `width`/`height` are the CLS half of the ENGINEERING §4 #9 raw-`<img>` exception.
    // Anchored on `country.isoCode` (same anchor as "has exactly one flag call site" above),
    // not the first `/flags/` occurrence in the file: T-037 Task 8 moved `NeighboursSection`
    // (whose own neighbour-flag `<img>`s also match `src={`/flags/`) above the default export,
    // so the neighbour flags now appear earlier in source order than the subject's.
    const flagBlock = /src=\{`\/flags\/\$\{country\.isoCode[\s\S]{0,400}?\/>/.exec(
      countryPage,
    )?.[0];
    expect(flagBlock, "flag <img> element").toBeDefined();
    expect(flagBlock).toMatch(/alt=\{t\("flagAlt", \{ name \}\)\}/);
    expect(flagBlock).not.toMatch(/alt=""/);
    expect(flagBlock).toMatch(/width=\{\d+\}/);
    expect(flagBlock).toMatch(/height=\{\d+\}/);
  });

  it("renders the note section behind the derived note, not behind the raw locale flag", () => {
    // The point has never been the operator — it is WHICH value the section hangs on. V1 wrote
    // `sovereigntyNote !== null`, V2 writes a truthy test on the same derived constant (which
    // also drops an empty-string note, so it is no looser). What must never appear here is
    // `locale`/`isTr`: the note is gated on the DERIVED decision, not on the raw locale flag,
    // which is the whole reason `showsSovereigntyNote` exists.
    const gates = gatesGoverning(countryPage, "text={sovereigntyNote}");
    expect(gates.length, "sovereigntyNote render sites").toBeGreaterThan(0);
    expect(ungatedRenderSite(countryPage, "text={sovereigntyNote}", "sovereigntyNote")).toBeNull();
    for (const gate of gates) {
      expect(gate, "note gated on the raw locale, not the derived decision").not.toMatch(
        /\bisTr\b|\blocale\b/,
      );
    }
  });

  it("takes the heading from the catalogue, never a literal", () => {
    // V1 wrote `<h2>`, V2 writes `<h3>` — the note is a card inside a section that already has
    // its own heading, so the level is a document-outline decision, not this test's business.
    // What is this test's business is that the string comes from the catalogue.
    expect(countryPage).toMatch(/<h[2-4][^>]*>\s*\{t\("sovereigntyHeading"\)\}\s*<\/h[2-4]>/);
  });
});
