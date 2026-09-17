import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every region key gets a visual treatment, and the page keys it on the api's KEY.
 *
 * ## What this file used to guard, and why the shape changed
 *
 * V1 painted regions from a `--region-*` CSS custom-property palette with two consumers —
 * `region-dot.module.css` and `game-map.module.css` — and this file compared them against each
 * other so a retune of one could not quietly give a region two colours on two surfaces. It also
 * pinned the dot's ring to `var(--color-ink-dark)` rather than a bare hex, keeping it attached to
 * the measured contrast table in `app/globals.css`.
 *
 * T-032 PR4 deleted both stylesheets with the components that owned them. V2 does not use a
 * custom-property palette: the province page carries a `REGION_THEMES` map of Tailwind classes,
 * and `V2RegionThumb` marks its SVG with `data-region`. So the two-consumer comparison has no
 * second consumer and the ring rule has no ring.
 *
 * Two things survive, and they are the ones that actually cost something when they break:
 *
 * 1. **Totality.** A region missing from the treatment map renders untreated — silently, for one
 *    seventh of the country. The mechanism changed from CSS selectors to an object literal; the
 *    failure is identical.
 * 2. **Keying.** The page holds both the enum key (`IC_ANADOLU`) and the translated label
 *    ("İç Anadolu") in one scope. Keying the treatment off the label yields nothing at all, per
 *    locale, with no error — which is why this was worth a test in V1 and still is.
 *
 * Structural only (`CONVENTIONS.md` §2): which key binds to a treatment, never which colour is
 * "right" for a region.
 */

/** The api's seven region keys. */
const REGION_KEYS = [
  "MARMARA",
  "EGE",
  "AKDENIZ",
  "IC_ANADOLU",
  "KARADENIZ",
  "DOGU_ANADOLU",
  "GUNEYDOGU_ANADOLU",
] as const;

/** Source with comments removed — this file's own prose names the identifiers under test. */
function tsxCode(url: URL): string {
  return readFileSync(url, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const provincePage = tsxCode(
  new URL("../../app/[locale]/(site)/turkiye/[slug]/page.tsx", import.meta.url),
);
const thumb = tsxCode(new URL("./v2-region-thumb.tsx", import.meta.url));

describe("every region key has a treatment", () => {
  it("binds all seven keys in REGION_THEMES — no region silently loses its colour", () => {
    const block = /const REGION_THEMES[\s\S]*?\n\};/.exec(provincePage)?.[0];
    expect(block, "REGION_THEMES map not found").toBeDefined();
    for (const key of REGION_KEYS) {
      expect(block, `${key} has no theme`).toMatch(new RegExp(`\\b${key}:\\s*\\{`));
    }
  });

  it("binds exactly seven — an eighth would be a region the api does not publish", () => {
    const block = /const REGION_THEMES[\s\S]*?\n\};/.exec(provincePage)![0];
    const bound = [...block.matchAll(/^ {2}([A-Z_]+):\s*\{/gm)].map((m) => m[1]!);
    expect(new Set(bound)).toEqual(new Set(REGION_KEYS));
  });

  it("gives each region its own treatment — no two share a class string", () => {
    // The V1 form of this was "the two stylesheets agree"; the V2 form is that the map is not
    // degenerate. Seven regions painted the same colour is the same defect as one unpainted.
    const block = /const REGION_THEMES[\s\S]*?\n\};/.exec(provincePage)![0];
    const badges = [...block.matchAll(/badgeClass:\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(badges).toHaveLength(REGION_KEYS.length);
    expect(new Set(badges).size, "two regions share a badge class").toBe(badges.length);
  });
});

describe("the treatment is keyed on the api's KEY, not its localized label", () => {
  it("looks REGION_THEMES up with province.region", () => {
    /**
     * The page holds both values in one scope — `province.region` is the enum key, the local
     * `region` is the translated label. Keying off the label yields `undefined`, silently and
     * differently per locale.
     *
     * V1 expressed the treatment as `<RegionDot region={province.region} />` over a CSS
     * attribute selector; V2 looks it up in a map. Different mechanism, same rule.
     */
    expect(provincePage).toMatch(/REGION_THEMES\[province\.region\]/);
    expect(provincePage).not.toMatch(/REGION_THEMES\[region\]/);
    expect(provincePage).toMatch(/const region = tRegions\(province\.region\)/);
  });

  it("marks the thumbnail with the key too, so the two surfaces cannot disagree", () => {
    // `data-region` is the V2 survivor of V1's selector hook: it is what ties the thumbnail to
    // the same key the card's badge is themed from.
    expect(thumb).toMatch(/data-region=\{region\}/);
  });
});
