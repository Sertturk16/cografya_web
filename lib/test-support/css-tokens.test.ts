import { describe, expect, it } from "vitest";
import { blockOf, resolveVars, tokensIn } from "./css-tokens";

const CSS = `
  :root { --a: #111111; --b: #222222; }
  /* .dark { --a: #999999; } */
  .dark { --a: #333333; }
  @media (x) { .dark { --b: #444444; } }
`;

describe("blockOf", () => {
  it("returns the body of the named top-level block", () => {
    expect(blockOf(CSS, ":root")).toContain("--a: #111111");
    expect(blockOf(CSS, ":root")).not.toContain("#333333");
  });

  it("is not fooled by the selector appearing inside a comment", () => {
    expect(blockOf(CSS, ".dark")).toContain("--a: #333333");
    expect(blockOf(CSS, ".dark")).not.toContain("#999999");
  });

  it("throws, naming the selector, when the block is absent", () => {
    expect(() => blockOf(CSS, ".light")).toThrow(".light");
  });
});

/**
 * The decoy this repo actually ships: `app/globals.css:45` reads
 * `@custom-variant dark (&:is(.dark *));` — real, uncommented code containing the literal
 * substring `.dark`, positioned before the real `.dark { ... }` rule. Comment-stripping does
 * nothing for it (it is not a comment), so `blockOf` used to walk from that occurrence to the
 * NEXT `{` — `:root`'s — and hand back `:root`'s body under the name `.dark`, silently.
 * `map-surface.test.ts` hit this in review: every `.dark`-selector lookup quietly read
 * `:root`, and the symptom looked like a palette mismatch rather than a parser bug.
 *
 * `DECOY_CSS` reproduces the shape (a `;`-terminated statement mentioning the selector, ahead
 * of the real rule) without depending on the real stylesheet, so this regression is pinned
 * independently of any future edit to `app/globals.css` itself.
 */
const DECOY_CSS = `
  @custom-variant dark (&:is(.dark *));
  :root { --a: #111111; }
  .dark { --a: #333333; }
`;

describe("blockOf skips a decoy occurrence that has a ; before its own {", () => {
  it("a bare selector reaches the real block past the @custom-variant decoy", () => {
    expect(blockOf(DECOY_CSS, ".dark")).toContain("--a: #333333");
    expect(blockOf(DECOY_CSS, ".dark")).not.toContain("#111111");
  });

  it("still throws, naming the selector, when nothing but the decoy matches", () => {
    const onlyDecoy = `@custom-variant dark (&:is(.dark *));\n:root { --a: #111111; }`;
    expect(() => blockOf(onlyDecoy, ".dark")).toThrow(".dark");
  });
});

describe("tokensIn", () => {
  it("reads one block's declarations and no other block's", () => {
    expect(tokensIn(CSS, ":root")).toEqual({ "--a": "#111111", "--b": "#222222" });
    expect(tokensIn(CSS, ".dark")).toEqual({ "--a": "#333333" });
  });
});

/**
 * `resolveVars` exists for the single-source aliases `app/globals.css` writes instead of
 * repeating a hex (`--map-water: var(--map-sea)` ships today; later tasks add
 * `--map-plate: var(--map-sea)`, `--map-context-line: var(--province-stroke)` and
 * `--eq-mag-fg: var(--color-ink-dark)`). Table tests compare `tokensIn(...)` against a
 * committed hex table, so an alias needs to read as the colour it resolves to, not as the
 * literal string `var(--name)`.
 *
 * The two-level case is the one worth pinning explicitly: each entry's own value is substituted
 * at most once, against the map's ORIGINAL (unresolved) values, not against a fixed point of
 * this same pass. So `--mid: var(--a)` resolves fully to `--a`'s hex (one hop is enough for it),
 * but `--b: var(--mid)` resolves to the raw stored value of `--mid`, which is itself still
 * `var(--a)` — one substitution applied to `--b`, landing on a string that is still literally a
 * `var()`. That is the point: it surfaces as an unresolved-looking value in a failing `toEqual`
 * against a hex table, rather than silently walking the chain to `--a`'s hex. If a future edit
 * made this recurse to a fixed point, this is the test that would catch it — `--b` would come
 * back as `#111111` instead of `var(--a)`.
 */
describe("resolveVars", () => {
  it("resolves a bare alias to its target's value", () => {
    const tokens = { "--a": "#111111", "--b": "var(--a)" };
    expect(resolveVars(tokens)).toEqual({ "--a": "#111111", "--b": "#111111" });
  });

  it("passes a non-alias value through unchanged", () => {
    const tokens = { "--a": "#111111" };
    expect(resolveVars(tokens)).toEqual({ "--a": "#111111" });
  });

  it("passes an alias whose target is absent from the map through unchanged", () => {
    // The target may simply live in another block (e.g. a light-block value that only .dark
    // aliases into); this function has no way to tell that apart from a typo, so it leaves the
    // literal string for the caller's table comparison to judge.
    const tokens = { "--b": "var(--elsewhere)" };
    expect(resolveVars(tokens)).toEqual({ "--b": "var(--elsewhere)" });
  });

  it("resolves a two-level alias exactly one level, leaving the inner var() unresolved", () => {
    const tokens = { "--a": "#111111", "--mid": "var(--a)", "--b": "var(--mid)" };
    expect(resolveVars(tokens)).toEqual({
      "--a": "#111111",
      "--mid": "#111111",
      "--b": "var(--a)",
    });
  });
});
