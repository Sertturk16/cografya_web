import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "the iframe's `src` comes from the FROZEN second, never the live one".
 *
 * This is DEC 2026-08-15d's load-bearing invariant and, until PR #63's review, it was guarded
 * on the store's side only (→ `TA63-I1`). `active-video.test.ts` proves the store leaves
 * `loadStartSecond` alone across a seek, and `embed.test.ts` proves the URL builder is a pure
 * function — neither observes the CONSUMER that actually decides which of the two seconds
 * reaches the attribute. A one-token edit at `deneme-video.tsx` (`loadStartSecond` →
 * `seekSecond`) keeps typecheck, lint, build and every existing test green, produces identical
 * screenshots, and silently restores the six-reloads-per-video cost the ruling removed. That
 * combination — invisible to every other check we run, and a ruled behaviour — is what earns a
 * guard.
 *
 * It also pins the click gate the same island depends on (→ `TA63-M1`): "modifier and
 * middle-click still open a new tab" rested on prose alone, and `preventDefault()` reaching
 * one of those presses is not a defect any screenshot shows.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. `vitest.config.ts` runs a single `node`
 * environment with no jsdom, so no component render or DOM event is available in this repo
 * (tracked FU-WEB-JSDOM). The same constraint produced `nav-disclosure.test.ts` and
 * `game-island.reveal-exit.test.ts`, and this file follows their shape. The guard makes no
 * claim about what a browser does; the browser half is the PR's measured criterion table.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip comments, then collapse whitespace: the prose above the code says all of these words,
 *  and Prettier is free to break the lines wherever it likes. */
function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const VIDEO = flatCode(sourceOf("./deneme-video.tsx"));
const PLAYER = flatCode(sourceOf("./deneme-player.tsx"));

/** The `playerEmbedSrc({ … })` argument object, as written. Everything asserted about the
 *  `src` is asserted about THIS slice rather than the whole file, so a `seekSecond` that is
 *  legitimately used elsewhere in the component cannot make an assertion pass or fail by
 *  accident. */
function embedSrcArgs(): string {
  const match = /playerEmbedSrc\(\{([\s\S]*?)\}\)/.exec(VIDEO);
  return match?.[1] ?? "";
}

describe("the iframe src's second", () => {
  // Anchors. Without them every assertion below could pass vacuously after a rename, which is
  // the one way a source-scan guard fails silently.
  it("is still built by playerEmbedSrc at the swap point", () => {
    expect(VIDEO).toContain("playerEmbedSrc({");
    expect(embedSrcArgs()).not.toBe("");
    expect(embedSrcArgs()).toContain("videoId,");
  });

  it("is fed by the FROZEN load second", () => {
    expect(embedSrcArgs()).toMatch(/startSecond: active\.loadStartSecond/);
  });

  it("never reaches for the live seek second", () => {
    // The one-token edit this shield exists for. `seekSecond` inside these args would move the
    // `src` on every question and reload the player six times per video.
    expect(embedSrcArgs()).not.toContain("seekSecond");
  });

  it("still applies the live seek through the loaded player instead", () => {
    // The other half: the invariant is only worth holding because the jump has somewhere else
    // to go. If this disappears, questions stop jumping and the `src` guard above still passes.
    expect(VIDEO).toMatch(/player\.seekTo\(active\.seekSecond/);
    expect(VIDEO).toMatch(/pendingSeek\.current = active\.seekSecond/);
  });
});

describe("the player only opens for a block that has one", () => {
  it("requires `playable` alongside the store's answer", () => {
    // → PR #63 review CODE63-I1: without this a stale store can force the iframe branch on an
    // `external` block, embedding a video the provider has refused embedding for.
    expect(VIDEO).toMatch(/const isActive = playable && active !== null/);
  });

  it("clears the store when the block leaves the page", () => {
    // The module-level store outlives a client-side route change; this cleanup is what stops a
    // return visit from rendering an autoplaying iframe with no click anywhere in between.
    expect(PLAYER).toMatch(/return \(\) => \{ closeVideo\(denemeNo\); \};/);
  });
});

describe("the click gate", () => {
  it("bails out before preventDefault on a modifier or middle press", () => {
    // "Open this question in a new tab" is browser behaviour we must not take away, so the
    // bail has to come FIRST — asserted by position, not merely by presence.
    const bail = PLAYER.indexOf("event.metaKey || event.ctrlKey");
    const narrowing = PLAYER.indexOf("closest<HTMLElement>(");
    const prevented = PLAYER.indexOf("event.preventDefault()");
    expect(bail).toBeGreaterThan(0);
    expect(narrowing).toBeGreaterThan(bail);
    expect(prevented).toBeGreaterThan(narrowing);
  });

  it("intercepts only the two controls that carry a data hook", () => {
    expect(PLAYER).toContain('closest<HTMLElement>("[data-second], [data-player-open]")');
  });

  it("leaves a non-playable block's rows entirely alone", () => {
    expect(PLAYER).toMatch(/if \(!playable \|\| event\.defaultPrevented\) return;/);
  });
});
