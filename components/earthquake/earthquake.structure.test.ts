import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * This repo's vitest environment is `node`, and the list/badge are plain, hook-free components
 * while the attribution block is an async server component — none of them can be RENDERED
 * here. The honest guard at this level is the source symbol, scoped to the obligations
 * `deprem-sayfalari` plan §5.6/§5.7/§5.8/§5.13 name explicitly.
 *
 * T-036 deleted `earthquake-map.tsx` and `earthquake-filters.tsx` (the V1 `/deprem` island —
 * no Next.js entry point reached either; `/deprem` renders `V2EarthquakeExplorer`). The §5.6
 * map assertions and the map half of the `lang="tr"` pair went with the files they described;
 * every rule below still has a live subject.
 *
 * Every assertion below is about STRUCTURE — an absence, a wrapper, a reference to a shared
 * token/helper. None is about a fact or a wording choice.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** Source with comments removed, matching `air-pollution.structure.test.ts`'s own reasoning:
 *  a docblock explaining WHY there is no raw hex/no `"use client"` contains those very words. */
const code = stripComments;

const list = read("./earthquake-list.tsx");
const badge = read("./magnitude-badge.tsx");
const attribution = read("./earthquake-attribution.tsx");
const listCode = code(list);
const badgeCode = code(badge);
const attributionCode = code(attribution);

describe("EarthquakeList / MagnitudeBadge are hook-free (§5.5's dual-context requirement)", () => {
  it('ships no "use client" in the list or badge', () => {
    for (const source of [listCode, badgeCode]) {
      expect(source).not.toMatch(/["']use client["']/);
    }
  });

  it("calls no server-only next-intl hook — the presentational split that lets a client caller reuse them", () => {
    for (const source of [listCode, badgeCode]) {
      expect(source).not.toMatch(/getTranslations|next-intl\/server/);
      expect(source).not.toMatch(/useTranslations/);
    }
  });

  it("the directive regex fires on source that does carry it — positive control", () => {
    // Without this, the absence checks above report clean for free if the regex itself were
    // broken. The control used to be `earthquake-filters.tsx`, the real client island; T-036
    // deleted it, so the control moves to fabricated source (the POSITIVE CONTROL pattern
    // `lib/tools/messages.test.ts` already uses) rather than being dropped — a positive
    // control pinned to a file is a liability the moment that file goes away.
    expect(code('"use client";\nexport function X() { return null; }')).toMatch(
      /["']use client["']/,
    );
  });
});

describe("MagnitudeBadge never encodes magnitude by colour alone (DESIGN §6.1 rule 3)", () => {
  it("always prints the numeric magnitude label, not just a colour swatch", () => {
    expect(badgeCode).toMatch(/M \{label\}/);
  });
});

describe("EarthquakeList's bindingKind sentence is gated, never printed for every row (§5.7)", () => {
  it("gates the binding note on bindingSentenceKey, never a naive province sentence for every row", () => {
    expect(listCode).toMatch(/bindingSentenceKey\(event\.bindingKind\)/);
    // The gate must require BOTH a non-null key AND a resolved province — losing either half
    // would either misfire on "inside" rows or print a sentence with no real place name.
    expect(listCode).toMatch(/key !== null && province !== null/);
  });

  it('renders no literal "X ili yakınında"/"an earthquake in" location claim', () => {
    // The exact wrong sentence shape §5.7 exists to prevent — a naive province-location
    // claim would defeat the whole gate even while the gate itself is present. Checked
    // against COMMENT-STRIPPED source: the docblock above quotes the forbidden shape as a
    // negative example, which would otherwise self-trigger this exact assertion
    // (`air-pollution.structure.test.ts`'s own documented trap).
    expect(listCode).not.toMatch(/earthquake (occurred|happened) in/i);
    expect(listCode).not.toMatch(/'?te deprem/i);
  });
});

describe('EarthquakeList marks placeNameTr lang="tr" too (WCAG 3.1.2, review VAL104-M1)', () => {
  // `event.placeNameTr` is Turkish in BOTH locales (§5.7's own docblock) and prints once per
  // row (up to 200 per page) — the exact "TR-only string" class the attribution test below
  // already names, just on a different file. Previously only the two attribution strings were
  // covered here, though the attribution test's own name claimed "every TR-only string" —
  // this describe block closes that gap directly rather than widening the attribution test's
  // scope. (The `EarthquakeMap` half went with the file itself in T-036.)
  it('EarthquakeList wraps the visible placeNameTr span in lang="tr"', () => {
    expect(listCode).toMatch(/lang="tr"[\s\S]{0,40}\{event\.placeNameTr\}/);
  });
});

describe("EarthquakeAttribution renders API strings verbatim, never re-authors them (§5.8)", () => {
  it("reads requiredNoticeTr/regulationReference/disclaimerTr from props, never hardcodes them", () => {
    expect(attributionCode).toMatch(/attribution\.requiredNoticeTr/);
    expect(attributionCode).toMatch(/attribution\.regulationReference/);
    expect(attributionCode).toMatch(/\{disclaimerTr\}/);
    // No hardcoded provider sentence anywhere in this file's own source — the string must
    // come from the payload, never be minted here.
    expect(attributionCode).not.toMatch(/Kaynak: T\.C\./);
  });

  it('marks every TR-only string lang="tr" — including on the EN page (WCAG 3.1.2)', () => {
    /**
     * Asserted per ELEMENT rather than by proximity. The original form allowed 80 characters
     * between `lang="tr"` and the string, which is a proxy for "on the same element" — and it
     * broke the moment T-032 PR3 gave these two paragraphs a `className` (they had been styled
     * by a CSS module whose raw Terra tokens left the mandated notice at ~2.3:1 in dark mode).
     * The attribute count is not the rule; being on the element that carries the Turkish string
     * is, and matching the whole opening tag says exactly that with no distance budget to blow.
     */
    const elementsCarrying = (needle: string) =>
      [...attributionCode.matchAll(/<(\w+)\b([^>]*)>/g)].filter((tag, index, all) => {
        const openEnd = tag.index! + tag[0].length;
        const next = all[index + 1];
        const body = attributionCode.slice(openEnd, next ? next.index! : attributionCode.length);
        return body.includes(needle);
      });

    for (const needle of ["attribution.requiredNoticeTr", "{disclaimerTr}"]) {
      const owners = elementsCarrying(needle);
      // Anti-vacuity: the string must be rendered at all for the lang mark to mean anything.
      expect(owners.length, `${needle} is not rendered`).toBeGreaterThan(0);
      for (const tag of owners) {
        expect(tag[2], `${needle} is not inside a lang="tr" element`).toContain('lang="tr"');
      }
    }
  });

  it("carries no client directive — attribution is server-rendered with the page", () => {
    expect(attributionCode).not.toMatch(/["']use client["']/);
  });
});
