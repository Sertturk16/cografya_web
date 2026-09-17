import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

const callSites: CallSite[] = walkPages(appDir).flatMap((page) => {
  const code = readFileSync(page, "utf8");
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
    // Anti-vacuity: a scan that matched nothing would satisfy the loop below trivially, and
    // this test's whole subject is call sites.
    expect(callSites.length, "V2SourcesSection include/omit call sites").toBeGreaterThan(0);
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
});
