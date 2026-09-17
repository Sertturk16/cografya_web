import { describe, expect, it } from "vitest";
import { gatesGoverning, ungatedRenderSite } from "./jsx-gate";

/**
 * The probe that several licence and sovereignty guards now rest on, tested directly.
 *
 * Those guards report "every render site is governed by X". A probe that quietly matched nothing
 * would report exactly the same thing, so the probe's own ability to say NO is the load-bearing
 * property here — not its ability to say yes.
 */
describe("gatesGoverning", () => {
  it("reads the condition above a `&&` render site", () => {
    const source = `{showMarine && (\n  <MarineAttribution layers={layers} />\n)}`;
    expect(gatesGoverning(source, "<MarineAttribution")).toEqual([
      expect.stringContaining("showMarine"),
    ]);
  });

  it("reads it when the branch body needs no parentheses", () => {
    // `{signal && <Tag />}` is what Prettier writes as soon as the branch fits on one line, and
    // it is the SAME gate as the parenthesised form. Before this case existed the probe skipped
    // such a site and reported the gate of whatever `&& (` came earlier IN THE FILE — so a guard
    // asking about one component silently answered about another. The province page's
    // `{showMarine && <MarineDataNotice />}` reported the earthquake section's gate.
    const source = [
      "{provinceEarthquakes !== null && earthquakeMeta !== null && (",
      "  <EarthquakeAttribution />",
      ")}",
      "{showMarine && <MarineDataNotice />}",
    ].join("\n");

    expect(gatesGoverning(source, "<MarineDataNotice")).toEqual([
      expect.stringContaining("showMarine"),
    ]);
    expect(ungatedRenderSite(source, "<MarineDataNotice", "showMarine")).toBeNull();
    expect(gatesGoverning(source, "<MarineDataNotice")[0]).not.toContain("earthquakeMeta");
  });

  it("reads the condition above each branch of a chained ternary", () => {
    // The V2 shape that broke the old spelling-pinned guards: one component, two render sites,
    // each under a different arm of the same chain.
    const source = [
      "{pm25Annual && showMarine ? (",
      "  <AirPollutionSection /><ProvinceMarineSection />",
      ") : pm25Annual ? (",
      "  <AirPollutionSection />",
      ") : showMarine ? (",
      "  <ProvinceMarineSection />",
      ") : null}",
    ].join("\n");

    const marine = gatesGoverning(source, "<ProvinceMarineSection");
    expect(marine).toHaveLength(2);
    for (const gate of marine) expect(gate).toContain("showMarine");

    const air = gatesGoverning(source, "<AirPollutionSection");
    expect(air).toHaveLength(2);
    for (const gate of air) expect(gate).toContain("pm25Annual");
  });

  it("does not read a neighbouring branch's condition into this one", () => {
    // The whole risk of a fixed-width window: if it over-reaches it reports the previous arm's
    // signal and every drift check passes for free.
    const source = [
      "{showMarine ? (",
      "  <Values />",
      ") : alwaysTrue ? (",
      "  <Notice />",
      ") : null}",
    ].join("\n");
    expect(gatesGoverning(source, "<Notice")[0]).not.toContain("showMarine");
  });

  it("throws rather than reporting clean when a render site has no conditional above it", () => {
    expect(() =>
      gatesGoverning("<MarineAttribution layers={layers} />", "<MarineAttribution"),
    ).toThrow(/not inside a conditional branch/);
  });

  it("returns an empty list when the component is not rendered at all", () => {
    // Callers must treat this as "nothing to check" and assert the absence themselves; the probe
    // has no opinion about whether a missing component is a bug.
    expect(gatesGoverning("<Other />", "<MarineAttribution")).toEqual([]);
  });
});

describe("ungatedRenderSite", () => {
  it("names the drifted site", () => {
    const source = [
      "{showMarine ? (",
      "  <ProvinceMarineSection />",
      ") : null}",
      "{layers.length > 0 && (",
      "  <MarineAttribution />",
      ")}",
    ].join("\n");

    expect(ungatedRenderSite(source, "<ProvinceMarineSection", "showMarine")).toBeNull();
    expect(ungatedRenderSite(source, "<MarineAttribution", "showMarine")).toContain(
      "layers.length",
    );
  });
});
