import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * THE VERSION IDENTITY IS NEVER WRITTEN IN THIS REPO.
 *
 * The costliest defect api PR #123's own review rounds closed was a version identity
 * declared in several places with nothing binding them: at the next annual refresh an
 * operator updates one of them, every check stays green, and the pages publish new numbers
 * under a licence block naming the OLD licensed work — beside a provider caveat quoted
 * verbatim for a version whose wording the ledger records as different.
 *
 * The same trap can be set on this side, and this file is the tripwire. `V6.GL.03` reaches
 * a reader only through `pm25Annual.datasetVersion` and `attribution.workTitle`. It may not
 * appear in a message catalogue, a component, a stylesheet or a lib module.
 *
 * The pattern is deliberately GENERIC (`V<digits>.GL.<anything>`) rather than the literal
 * current version: pinning `V6.GL.03` would go quiet the day someone hardcodes `V7.GL.01`,
 * which is precisely the day it matters.
 */

const VERSION_PATTERN = /V\d+\.GL\./;

const SOURCES = [
  "../../components/air/air-pollution-section.tsx",
  "../../components/air/pm25-chart.tsx",
  "../../components/air/pm25-table.tsx",
  "../../components/air/air-pollution.module.css",
  "./pm25-scale.ts",
  "./pm25-display.ts",
  "./notice-keys.ts",
] as const;

describe("dataset version drift guard", () => {
  it("finds no version literal in either message catalogue", () => {
    expect(JSON.stringify(trMessages)).not.toMatch(VERSION_PATTERN);
    expect(JSON.stringify(enMessages)).not.toMatch(VERSION_PATTERN);
  });

  it.each(SOURCES)("finds no version literal in %s", (path) => {
    expect(readFileSync(new URL(path, import.meta.url), "utf8")).not.toMatch(VERSION_PATTERN);
  });

  it("POSITIVE CONTROL — the same scan fires on an injected literal", () => {
    // Without this, a broken regex would report "clean" forever. The token is injected into
    // an in-memory copy and never written to any file this suite measures.
    const poisoned = JSON.stringify({ ...trMessages, __probe: "SatPM₂.₅ V6.GL.03" });
    expect(poisoned).toMatch(VERSION_PATTERN);
    expect(`.someClass { content: "V7.GL.01"; }`).toMatch(VERSION_PATTERN);
  });
});

/**
 * The same discipline for the provider's licence text: it lives in the PAYLOAD, so this
 * repo must not carry a second copy that can drift out of step with it.
 */
describe("no second copy of the provider's licensed strings", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it.each(SOURCES)("keeps the method caveat out of %s", (path) => {
    expect(read(path)).not.toContain("primarily intended to aid in large-scale studies");
  });

  it("keeps ACAG's own elements out of the catalogues this section reads", () => {
    // SCOPED to the air-pollution namespace and its province-page keys, deliberately. A
    // whole-catalogue scan for "Creative Commons Attribution 4.0 International" fires on
    // the MARINE notice, which legitimately names that licence for a different provider —
    // a false positive that says nothing about THIS section. What matters here is that
    // ACAG's elements arrive from the payload and are not duplicated in copy.
    for (const catalogue of [trMessages, enMessages]) {
      const scoped = JSON.stringify({
        AirPollution: catalogue.AirPollution,
        sourcesPm25: catalogue.ProvinceDetail.sourcesPm25,
        airPollutionHeading: catalogue.ProvinceDetail.airPollutionHeading,
      });
      expect(scoped).not.toContain("Atmospheric Composition Analysis Group");
      expect(scoped).not.toContain("acsestair");
      expect(scoped).not.toContain("Creative Commons Attribution");
      expect(scoped).not.toContain("satpm.org");
    }
  });

  it("POSITIVE CONTROL — the scoped scan fires when an element IS pasted into copy", () => {
    // Proves the narrowing above did not narrow the check into never matching anything.
    const poisoned = JSON.stringify({
      AirPollution: {
        ...trMessages.AirPollution,
        whoGuideline: "Atmospheric Composition Analysis Group",
      },
    });
    expect(poisoned).toContain("Atmospheric Composition Analysis Group");
  });

  it("POSITIVE CONTROL — the same substring scan fires when the text IS present", () => {
    expect(
      "Note that these estimates are primarily intended to aid in large-scale studies.",
    ).toContain("primarily intended to aid in large-scale studies");
  });
});
