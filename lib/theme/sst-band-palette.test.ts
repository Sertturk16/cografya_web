import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";
import { deltaE00 } from "./delta-e";

/**
 * The three `--sst-band-*` fills exactly as `app/globals.css` defines them.
 *
 * Duplicated here for the same reason the other three palette tests duplicate their sets: a
 * change to globals.css should make this file disagree loudly rather than quietly re-measure
 * whatever it now says.
 *
 * ## This set is a BINDING, not a design
 *
 * Sea-surface temperature is a geophysical scale, so it stays standard and is never restyled to
 * Terra — the rule that also keeps the earthquake magnitude ramp and the AQI bands standard.
 * These three values are the Tailwind v4 `-600` shade of the three families the ramp ALREADY
 * shipped in (`blue` / `teal` / `orange`), which is the shade the map pins already used. The
 * assertions below are therefore about fidelity to what shipped and about the ramp's ORDER,
 * not about a palette choice.
 *
 * ## Why a ramp is not measured the way a categorical set is
 *
 * `CATEGORICAL_MIN` does not apply. A categorical set has to keep every PAIR apart because its
 * members have no order to fall back on; an ordered ramp's neighbouring steps carry a
 * neighbouring meaning, and the reading itself is printed inside the chip. What matters here is
 * that adjacent steps are separable and that the sequence runs cool -> warm -> hot.
 */
export const SST_BANDS: Readonly<Record<string, string>> = {
  cool: "#155dfc", // blue-600,   < 25 °C
  warm: "#009689", // teal-600,   25-28 °C
  hot: "#f54900", // orange-600, >= 28 °C
};

/** The ordered steps, coolest first. The ORDER is the thing this set encodes. */
const RAMP = ["cool", "warm", "hot"] as const;

/**
 * The raw SVG `fill` hexes `v2-marine-map-explorer` painted its station pins with before
 * T-031c — Tailwind v3's blue-600 / teal-600 / orange-600, left behind by the v4 upgrade.
 *
 * Kept so the claim "the tokens are the shade the pins already used, refreshed to the palette
 * generation this repo ships" is a measurement rather than a sentence. If a future edit
 * re-points a band at a different family or shade, the distance below moves and this test says
 * by how much.
 */
const SHIPPED_PINS: Readonly<Record<string, string>> = {
  cool: "#2563eb",
  warm: "#0d9488",
  hot: "#ea580c",
};

/** Distance from the pin each band replaced, measured 2026-09-19. */
const PIN_DRIFT: Readonly<Record<string, number>> = { cool: 2.7, warm: 0.8, hot: 3.2 };

/** Adjacent-step separation, measured 2026-09-19. */
const ADJACENT: Readonly<Record<string, number>> = { "cool/warm": 40.4, "warm/hot": 56.9 };

describe("the three SST bands are the ramp that already shipped", () => {
  it("matches --sst-band-* in app/globals.css exactly, both directions", () => {
    // Comments stripped before parsing: the block above these declarations quotes the three
    // superseded v3 pin hexes in prose while explaining the binding, so an un-stripped parse
    // could be satisfied by a comment.
    const css = stripCssComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    const shipped: Record<string, string> = {};
    for (const match of css.matchAll(/--sst-band-([a-z]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      shipped[match[1]!] = match[2]!.toLowerCase();
    }
    expect(shipped, "app/globals.css declares no --sst-band-* custom properties").not.toEqual({});
    expect(shipped).toEqual(SST_BANDS);
  });

  it("stays within one palette generation of the pins it replaced — this is a binding", () => {
    for (const band of RAMP) {
      const seen = deltaE00(SST_BANDS[band]!, SHIPPED_PINS[band]!);
      expect(
        seen,
        `--sst-band-${band} is ${seen} from the pin it replaced (${SHIPPED_PINS[band]}); a ` +
          `geophysical ramp stays standard, so this token may be re-spelled but not re-designed`,
      ).toBe(PIN_DRIFT[band]);
    }
  });

  it("runs cool -> warm -> hot in luminance-independent hue order, not just in name", () => {
    // The ordering claim that matters to a reader is that the ramp reads cold to hot. Asserted
    // through the blue channel dominance of `cool` and the red channel dominance of `hot`,
    // which is what "reads as temperature" means for this ramp, rather than through a
    // luminance sort — the three steps are NOT monotone in luminance and are not meant to be.
    const rgb = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
    const [coolR, , coolB] = rgb(SST_BANDS.cool!);
    const [hotR, , hotB] = rgb(SST_BANDS.hot!);
    expect(coolB, "the cool band is blue-dominant").toBeGreaterThan(coolR!);
    expect(hotR, "the hot band is red-dominant").toBeGreaterThan(hotB!);
  });

  it("keeps adjacent steps separable", () => {
    // A sequential ramp is read by comparing neighbours, so the neighbours are what is pinned.
    // These are far larger than `CATEGORICAL_MIN` because the three families were never close;
    // the figures are here so a re-spelling that collapses two bands cannot land quietly.
    expect(deltaE00(SST_BANDS.cool!, SST_BANDS.warm!)).toBe(ADJACENT["cool/warm"]);
    expect(deltaE00(SST_BANDS.warm!, SST_BANDS.hot!)).toBe(ADJACENT["warm/hot"]);
  });

  it("has exactly three bands, and they are the three the thresholds name", () => {
    // < 25 / 25-28 / >= 28. A fourth band added to the token set without a threshold to go
    // with it, or a renamed one, breaks the binding in `lib/theme/sst-band.ts`.
    expect(Object.keys(SST_BANDS)).toEqual([...RAMP]);
  });
});
