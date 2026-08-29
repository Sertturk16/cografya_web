import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * TEST96-M1 fix (PR #96 round-1 review) — the `clientRoundId`/`submitModeTag` prop chain from
 * `game-island.tsx`'s `<GameSummary>` call through to `game-summary.tsx`'s own
 * `<GameRoundSaveControl>` call had no test asserting the actual VALUES wired through each
 * hop, only that the types line up (TypeScript's structural typing does not catch a value
 * swap between two same-typed props — e.g. `submitModeTag={clientRoundId}` would still
 * typecheck if both happened to be `string`).
 *
 * `locale` DROPPED from this chain (uyelik-auth-redesign plan §5.6.2): the save control no
 * longer redirects to `/kayit` on its own — it opens the shared auth modal instead, which
 * resolves its own locale from the root layout, so the prop this scan used to assert threads
 * through no longer exists at any of the three hops.
 *
 * SOURCE-SCAN, the `game-round-save.structure.test.ts`/`game-history-panel.structure.test.ts`
 * pattern in this same folder — this repo's vitest environment is a bare `node` environment
 * with no jsdom, so the two client components cannot be rendered and asserted on directly.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip comments: this scan must read CODE, not this file's (or the scanned files' own)
 *  prose that merely MENTIONS `<GameSummary>`/`<GameRoundSaveControl>` inside a docblock. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const ISLAND = code(sourceOf("./game-island.tsx"));
const SUMMARY = code(sourceOf("./game-summary.tsx"));

function jsxTag(source: string, openTag: string): string {
  const start = source.indexOf(openTag);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("/>", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("game-island.tsx forwards the finished round's own identity to <GameSummary> unchanged", () => {
  const call = jsxTag(ISLAND, "<GameSummary");

  it("passes clientRoundId={round.clientRoundId} — the same round's id, never regenerated", () => {
    expect(call).toContain("clientRoundId={round.clientRoundId}");
  });

  it("passes submitModeTag={submitModeTag} — the server-resolved tag, never a re-derived value", () => {
    expect(call).toContain("submitModeTag={submitModeTag}");
  });

  it("no longer passes a locale prop — the save control opens the shared auth modal instead of redirecting (plan §5.6.2)", () => {
    expect(call).not.toContain("locale=");
  });
});

describe("game-summary.tsx forwards the same three props to <GameRoundSaveControl> unchanged", () => {
  const call = jsxTag(SUMMARY, "<GameRoundSaveControl");

  it("passes clientRoundId={clientRoundId} straight through, not a re-derived local", () => {
    expect(call).toContain("clientRoundId={clientRoundId}");
  });

  it("passes submitModeTag={submitModeTag} straight through, not a re-derived local", () => {
    expect(call).toContain("submitModeTag={submitModeTag}");
  });

  it("no longer passes a locale prop", () => {
    expect(call).not.toContain("locale=");
  });
});
