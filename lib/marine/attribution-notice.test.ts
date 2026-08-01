import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

/**
 * The ECMWF attribution block is the ONE user-facing string in this repo that may not be
 * edited for style, length or tone: ECMWF's licence requires it to be published VERBATIM
 * (NOVA, read first-hand from `apps.ecmwf.int/datasets/licences/general/` →
 * `Owner's Inbox/atif-dogrulama/brief.md` §1.2, ruled in DEC 2026-08-02c). It is therefore
 * pinned here byte-for-byte.
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
  "This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF). Source: www.ecmwf.int. This ECMWF data is published under a Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/. Modified: values are sampled from the source grid to selected points; no other modification.";

const ECMWF_DISCLAIMER =
  "ECMWF does not accept any liability whatsoever for any error or omission in the data, their availability, or for any loss or damage arising from their use.";

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
