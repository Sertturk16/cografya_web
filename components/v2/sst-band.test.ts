import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SST_BANDS } from "@/lib/theme/sst-band-palette.test";
import {
  SST_BAND_STYLE,
  SST_BAND_MIN_C,
  bandOfSst,
  sstBandStyleOf,
  type SstBand,
} from "@/lib/theme/sst-band";

const BANDS = Object.keys(SST_BANDS) as SstBand[];

/** See `components/v2/basin-identity.test.ts` for why this is a local copy, not an import. */
const RAW_HUE =
  /\b(?:text|bg|border|from|to|via|ring|fill|stroke|decoration|outline|shadow|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

describe("one module spells the SST ramp", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../../lib/theme/sst-band.ts", import.meta.url)),
    "utf8",
  );

  it("holds no raw palette hue of its own", () => {
    expect(source.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it("has one entry per band, and each entry knows its own name", () => {
    expect(Object.keys(SST_BAND_STYLE).sort()).toEqual([...BANDS].sort());
    for (const band of BANDS) expect(SST_BAND_STYLE[band].band).toBe(band);
  });

  it.each(BANDS)("%s names no band token but its own", (band) => {
    const named = new Set<string>();
    for (const cls of Object.values(SST_BAND_STYLE[band])) {
      for (const m of cls.matchAll(/--sst-band-([a-z]+?)(?:-tint|-text)?[,)]/g)) named.add(m[1]!);
    }
    expect(named.size, `${band} references no --sst-band-* token`).toBeGreaterThan(0);
    expect([...named]).toEqual([band]);
  });

  it.each(BANDS)("%s's fillValue carries the value app/globals.css declares", (band) => {
    // The pin's OTHER half lives in `components/ui/token-binding.test.ts`, which compares every
    // `var(--token, #hex)` in the tree against the stylesheet. This half says the fallback also
    // matches the table the palette test measures the ramp FROM, so a token and a measurement
    // that drift apart fail here even if the stylesheet and the fallback still agree.
    const match = /var\(--sst-band-[a-z]+,\s*(#[0-9a-f]{6})\)/.exec(SST_BAND_STYLE[band].fillValue);
    expect(match, `${band}.fillValue is not a var() with a literal fallback`).not.toBeNull();
    expect(match![1]).toBe(SST_BANDS[band]);
  });
});

/**
 * The classifier both call sites now share.
 *
 * Before T-031c the map pins and the table chips each carried their own copy of these
 * thresholds. They happened to agree; nothing made them.
 */
describe("a reading falls in exactly one band", () => {
  it("puts the boundaries where the tokens say they are", () => {
    expect(SST_BAND_MIN_C).toEqual({ warm: 25, hot: 28 });
  });

  it.each([
    [-2, "cool"],
    [24.9, "cool"],
    [25, "warm"],
    [27.99, "warm"],
    [28, "hot"],
    [40, "hot"],
  ] as const)("%s °C is %s", (sst, band) => {
    expect(bandOfSst(sst)).toBe(band);
  });

  it("puts a missing reading in the coolest band, as both call sites already did", () => {
    // Not an arbitrary default: a station with no model value has to render SOME chip or the
    // column gains a hole, and the two spellings this module replaced both fell through to the
    // cool branch. Pinned so the behaviour is a decision rather than a leftover.
    expect(bandOfSst(null)).toBe("cool");
    expect(bandOfSst(undefined)).toBe("cool");
  });

  it("hands back the style for the band it picked", () => {
    expect(sstBandStyleOf(30)).toBe(SST_BAND_STYLE.hot);
    expect(sstBandStyleOf(26)).toBe(SST_BAND_STYLE.warm);
    expect(sstBandStyleOf(10)).toBe(SST_BAND_STYLE.cool);
  });
});
