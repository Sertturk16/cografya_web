import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { classConstant, renderSites } from "@/lib/test-support/converted-floor";

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

/**
 * THE EVENT TABLE'S 520px FLOOR, RE-PINNED WHERE IT NOW LIVES.
 *
 * `earthquake.module.css`'s `.table` had a `min-width: 520px` entry in
 * `components/css-module-fixed-widths.test.ts`, the census of fixed-`px` inline-axis
 * declarations that exists because one such declaration scrolled a province page sideways at
 * 320. T-033 task 6 deleted the stylesheet, the entry went with it, and the floor moved into
 * `TABLE` — where the census cannot read it and `pnpm sweep:overflow`, which is NOT in
 * `.github/workflows/ci.yml`, would have become its only cover. See
 * `lib/test-support/converted-floor.ts` for the rule and
 * `components/air/air-pollution.structure.test.ts` / `components/climate/d2-variant.test.ts`
 * for the two siblings.
 *
 * The floor is measured, not incidental: three columns of event data do not fit in 288px of
 * content box at a 320px viewport, so the table scrolls INSIDE the `SCROLL` box rather than
 * crushing its columns. That makes `overflow-x-auto` the other half of one mechanism — the
 * retired stylesheet said so in as many words ("`overflow-x` stays for the `min-width: 520px`
 * table on narrow viewports") — so it is asserted here too. With the floor and no
 * `overflow-x-auto`, 520px escapes the card and scrolls the page; with `overflow-x-auto` and no
 * floor, the columns squeeze and nothing scrolls. Neither half is enough on its own.
 *
 * HOIST FIRST, THEN PIN. `classConstant` reads a top-level `const NAME = "…";`. A floor left
 * inline on a JSX `className` is not one, so it returns `null` and every assertion built on it
 * asserts nothing — with the suite green. The last control below is exactly that case, run
 * against a DE-HOISTED copy of this file's own source rather than an invented string.
 */
describe("the event table keeps its measured 520px floor", () => {
  const FLOOR = "min-w-[520px]";

  it("TABLE still carries the floor", () => {
    const table = classConstant(listCode, "TABLE");
    expect(table, "earthquake-list.tsx has no TABLE constant").not.toBeNull();
    expect(table, `TABLE lost ${FLOOR}`).toContain(FLOOR);
    // A floor that stopped being a floor is the same loss as a deleted one.
    expect(table!.split(FLOOR).join(" ")).not.toMatch(/min-w-(0|full|fit|min|auto)\b/);
  });

  it("…on the constant the table actually renders", () => {
    // Half of "bidirectional": a pin that only reads the declaration stays green on a constant
    // nothing uses, so the floor could be deleted from the page while this file agreed.
    expect(renderSites(listCode, "TABLE")).toBe(1);
  });

  it("…inside a box that can scroll horizontally", () => {
    // The other half of the mechanism. Without this the floor is a page-widener, not a scroller.
    const scroll = classConstant(listCode, "SCROLL");
    expect(scroll, "earthquake-list.tsx has no SCROLL constant").not.toBeNull();
    expect(scroll, "SCROLL lost overflow-x-auto").toContain("overflow-x-auto");
    expect(renderSites(listCode, "SCROLL")).toBe(1);
  });

  it("POSITIVE CONTROL — the same reading reds when the floor is removed", () => {
    // Anti-vacuity, run against a MUTATION of the real declaration rather than an invented
    // string: take what the file really says and drop the floor to nothing.
    const real = classConstant(listCode, "TABLE")!;
    const poisoned = real.split(FLOOR).join("min-w-0");
    expect(poisoned).not.toBe(real);
    expect(poisoned).not.toContain(FLOOR);
    expect(poisoned.split(FLOOR).join(" ")).toMatch(/min-w-(0|full|fit|min|auto)\b/);
  });

  it("POSITIVE CONTROL — de-hoisting the floor makes classConstant return null", () => {
    // THE FAILURE THIS PIN IS SHAPED AROUND, and the reason the conversion hoisted at all.
    // `classConstant` finds only a top-level `const`; a floor written inline on the JSX
    // `className` hands back `null`, and a pin that skipped `not.toBeNull()` would then pass
    // every `toContain` it never ran. Built by DE-HOISTING this file's real subject, so the
    // control cannot drift from what it is controlling for.
    const real = classConstant(listCode, "TABLE")!;
    const value = /"([^"]*)"/.exec(real)![1]!;
    const deHoisted = listCode
      .replace(real, "")
      .split("className={TABLE}")
      .join(`className="${value}"`);
    expect(deHoisted).toContain(value);
    expect(classConstant(deHoisted, "TABLE")).toBeNull();
    expect(renderSites(deHoisted, "TABLE")).toBe(0);
  });
});
