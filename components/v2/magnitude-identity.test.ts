import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { MAGNITUDE_BUCKETS, MAGNITUDE_IDENTITY } from "@/lib/theme/magnitude-identity";

const RAW_HUE =
  /\b(?:text|bg|border|from|to|via|ring|fill|stroke|decoration|outline|shadow|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

const EXPLORER = "../../components/v2/v2-earthquake-explorer.tsx";
const read = (rel: string): string =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

/**
 * The explorer paints the magnitude ramp the module's way, and has no opinion of its own.
 *
 * A colour pin alone would have been the wrong guard here. The real defect was not that the
 * hues were raw — it was that this one file held a SECOND classifier (four steps, hue-ordered)
 * beside the product's own (five steps, lightness-ordered), spelled the ramp three times, and
 * applied one of those spellings to an SVG shape with a property SVG does not paint. Every
 * assertion below is about one of those four things, on source with comments STRIPPED, because
 * the file now explains all of them in prose.
 */
describe("the earthquake explorer reads the one magnitude ramp", () => {
  const source = read(EXPLORER);

  it("still is the explorer — positive control", () => {
    // Without this, every `not.toContain` below would pass against a renamed or emptied file.
    expect(source).toContain("V2EarthquakeExplorer");
    expect(source).toContain("Türkiye Son Depremler Haritası");
  });

  it("has no local magnitude-to-colour classifier left", () => {
    expect(source).not.toContain("getMagnitudeStyle");
    // The two dead fields that sat beside it and were read nowhere. Rebinding them would have
    // kept a second spelling of every step alive for no surface at all.
    expect(source).not.toMatch(/ring:\s*"/);
    expect(source).not.toMatch(/\bstyle\.(?:bg|text|border|ring)\b/);
    // Exactly three call sites — the map marker, the top-five list and the table row — each
    // resolving the step once for the event it is rendering.
    expect(source.match(/magnitudeIdentityOf\(/g)).toHaveLength(3);
  });

  it("classifies a magnitude ONTO THE RAMP nowhere but through that call", () => {
    // The file still compares magnitudes, and must: `getIntensityLabel` produces words, the
    // ripple and the accent ring appear above thresholds of their own, and that ring picks
    // between `stroke-destructive/70` and `stroke-primary/50` — semantic tokens, not the ramp.
    // What may never come back is a threshold that decides a RAMP colour, which is the shape
    // that let a four-step hue scale live beside the product's five-step lightness ramp.
    const comparisons = [...source.matchAll(/magnitude >= [\d.]+/g)];
    // Anti-vacuity: those thresholds must still be here, or the scan below reads nothing.
    expect(comparisons.length).toBeGreaterThan(0);
    for (const match of comparisons) {
      const window = source.slice(match.index!, match.index! + 300);
      expect(
        /--eq-mag-/.test(window) || new RegExp(RAW_HUE.source).test(window),
        `a magnitude threshold at offset ${match.index} decides a ramp colour: ${window.slice(0, 140)}`,
      ).toBe(false);
    }
    // The stronger half: the ramp's token name is not spelled in this file AT ALL. Every step
    // it paints arrives through the module, so there is nowhere for a fifth spelling to hide.
    expect(source).not.toContain("--eq-mag-");
  });

  it("paints the epicentre with the fill member, never a background", () => {
    // `bg-*` on an SVG `<circle>` paints nothing, so the markers rendered black while the legend
    // described four colours the map never drew. This is the assertion that says it cannot come
    // back: the marker reads `mark`, and `mark` is a `fill-*` class (pinned in
    // `lib/theme/magnitude-identity.test.ts`).
    expect(source).toContain("tone.mark");
    // Every OPENING `<circle` tag, self-closing or not — one of the four has `<animate>`
    // children, and a self-closing-only pattern silently skipped it.
    const circles = [...source.matchAll(/<circle\b[^>]*>/g)];
    expect(circles.length, "no <circle> found — this pin is looking at the wrong file").toBe(4);
    for (const circle of circles) {
      expect(
        /\bbg-/.test(circle[0]),
        `an SVG <circle> carries a bg- class, which it will never paint:\n${circle[0]}`,
      ).toBe(false);
    }
  });

  it("renders the legend FROM the ramp, so it cannot describe a scale the map does not draw", () => {
    expect(source).toContain("MAGNITUDE_BUCKETS.map");
    expect(source).toContain("MAGNITUDE_IDENTITY[bucket].swatch");
    expect(source).toContain("MAGNITUDE_IDENTITY[bucket].legend");
    // No hand-written range survives beside it. The legend printed four of these as literal JSX
    // text until T-031c, independently of the badges it explains.
    expect(source).not.toContain("M &lt; 3.0");
    expect(source).not.toContain("M &ge; 5.0");
  });

  it("marks selection with the token that exists for it, not with a fifth hue", () => {
    // The selected marker wears `--ring` on both the ripple and the accent ring. Its two
    // siblings on that same expression are already `stroke-destructive/70` and
    // `stroke-primary/50`, so selection needed a token that is neither.
    expect(source.match(/stroke-ring/g)).toHaveLength(2);
    expect(source).not.toContain("#f59e0b");
    // The three raw v3 hexes the ripple carried. A bare hex in a prop is a class to no scanner,
    // so nothing but this assertion would notice them returning.
    for (const hex of ["#dc2626", "#ea580c", "#059669"]) {
      expect(source, `the ripple's raw ${hex} is back`).not.toContain(hex);
    }
  });

  it("holds no raw palette hue by name", () => {
    // A ratchet the shared budget cannot give. Comments stripped: this file now explains the
    // four-step scale it replaced, and an un-stripped read would be tripped by the explanation.
    expect(source.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it("the module it reads is the one this file imports — not a lookalike", () => {
    expect(source).toContain('from "@/lib/theme/magnitude-identity"');
    expect(MAGNITUDE_BUCKETS).toHaveLength(5);
    for (const bucket of MAGNITUDE_BUCKETS) {
      expect(MAGNITUDE_IDENTITY[bucket].swatch).toContain(`--eq-mag-${bucket}`);
    }
  });
});
