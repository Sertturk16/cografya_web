import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "Turu bitir" and the half-round result screen (→ DEC 2026-08-05g md. 2,
 * Atlas AO-3).
 *
 * The ENGINE half of this feature is covered by real unit tests (`lib/game/round.test.ts`
 * → `describe("finishEarly")`). What cannot be reached that way is the WIRING, and the wiring
 * is where an owner ruling silently disappears: the button can lose its guard and start
 * showing up on a seven-question round, the screen can stop asking `finishEarly` and start
 * throwing the round away instead, or the "Yarım tur" line can be deleted as redundant —
 * leaving three stars standing over a half-played map with nothing to qualify them, which is
 * precisely the class of dishonest end screen the UX tour caught at B9.
 *
 * WHY SOURCE-SCANNING. The repo's vitest environment is `node` with no jsdom, and this is a
 * client island driving real DOM attributes. `game-map.nav-guard.test.ts` and
 * `game-island.reveal-exit.test.ts` established this pattern in this folder for exactly the
 * same reason; the empirical half of the proof is the scripted sample run
 * (`Owner's Inbox/kasif-pr4/harness/pr4b-after.mjs`) that every PR on this surface runs.
 *
 * EVERY BLOCK BELOW IS ANCHORED. A scan that fails to find its region of the file must FAIL,
 * not silently pass on an empty string — the lesson of PR #48's TA48-I1.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip comments: these files quote their own rules in prose, and a scan must read CODE. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const ISLAND = code(sourceOf("./game-island.tsx"));
const SCREEN = code(sourceOf("./game-screen.tsx"));
const SUMMARY = code(sourceOf("./game-summary.tsx"));

describe("which screens may end a round early", () => {
  it("derives the permission on the server from the screen's own identity", () => {
    // A page-level flag would be a SECOND statement of "this is the 81 İl screen", and a
    // second statement can disagree with the first. Both region modes are `provinces` rounds
    // too — what separates them is that they carry a region.
    expect(SCREEN).toContain('const allowEarlyFinish = mode === "provinces" && region === null;');
    expect(SCREEN).toContain("allowEarlyFinish={allowEarlyFinish}");
  });

  it("never lets the island decide for itself", () => {
    // The island must not re-derive the rule from `mode`: it cannot see the region, so it
    // would hand the button to every bölge-bölge-il round.
    expect(ISLAND).not.toMatch(/allowEarlyFinish\s*=\s*mode/);
    expect(ISLAND).toContain("allowEarlyFinish: boolean;");
  });
});

describe("the 'Turu bitir' control", () => {
  const actions = (() => {
    const start = ISLAND.indexOf("const actions =");
    expect(start).toBeGreaterThan(-1);
    const end = ISLAND.indexOf("return (", start);
    expect(end).toBeGreaterThan(start);
    return ISLAND.slice(start, end);
  })();

  it("is offered only where it is allowed AND there is a result to show", () => {
    expect(ISLAND).toContain(
      "const canFinishEarly = allowEarlyFinish && !finished && round.results.length > 0;",
    );
    expect(actions).toContain("canFinishEarly ?");
    expect(actions).toContain("onClick={endRoundEarly}");
    expect(actions).toContain('t("finishTour")');
  });

  it("comes LAST in the control strip", () => {
    // Not cosmetic. React reuses a DOM node by position, and PR #48's `event.detail > 1`
    // guard on "Devam" (CR48-I1) depends on the FIRST control being the reused one. A new
    // button in front of the pair would shift that reuse by one and reopen the defect.
    const restart = actions.indexOf("{restartButton}");
    expect(restart).toBeGreaterThan(-1);
    expect(actions.indexOf("canFinishEarly ?")).toBeGreaterThan(restart);
  });

  it("ends the round instead of discarding it, and asks nothing first", () => {
    const handler = (() => {
      const start = ISLAND.indexOf("const endRoundEarly =");
      expect(start).toBeGreaterThan(-1);
      const end = ISLAND.indexOf("}, [commitRound]);", start);
      expect(end).toBeGreaterThan(start);
      return ISLAND.slice(start, end);
    })();

    expect(handler).toContain("finishEarly(roundRef.current)");
    // No confirm: this action is not destructive, and a confirm in front of a harmless
    // action teaches people to dismiss confirms. ("Baştan başlat" keeps its own.)
    expect(handler).not.toContain("window.confirm");
    // The summary must be reopened, or ending the round produces no visible result.
    expect(handler).toContain("setSummaryDismissed(false)");
  });
});

describe("the half-round result screen", () => {
  it("states that the round was only half played", () => {
    expect(SUMMARY).toContain("summary.endedEarly ?");
    expect(SUMMARY).toContain('t("summaryPartial"');
    // BOTH numbers. "12 questions" alone says nothing about the map that was not played.
    expect(SUMMARY).toContain("answered: summary.total");
    expect(SUMMARY).toContain("poolTotal: summary.poolTotal");
  });

  it("keeps the stars, and keeps them above the qualifier", () => {
    // AO-3: the scoring rules do not change, so the grade stays — the honesty is carried by
    // the sentence, which therefore has to be read WITH the stars, not somewhere below the
    // fold of a scrolling dialog.
    const stars = SUMMARY.indexOf("starsForScore(summary.score)");
    const partial = SUMMARY.indexOf("summary.endedEarly ?");
    expect(stars).toBeGreaterThan(-1);
    expect(partial).toBeGreaterThan(stars);
    expect(SUMMARY).toContain("dialogStars");
  });

  it("still offers the learning list on a half round", () => {
    // Ö5's bridge into the province pages is the point of the end screen; ending early must
    // not quietly close it.
    expect(SUMMARY).toContain('t("summaryReviewHeading"');
    expect(SUMMARY).toContain("shouldOpenReviewGroup(review.length)");
  });
});
