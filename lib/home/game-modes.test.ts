import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL GUARD for the hero stat strip's game-modes count (→ round-2 review TEST102-I1).
 *
 * The home page prints a hand-maintained literal verbatim in the hero stat strip ("3 Oyun
 * Modu" / "3 Modes") with nothing tying it to the real number of game-mode routes. A fourth
 * mode could ship and the card would keep claiming three forever, with CI green.
 *
 * ## Why this reads source text rather than importing the constant
 *
 * It used to import `GAME_MODE_COUNT` from the V1 home page. T-032 deleted that page, and its
 * V2 replacement deliberately keeps the literal LOCAL and unexported — its own docblock
 * explains why: the page is a Server Component that pulls `next-intl/server` and API-fetch
 * modules in at module scope, which is not safe to import into the `"use client"` hero.
 * Exporting it to satisfy a test would undo a decision the code argues for, so the test reads
 * the literal out of the source instead. That is this repo's established form for asserting
 * anything about a file under `app/`, which vitest does not collect.
 *
 * Structural only (`CONVENTIONS.md` §2): this asserts a COUNT, never a mode's name, slug or
 * copy.
 */
describe("the hero stat strip's game-mode count", () => {
  it("matches the number of play-group mode routes", () => {
    /**
     * The three playable mode screens live in the `(play)` route group — no header, no
     * footer, fullscreen. The `(site)` group holds the two hub pages that link INTO them,
     * which are not modes and must not be counted.
     */
    const playDir = fileURLToPath(new URL("../../app/[locale]/(play)/oyun/", import.meta.url));
    const routeDirs = readdirSync(playDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // Anti-vacuity: a scan that silently found nothing would make the equality below
    // meaningless by satisfying it with a count of 0.
    expect(routeDirs.length, "(play)/oyun route subdirectory count").toBeGreaterThan(0);
    expect(routeDirs.sort(), "(play)/oyun route subdirectory names").toEqual(
      ["81-il", "bolge-bolge-il", "bolge-bulma"].sort(),
    );

    const home = readFileSync(
      fileURLToPath(new URL("../../app/[locale]/(site)/page.tsx", import.meta.url)),
      "utf8",
    );
    const match = /const V2_GAME_MODE_COUNT = (\d+);/.exec(home);
    expect(match, "V2_GAME_MODE_COUNT literal not found in the home page").not.toBeNull();
    expect(Number(match?.[1])).toBe(routeDirs.length);
  });
});
