import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TEST119-I1 — the guard `next.config.ts`'s `redirects()` table never had (PR #119 fix round,
 * plan §5.11). Repo-wide, `lib/geo/flag-set.test.ts` is the only OTHER test that reads
 * `next.config.ts` at all, and it asserts `outputFileTracingIncludes`, never `redirects()`; the
 * three CI jobs (`typecheck-and-lint`, `Unit Tests`, `build`) never inspect redirect content
 * either, and Next does not validate redirect targets at build time. A wrong `destination` still
 * typechecks, still lints, still builds — the symptom is an already-indexed URL 404-ing or
 * landing on the wrong entity, visible only in production.
 *
 * `readFileSync` + regex over the source, no import, no boot, no mock — the same house form
 * `lib/geo/flag-set.test.ts`'s "atomic flag catalogue" describe block already uses on this exact
 * file, and which `components/map/map-layers.test.ts` documents as this repo's deliberate house
 * form for source invariants. `vitest.config.ts` `include` already covers `lib/**\/*.test.ts`;
 * nothing else changes.
 *
 * This is the FIRST entry a class the platform will keep adding to — `GLOSSARY.md` §6's own CY
 * row states that a slug change *requires* an entry here. The assertions below are structural,
 * not a string echo of today's one entry: they generalise to entries this repo has not written
 * yet (no self-redirect, no chain, root-relative targets), so a legitimate second entry does not
 * need this file rewritten, only assertion 0's `toHaveLength(1)` updated.
 *
 * What this file explicitly does NOT claim (the same honesty `map-layers.test.ts` writes into
 * its own docblock): a source-text invariant does not prove the server actually 308s. That half
 * is empirical — a live `curl -I`, in the PR's own completion report, exactly as it was in
 * `FENER119-S1`.
 */

const CONFIG_SOURCE = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");

interface RedirectEntry {
  readonly source: string;
  readonly destination: string;
  readonly permanent: boolean;
}

/**
 * Parses every object literal out of the `redirects()` array's `return [...]` body.
 * Deliberately narrow: this repo's `redirects()` entries are flat `{ source, destination,
 * permanent }` objects with no nested braces, so a brace-balanced parser is not needed.
 *
 * A brace-shaped entry that is missing one of the three fields THROWS rather than being
 * silently dropped — a parser that quietly returns fewer entries than the source actually
 * contains is exactly the "regex that stops matching" failure class assertion 0 below exists to
 * catch, and dropping it here would just move the vacuous-pass risk from the test body into
 * this helper instead of removing it.
 */
function parseRedirects(source: string): RedirectEntry[] {
  const body = source.match(/async redirects\(\)\s*\{\s*return\s*\[([\s\S]*?)\];/);
  if (!body) return [];
  const rawEntries = body[1]?.match(/\{[^{}]*\}/g) ?? [];
  return rawEntries.map((entry, index) => {
    const source_ = entry.match(/source:\s*"([^"]*)"/)?.[1];
    const destination = entry.match(/destination:\s*"([^"]*)"/)?.[1];
    const permanentRaw = entry.match(/permanent:\s*(true|false)\b/)?.[1];
    if (source_ === undefined || destination === undefined || permanentRaw === undefined) {
      throw new Error(
        `redirects() entry #${index} matched an object literal but not all three fields ` +
          `(source/destination/permanent) — the field regex has drifted from the source ` +
          `shape: ${entry}`,
      );
    }
    return { source: source_, destination, permanent: permanentRaw === "true" };
  });
}

describe("next.config.ts redirects() — TEST119-I1 guard", () => {
  const entries = parseRedirects(CONFIG_SOURCE);

  it("parses at least one entry, and exactly one today", () => {
    // Assertions further below are universally quantified over `entries`: a regex that
    // silently stopped matching (a Prettier reflow, a trailing comma, a shorthand refactor)
    // would satisfy every one of them VACUOUSLY and this file would go green while guarding
    // nothing — the same failure shape as a test glob that matches no files. If a future entry
    // legitimately lands, the `toHaveLength(1)` half is the one line that needs updating, and
    // that is the intended prompt to re-read this test, not a reflex bump.
    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(1);
  });

  it("carries the CY canonical-name redirect as one object literal with all three fields together", () => {
    // The three fields as ONE entry, not three independent substring hits — `toContainEqual`
    // fails if e.g. the right destination sits on a DIFFERENT entry than the right source.
    expect(entries).toContainEqual({
      source: "/dunya/kibris-cumhuriyeti",
      destination: "/dunya/guney-kibris-rum-yonetimi",
      permanent: true,
    });
  });

  it("never redirects an entry back to its own source (no self-loop)", () => {
    for (const entry of entries) {
      expect(entry.destination).not.toBe(entry.source);
    }
  });

  it("never chains — no entry's destination equals any entry's source (SEO-POLICY.md §B6 6.8 / §B7 7.5, both BLOCKER)", () => {
    const sources = new Set(entries.map((entry) => entry.source));
    for (const entry of entries) {
      expect(sources.has(entry.destination)).toBe(false);
    }
  });

  it("keeps every source and destination root-relative — never a protocol- or absolute-origin target", () => {
    for (const entry of entries) {
      expect(entry.source.startsWith("/")).toBe(true);
      expect(entry.destination.startsWith("/")).toBe(true);
    }
  });
});
