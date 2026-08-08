import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The region dot's key→token mapping, and its ring.
 *
 * This is the SECOND consumer of the `--region-*` palette; `components/game/game-map.module.css`
 * is the first. The two are compared against each other here so a future retune of one cannot
 * quietly give the same region two different colours on two surfaces — the reason the mapping
 * has not (yet) been extracted into a shared module is that two consumers do not earn an
 * abstraction, and this test is what makes that choice safe rather than merely cheap.
 *
 * It also pins the ring to the TOKEN. A bare `#211c19` would render identically and would
 * detach the dot from the measured 3:1 table that lives beside `--color-ink-dark` in
 * `app/globals.css` — exactly the class of change that stays invisible in review.
 *
 * Structural only: it asserts which token each KEY binds to, never which colour is "right"
 * for a region.
 */

/**
 * Stylesheet source with COMMENTS REMOVED. Both files document their contrast reasoning by
 * quoting the measured hex values, so a scan of the raw text would find "#0072b2" in the prose
 * and fail the "no bare hex" assertion on a perfectly compliant file — and, worse, its inverse:
 * a hex mentioned in a comment could satisfy a check after the real declaration was changed.
 * Same discipline as `components/map/attribution-separation.test.ts`.
 */
function cssCode(url: URL): string {
  return readFileSync(url, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
}

const dotCss = cssCode(new URL("./region-dot.module.css", import.meta.url));
const gameCss = cssCode(new URL("../game/game-map.module.css", import.meta.url));

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

/** `--region-*` token bound to `data-region="KEY"` in a stylesheet, or `null`. */
function tokenFor(css: string, key: string): string | null {
  const rule = new RegExp(`\\[data-region="${key}"\\][^{]*\\{[^}]*var\\((--region-[a-z-]+)\\)`);
  return css.match(rule)?.[1] ?? null;
}

describe("region dot ↔ region palette", () => {
  it("binds all seven region keys — no region silently loses its colour", () => {
    for (const key of REGION_KEYS) {
      expect(tokenFor(dotCss, key), key).not.toBeNull();
    }
  });

  it("binds each key to the SAME token the game map binds it to", () => {
    for (const key of REGION_KEYS) {
      const gameToken = tokenFor(gameCss, key);
      expect(gameToken, `${key} must still be bound in the game map`).not.toBeNull();
      expect(tokenFor(dotCss, key), key).toBe(gameToken);
    }
  });

  it("binds exactly seven keys — an eighth would be an unmapped region", () => {
    const bound = [...dotCss.matchAll(/\[data-region="([A-Z_]+)"\]/g)].map((m) => m[1]);
    expect(new Set(bound)).toEqual(new Set(REGION_KEYS));
  });
});

describe("region dot ring", () => {
  it("draws its border from var(--color-ink-dark), never a bare hex", () => {
    expect(dotCss).toMatch(/border:\s*1px\s+solid\s+var\(--color-ink-dark\)/);
  });

  it("contains no literal hex at all — every colour comes from the token layer", () => {
    expect(dotCss.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });
});
