import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

/**
 * The climate series' provider attribution is one of the user-facing strings in this repo
 * that may not be edited for style, length or tone: CC-BY-4.0 requires it to be published
 * VERBATIM. The wording is recorded in the root `data-provenance.md` §0b (the ERA5-Land /
 * C3S entry, landed with api PR #87 on 2026-08-04) and is pinned here byte-for-byte —
 * exactly the treatment `lib/marine/attribution-notice.test.ts` gives the ECMWF and
 * Copernicus Marine notices.
 *
 * WHY THIS IS NOT A FACT LITERAL (`CONVENTIONS.md` §2). The no-hardcoded-facts rule exists
 * so a test never asserts a claim about the world that can legitimately change — a
 * population, a coastline, an annual mean. This is the opposite: a LEGAL text whose whole
 * value is that it cannot change without permission. Pinning it is what the rule is for.
 *
 * WHAT IT CATCHES. The periodic copy-slim passes over `messages/*.json` (CONTENT-STYLE §22)
 * are exactly the kind of change that would "tidy" the second sentence away as boilerplate,
 * or translate the block into Turkish because it sits on a Turkish page. Either is a licence
 * breach invisible until an audit.
 */

/**
 * ⚠ THE YEAR IS PART OF THE PINNED TEXT. DO NOT MAKE IT DYNAMIC.
 *
 * C3S's template is "Generated using Copernicus Climate Change Service information [Year]",
 * where the year states when the Copernicus information was generated — NOT when the page is
 * rendered. This series comes from a committed 2026 artifact whose numbers do not change, so
 * a `new Date().getFullYear()` read would silently claim 2027, 2028, … for 2026 data. The
 * year moves only when the underlying artifact is regenerated, which is a deliberate data
 * change with its own `data-provenance.md` entry.
 *
 * The second sentence is a disclaimer of responsibility, not decoration: it names both the
 * European Commission and ECMWF. `CONVENTIONS.md` §7's no-endorsement corollary applies on
 * top — the notice states the SOURCE, and no wording near it may imply that C3S, Copernicus,
 * the European Commission or ECMWF endorses this platform.
 */
const C3S_NOTICE =
  "Generated using Copernicus Climate Change Service information 2026. Neither the " +
  "European Commission nor ECMWF is responsible for any use that may be made of the " +
  "Copernicus information or data it contains.";

describe("the C3S / ERA5-Land attribution is verbatim", () => {
  it("pins the required notice in en.json", () => {
    expect(en.Climate.attribution.c3sNotice).toBe(C3S_NOTICE);
  });

  it("ships the same untranslated notice in tr.json", () => {
    // Not "a Turkish equivalent" — the identical English text. The Turkish page renders this
    // exact sentence pair inside `lang="en"`, with the Turkish explanation alongside it
    // (`Climate.sourceC3sNoticeIntro`) rather than instead of it. Only a byte comparison
    // proves the two catalogues have not drifted.
    expect(tr.Climate.attribution.c3sNotice).toBe(C3S_NOTICE);
  });

  it("keeps the responsibility disclaimer, which names both institutions", () => {
    // Called out separately from the byte pin: this is the sentence a copy pass is most
    // likely to read as redundant legalese and drop.
    expect(en.Climate.attribution.c3sNotice).toContain(
      "Neither the European Commission nor ECMWF is responsible",
    );
  });

  it("states a data year, not a rendering year", () => {
    // A guard against someone converting the literal into an ICU `{year}` placeholder fed
    // by the wall clock — which would restate the provenance of unchanged data every
    // January. If the artifact is genuinely regenerated, this test is updated with it.
    expect(en.Climate.attribution.c3sNotice).not.toContain("{year}");
    expect(tr.Climate.attribution.c3sNotice).not.toContain("{year}");
  });
});

/**
 * THE NOTICE TRAVELS WITH THE MATERIAL.
 *
 * The byte pins above prove the string is intact. They cannot prove it is on the page that
 * carries the values. This repo's vitest environment is `node` and the climate section is an
 * async server component, so it cannot be rendered here; the honest guard at this level is
 * the source symbol, scoped to the one component the obligation is about.
 */
describe("the climate section renders the notice next to the values", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const section = read("../../components/climate/climate-section.tsx");

  it("renders the verbatim notice", () => {
    expect(section).toMatch(/attribution\.c3sNotice/);
  });

  it('marks it `lang="en"` so AT does not read English with Turkish phonemes', () => {
    expect(section).toMatch(/lang="en"/);
  });

  it("keeps the Turkish explanation alongside it, never instead of it", () => {
    expect(section).toMatch(/sourceC3sNoticeIntro/);
  });

  it("keeps the licence text out of the component source — one copy, in messages", () => {
    // A second copy of a verbatim licence is a breach waiting for the day someone edits one
    // of them. The component references the key; the text lives only in the catalogues.
    expect(section).not.toContain("Generated using Copernicus Climate Change Service");
  });
});
