import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../lib/test-support/strip-comments";
import enMessages from "../../messages/en.json";
import trMessages from "../../messages/tr.json";

/**
 * BINDING GUARD for `V2SourcesSection`'s conditional citation props.
 *
 * The bibliography used to be a flat per-scope list: every province page cited the same eight
 * sources whatever it rendered. That is wrong in both directions at once, and T-032 PR3 found
 * both while re-pointing the V1 integration tests at the V2 pages:
 *
 *  - UNDER-citing. The `turkiye` scope carries no marine source, yet 27 coastal provinces render
 *    CMEMS/ECMWF-derived sea-surface temperature. ECMWF's terms say the notice "shall be
 *    attached" and, unlike the Copernicus framework, admit no "or similar" wording — so the
 *    missing citation was a licence breach, not a style lapse. This is what V1's
 *    `MarineAttribution` component existed to prevent; the V2 rewrite dropped the component and
 *    nothing took over the duty.
 *  - OVER-citing. `acag-pm25` sat in the `turkiye` list unconditionally while the air-quality
 *    section renders only when the API published a series, so provinces with no PM2.5 figure
 *    still sourced one.
 *
 * `include`/`omit` fix both, and this test is what keeps them honest: an id that does not
 * resolve renders nothing at all and would fail silently in the browser.
 *
 * Structural only (`CONVENTIONS.md` §2): ids and gate expressions, never blurb copy.
 */

const componentSource = readFileSync(
  fileURLToPath(new URL("./v2-sources-section.tsx", import.meta.url)),
  "utf8",
);

const KNOWN_IDS = new Set(
  [...componentSource.matchAll(/^\s+id: "([^"]+)",$/gm)].map((match) => match[1]!),
);

const appDir = fileURLToPath(new URL("../../app/[locale]/", import.meta.url));
const walkPages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });

interface CallSite {
  page: string;
  prop: "include" | "omit";
  ids: string[];
}

/** Pages rendering the component at all, whether or not they pass `include`/`omit`. */
const renderingPages: string[] = walkPages(appDir).filter((page) =>
  // Comments stripped: four `/dunya` pages now explain in a block comment why they render NO
  // sources section, and the component's name is in every one of those explanations.
  stripComments(readFileSync(page, "utf8")).includes("<V2SourcesSection"),
);

const callSites: CallSite[] = renderingPages.flatMap((page) => {
  const code = stripComments(readFileSync(page, "utf8"));
  return [...code.matchAll(/<V2SourcesSection\b[\s\S]*?\/>/g)].flatMap((element) =>
    (["include", "omit"] as const).flatMap((prop) => {
      const propMatch = new RegExp(`${prop}=\\{([^}]*)\\}`).exec(element[0]);
      if (propMatch === null) return [];
      const ids = [...propMatch[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
      return [{ page: page.slice(appDir.length), prop, ids }];
    }),
  );
});

describe("V2SourcesSection's conditional citations", () => {
  it("names only source ids that actually resolve", () => {
    /**
     * ANTI-VACUITY, WITH TEETH. This was `toBeGreaterThan(0)`, which a walk that found one page
     * out of twenty-two satisfies — and the walk is the part most likely to break silently, since
     * a renamed directory or a reformatted call site costs it matches without costing it a
     * failure. Exact counts instead: 22 pages render the component and 7 of their call sites pass
     * `include`/`omit`. Both are load-bearing, so adding or removing a sources section is a
     * deliberate edit here, which is the point — the numbers moved for this task because four
     * `/dunya` pages stopped citing a bibliography they could not trace.
     */
    expect(renderingPages.length, "pages rendering <V2SourcesSection>").toBe(22);
    expect(callSites.length, "V2SourcesSection include/omit call sites").toBe(7);
    expect(KNOWN_IDS.size, "source ids declared in v2-sources-section.tsx").toBeGreaterThan(20);

    for (const { page, prop, ids } of callSites) {
      expect(ids.length, `${page} passes ${prop} with no ids`).toBeGreaterThan(0);
      for (const id of ids) {
        expect(KNOWN_IDS.has(id), `${page} ${prop}: unknown source id "${id}"`).toBe(true);
      }
    }
  });

  it("gates the province page's citations on the same signals its sections are gated on", () => {
    const province = readFileSync(
      fileURLToPath(new URL("../../app/[locale]/(site)/turkiye/[slug]/page.tsx", import.meta.url)),
      "utf8",
    );

    // Every section and every citation reads the SAME expressions. Bound this way the
    // bibliography cannot drift from the page: there is no second condition to forget.
    expect(province).toMatch(/include=\{showMarine \?/);
    expect(province).toMatch(/omit=\{\[\.\.\.\(pm25Annual \?/);
    expect(province).toMatch(/showMarine \? \(/);
    // `era5` had no `omit` counterpart at all. `climateSeries` is `isTr ? province.climate :
    // null`, so the climate block renders on no English province page while the ERA5-Land card
    // and its verbatim ECMWF quote were cited on all 81 of them.
    expect(province).toMatch(/\.\.\.\(climateSeries \? \[\] : \["era5"\]\)/);
    expect(province).toMatch(/\{climateSeries && \(/);
  });

  it("carries the verbatim licence text for the marine sources it now cites", () => {
    /**
     * The citation is only worth anything if the required wording travels with it — the rule
     * this assertion has always encoded, and it is still real. What changed is WHERE it is
     * asserted, because the old form asserted it of the wrong file and passed for the wrong
     * reason.
     *
     * It used to read `expect(componentSource).toContain("Generated using E.U. Copernicus
     * Marine Service Information")` — green only because the `home` scope's card carried a
     * SECOND copy of the notice, and a broken one: "…Information 2026". The Copernicus Marine
     * licence attaches its notice to the SERVICE, not to a data year, which is exactly why the
     * `deniz` scope's `cmems` entry had its near-copy removed. So the assertion was propping up
     * the defect it looked like it was guarding, and fixing the string would have turned it red.
     *
     * It now points at the SINGLE SOURCE OF TRUTH — the message catalogue, verbatim and
     * identical in both locales, rendered by `MarineAttribution` — and at the absence of any
     * second copy in this component. The bibliography card names the source; the licence lives
     * in the attribution block, which since the owner's centralization decision renders once,
     * on `/hakkimizda`, one hyperlink from every page that publishes a value (CC BY 4.0
     * §3(a)(2)). What this asserts is unchanged by that move and deliberately so: wherever the
     * block renders, this component may not carry a second copy of the string.
     */
    const REQUIRED = "Generated using E.U. Copernicus Marine Service Information";

    expect(trMessages.Marine.attribution.cmemsNotice).toBe(REQUIRED);
    expect(enMessages.Marine.attribution.cmemsNotice).toBe(REQUIRED);

    const attribution = readFileSync(
      fileURLToPath(new URL("../marine/marine-attribution.tsx", import.meta.url)),
      "utf8",
    );
    expect(attribution).toContain('tm("attribution.cmemsNotice")');

    // No second copy anywhere in the bibliography — a verbatim licence string with two homes is
    // a breach waiting for the day someone edits one of them, and this one already was one.
    expect(componentSource).not.toContain(REQUIRED);

    expect(componentSource).toMatch(/id: "ecmwf-marine"/);
    expect(componentSource).toMatch(/id: "cmems"/);
  });

  /**
   * THE OWNER'S RULING, in the only form a test can hold it.
   *
   * The rule itself — "a source card naming an institution appears only in a scope whose pages
   * can trace their data to it" — is not mechanically checkable: whether a page traces a figure
   * to the UN is a judgement about provenance, not a property of the source text, and a guard
   * that tried would either pass on everything or hard-code the answer it claims to derive.
   *
   * What IS checkable is the specific outcome of applying it: the `dunya` scope does not exist,
   * no page asks for it, and the note that used to ride inside that block still renders on both
   * pages that carry continent figures. Small, but each assertion can fail, and together they are
   * the thing that would silently come back — the block was easy to re-add precisely because it
   * looked like diligence.
   *
   * `scope` being a required prop of a closed union is the stronger half of this guard and is
   * not duplicated here: the compiler rejects `scope="dunya"` at every call site, including the
   * one someone writes next year. This covers what the compiler cannot see — the message keys and
   * the four pages' markup.
   */
  it("keeps the dunya bibliography gone and its methodology note rendering", () => {
    const component = stripComments(componentSource);
    // The scope and all five cards, not just the key. Comments stripped: the component documents
    // why each of them went, by name.
    expect(component).not.toMatch(/"dunya"/);
    expect(component).not.toMatch(/\bdunya: \[/);
    for (const id of ["natural-earth", "un-data", "cia-factbook", "usgs-nasa", "iho-gebco"]) {
      expect(component, `orphaned source card ${id}`).not.toContain(`id: "${id}"`);
    }
    // Anti-vacuity for the five above: the file must still declare source cards at all.
    expect(component).toContain('id: "tuik"');

    const pageSource = (relative: string) =>
      stripComments(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"));
    const dunyaPages = {
      hub: "../../app/[locale]/(site)/dunya/page.tsx",
      continents: "../../app/[locale]/(site)/dunya/kita/page.tsx",
      continent: "../../app/[locale]/(site)/dunya/kita/[slug]/page.tsx",
      country: "../../app/[locale]/(site)/dunya/[slug]/page.tsx",
    } as const;

    for (const [name, relative] of Object.entries(dunyaPages)) {
      const code = pageSource(relative);
      // Anti-vacuity: each read must be a real page before `not.toContain` means anything.
      expect(code, `${name} page body`).toContain("export default async function");
      expect(code, `${name} renders a sources section`).not.toContain("<V2SourcesSection");
    }

    // THE ONE THING THAT HAD TO SURVIVE. Not a citation — a methodology note saying the figures
    // are the platform's own, rounded for teaching, and will not match any one institution. It is
    // the most useful sentence on these two pages for a student, and it replaced a false
    // "cross-validated with UN M49, the World Bank and Britannica" claim, so losing it with the
    // block would have been a regression dressed as a cleanup.
    expect(pageSource(dunyaPages.continents)).toContain('t("continentFiguresNote")');
    expect(pageSource(dunyaPages.continent)).toContain('t("continentFiguresNoteNamed"');

    for (const [locale, messages] of Object.entries({ tr: trMessages, en: enMessages })) {
      for (const key of ["continentFiguresNote", "continentFiguresNoteNamed"] as const) {
        const value = (messages.Dunya as Record<string, unknown>)[key];
        expect(typeof value, `${locale}.json Dunya.${key}`).toBe("string");
        expect((value as string).length, `${locale}.json Dunya.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });
});
