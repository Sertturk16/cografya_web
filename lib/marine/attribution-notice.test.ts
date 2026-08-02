import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

/**
 * The provider attribution blocks are the user-facing strings in this repo that may not be
 * edited for style, length or tone: their licences require them to be published VERBATIM.
 * ECMWF's wording was read first-hand by NOVA from
 * `apps.ecmwf.int/datasets/licences/general/` (→ `Owner's Inbox/atif-dogrulama/brief.md`
 * §1.2, ruled in DEC 2026-08-02c); the Copernicus Marine sentence comes from M4a's
 * machine-verified licence record (`Owner's Inbox/marine-m4/m4a-closing-summary.md`, Atlas
 * ruling 2026-08-02). Both are pinned here byte-for-byte.
 *
 * WHY THIS IS NOT A FACT LITERAL (`CONVENTIONS.md` §2). The no-hardcoded-facts rule exists
 * so a test never asserts a claim about the world that can legitimately change — a
 * population, a coastline, a provider assignment. These strings are the opposite: a LEGAL
 * text whose whole value is that it cannot change without permission. Pinning it is what
 * the rule is for, not what it forbids.
 *
 * WHAT IT CATCHES. This repo runs periodic copy-slim passes over `messages/*.json` (§22).
 * A pass that tightened "Modified: values are sampled from the source grid to selected
 * points; no other modification." out of the notice would drop the modification statement
 * CC BY 4.0 requires when the source is altered — a licence breach invisible until an
 * audit. It also pins the block in `tr.json`: the TR page renders the SAME English text
 * (inside `lang="en"`), so a divergence between the two files means one locale is shipping
 * an altered licence notice.
 */

const ECMWF_COPYRIGHT =
  "Copyright © {year} European Centre for Medium-Range Weather Forecasts (ECMWF).";

const ECMWF_NOTICE =
  "This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF). Source www.ecmwf.int. This ECMWF data is published under a Creative Commons Attribution 4.0 International (CC BY 4.0). https://creativecommons.org/licenses/by/4.0/. Modified: values are sampled from the source grid to selected points; no other modification.";

const ECMWF_DISCLAIMER =
  "ECMWF does not accept any liability whatsoever for any error or omission in the data, their availability, or for any loss or damage arising from their use.";

/**
 * The Copernicus Marine Service's required notice — one sentence, and the whole obligation
 * for the sea surface temperature and wave values this platform derives from it.
 *
 * Pinned with the same force as the ECMWF block, and for a sharper reason: it is SHORT. A
 * copy pass that would never dare touch a paragraph of legal English will happily "fix"
 * "E.U." to "EU", drop the full stops, or translate a single sentence into Turkish — and any
 * one of those is a licence breach. `CONVENTIONS.md` §7's no-endorsement corollary applies
 * on top: the notice states the SOURCE, and no wording near it may imply the EU or the
 * service endorses this platform.
 */
const CMEMS_NOTICE = "Generated using E.U. Copernicus Marine Service Information";

describe("ECMWF attribution strings are verbatim", () => {
  it("pins the copyright template in en.json", () => {
    expect(en.Marine.attribution.ecmwfCopyright).toBe(ECMWF_COPYRIGHT);
  });

  it("pins the attribution notice in en.json", () => {
    expect(en.Marine.attribution.ecmwfNotice).toBe(ECMWF_NOTICE);
  });

  it("pins the liability disclaimer in en.json", () => {
    expect(en.Marine.attribution.ecmwfDisclaimer).toBe(ECMWF_DISCLAIMER);
  });

  it("ships the same untranslated block in tr.json", () => {
    // Not "a Turkish equivalent" — the identical English text. The TR page renders the
    // verbatim notice too, and only a byte comparison proves the two files have not drifted.
    expect(tr.Marine.attribution.ecmwfCopyright).toBe(ECMWF_COPYRIGHT);
    expect(tr.Marine.attribution.ecmwfNotice).toBe(ECMWF_NOTICE);
    expect(tr.Marine.attribution.ecmwfDisclaimer).toBe(ECMWF_DISCLAIMER);
  });

  it("keeps the modification statement CC BY 4.0 requires", () => {
    // Called out separately from the byte pin above: this clause is the one a copy-slim
    // pass is most likely to read as redundant prose, and it is the one the licence adds
    // the moment the source data is altered.
    expect(en.Marine.attribution.ecmwfNotice).toContain(
      "Modified: values are sampled from the source grid to selected points",
    );
  });
});

describe("Copernicus Marine attribution is verbatim", () => {
  it("pins the required notice in en.json", () => {
    expect(en.Marine.attribution.cmemsNotice).toBe(CMEMS_NOTICE);
  });

  it("ships the same untranslated sentence in tr.json", () => {
    // The Turkish page renders this exact English sentence inside `lang="en"`, with the
    // Turkish explanation alongside it (`Deniz.sourceCmemsNoticeIntro`) rather than instead
    // of it. Only a byte comparison proves the two catalogues have not drifted.
    expect(tr.Marine.attribution.cmemsNotice).toBe(CMEMS_NOTICE);
  });

  it("names the service exactly as the licence does", () => {
    // Called out separately from the byte pin: "E.U." with both full stops and the full
    // service name are the two parts a copy pass is most likely to tidy away.
    expect(en.Marine.attribution.cmemsNotice).toContain("E.U. Copernicus Marine Service");
  });
});

/**
 * THE NOTICE TRAVELS WITH THE MATERIAL (W2b).
 *
 * The byte pins above prove the strings are intact. They cannot prove the strings are on the
 * page that carries the values, and from W2b that page is 27 province pages as well as
 * `/deniz` — the exact obligation CC BY 4.0 and ECMWF's "shall be attached" wording impose
 * (→ DEC 2026-08-02c). Deleting the block from `/turkiye/[slug]` would leave every assertion
 * in this file green while publishing derived ECMWF and Copernicus material with no
 * attribution at all.
 *
 * This repo's vitest environment is `node` and both pages are async server components, so
 * they cannot be rendered here; the honest guard at this level is the source symbol, scoped
 * to the two files the obligation is about.
 */
describe("the attribution block is rendered on every surface that shows derived values", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  const hub = read("../../app/[locale]/deniz/page.tsx");
  const province = read("../../app/[locale]/turkiye/[slug]/page.tsx");
  const section = read("../../components/marine/province-marine-section.tsx");

  it("renders it on the /deniz hub", () => {
    expect(hub).toMatch(/<MarineAttribution\b/);
  });

  it("renders it on the province page", () => {
    expect(province).toMatch(/<MarineAttribution\b/);
  });

  it("gates the province block on the SAME signal as the province's values", () => {
    // Not "a boolean that happens to be true at the same time": literally the one signal the
    // section reads, so the notice can neither go missing where a value appears nor appear
    // where none does.
    expect(province).toMatch(/showMarine && \(\s*<ProvinceMarineSection/);
    expect(province).toMatch(/showMarine && \(\s*<MarineAttribution/);
  });

  it("keeps the licence text out of the section component — one copy, two render sites", () => {
    // A second copy of a verbatim licence is a breach waiting for the day someone edits one
    // of them. The section renders values; the notice stays in its own single-sourced block.
    // Asserted against the licence TEXT and against a second translation call site — not
    // against the provider names, which a code comment may legitimately mention.
    expect(section).not.toContain(CMEMS_NOTICE);
    expect(section).not.toContain("This service is based on data and products");
    expect(section).not.toMatch(/attribution\.(ecmwf|cmems)/);
  });
});
