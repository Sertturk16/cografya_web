import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GAME_MODE_COUNT } from "@/app/[locale]/page";

/**
 * STRUCTURAL GUARD for the hero stat strip's game-modes count (→ round-2 review TEST102-I1).
 *
 * `app/[locale]/page.tsx`'s `GAME_MODE_COUNT` is a hand-maintained literal, printed verbatim in
 * the hero stat strip ("3 Oyun Modu" / "3 Modes") with nothing tying it to the real number of
 * game-mode routes under `app/[locale]/oyun/`. A 4th mode could ship and this card would keep
 * claiming three forever, with CI green.
 *
 * This is the same directory-scan idea `lib/tools/messages.test.ts`'s `CONSUMER_ROOTS` uses — a
 * real filesystem read, not a second hardcoded number to keep in sync with the first. No new
 * framework, no new dependency.
 *
 * Structural only (`CONVENTIONS.md` §2): this asserts a COUNT, never a mode's name, slug or
 * copy.
 */
describe("the hero stat strip's game-mode count", () => {
  it("GAME_MODE_COUNT equals the number of app/[locale]/oyun/ route subdirectories", () => {
    const oyunDir = fileURLToPath(new URL("../../app/[locale]/oyun/", import.meta.url));
    const entries = readdirSync(oyunDir, { withFileTypes: true });
    // Only real route subdirectories count as a "mode" — `page.tsx` (the hub) and
    // `game.module.css` sit alongside them as files, not routes.
    const routeDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    // Anti-vacuity: a scan that silently found nothing would make the equality below
    // meaningless by satisfying it with GAME_MODE_COUNT === 0.
    expect(routeDirs.length, "app/[locale]/oyun/ route subdirectory count").toBeGreaterThan(0);
    expect(routeDirs.sort(), "app/[locale]/oyun/ route subdirectory names").toEqual(
      ["81-il", "bolge-bolge-il", "bolge-bulma"].sort(),
    );
    expect(GAME_MODE_COUNT).toBe(routeDirs.length);
  });
});
