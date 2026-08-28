import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * TEST96-M1 fix (PR #96 round-1 review) — the `clientRoundId`/`submitModeTag`/`locale` prop
 * chain from `game-island.tsx`'s `<GameSummary>` call through to `game-summary.tsx`'s own
 * `<GameRoundSaveControl>` call had no test asserting the actual VALUES wired through each
 * hop, only that the types line up (TypeScript's structural typing does not catch a value
 * swap between two same-typed props — e.g. `locale={submitModeTag}` would still typecheck if
 * both happened to be `string`).
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

  it("passes locale={locale} — the route's own locale, never a hardcoded or swapped value", () => {
    expect(call).toContain("locale={locale}");
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

  it("passes locale={locale} straight through, not a re-derived local", () => {
    expect(call).toContain("locale={locale}");
  });
});
