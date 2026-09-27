# T-136 impeccable tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give impeccable machine-readable design tokens (so its detector enforces Terra and its
live panel shows real tokens), clean detector baseline, and live mode configured.

**Architecture:** A generator reads `app/globals.css` and writes a YAML frontmatter block at the
top of `docs/design.md` in the DESIGN.md (Stitch) schema impeccable reads. The prose below it is
untouched and stays the authority. `design:tokens:check` regenerates and diffs, like the map
artifacts, so the frontmatter can never drift from the CSS.

**Tech Stack:** Node ESM script (`scripts/*.mjs`, `// @ts-check`), vitest, prettier API.

**Spec:** decisions recorded in `TASKS.md` T-136 (no separate spec; owner delegated the technical
choices).

## Global Constraints

- `docs/design.md` stays where it is: impeccable resolves it only as a sibling of
  `docs/product.md`. No root `DESIGN.md`, no `/impeccable document`.
- Frontmatter keys limited to Stitch's schema: `name`, `description`, `colors`, `typography`,
  `rounded` (no `spacing`/`components`: Tailwind owns spacing, components live in prose).
- Every value is derived from `app/globals.css` except the listed incumbent literal steps, each
  with its evidence in a comment.
- Generated output must be prettier-stable (`pnpm format:check` green).

## Review Focus

- A `var()` chain that does not end in a literal colour (e.g. `color-mix`) must be skipped, not
  emitted as `var(--x)`.
- A comment containing `{` or `}` inside `globals.css` must not break block extraction.
- Running the generator twice must produce byte-identical output (idempotent splice).
- A `docs/design.md` with no frontmatter (first run) and one with an old frontmatter (later runs)
  must both end with exactly one frontmatter block.
- `components/showcase/registry.test.ts` reads `docs/design.md` by heading; frontmatter above
  the H1 must not move it.

---

### Task 1: Pure token extraction library

**Files:**

- Create: `scripts/lib/design-tokens.mjs`
- Test: `scripts/lib/design-tokens.test.ts`

**Interfaces:**

- Produces: `extractTokens(css: string): { colors, typography, rounded }`,
  `renderFrontmatter(tokens): string` (starts and ends with `---\n`),
  `spliceFrontmatter(md: string, fm: string): string`.

- [ ] Step 1: Write failing tests covering: light `--color-*` → `terra-<name>`; bridge tokens
      resolved through `var()` → bare name; `.dark` block → `night-<name>`; unresolvable
      (`color-mix`) skipped; comment with braces ignored; `var(--font-nunito-sans)` →
      `"Nunito Sans"`; `h1`/`h2`/`body` font sizes; `--radius-*` calc → px; `:focus-visible`
      radius; splice on a file without and with frontmatter; splice idempotent.
- [ ] Step 2: `pnpm vitest run scripts/lib/design-tokens.test.ts` → FAIL (module missing).
- [ ] Step 3: Implement: strip comments; brace-match `:root, .light {`, `.dark {`,
      `@theme inline {`; parse `--name: value;`; resolve `var(--x)` within block then `:root`;
      accept `#hex`, `rgb()/rgba()`, `hsl()`, `oklch()`; rules `body`, `h1`, `h2`,
      `:focus-visible` via selector regex; incumbent literal steps constant
      (`display-hub` 1.9rem, `label` 11px, `micro` 10px) with evidence comments.
- [ ] Step 4: Same command → PASS.
- [ ] Step 5: Commit `feat(design): extract Terra tokens for impeccable's DESIGN.md schema`.

### Task 2: Generator, scripts, CI gate, frontmatter committed

**Files:**

- Create: `scripts/generate-design-tokens.mjs`
- Modify: `package.json` (`design:tokens`, `design:tokens:check`), `.github/workflows/ci.yml`
  and `.github/workflows/deploy.yml` (drift step beside the map checks), `docs/design.md`
  (frontmatter + line 3 wording), `CLAUDE.md` (commands block).

- [ ] Step 1: Generator reads css + md, formats the spliced md with prettier's API using the repo
      config, writes only when changed.
- [ ] Step 2: `pnpm design:tokens`; then `pnpm design:tokens:check` → exit 0; `pnpm
format:check` on the file green; `registry.test.ts` green.
- [ ] Step 3: Hand-edit a hex in the frontmatter → `design:tokens:check` exits 1 (proves the
      gate), revert.
- [ ] Step 4: `impeccable doctor --json` → `findings: []`.
- [ ] Step 5: Commit `feat(design): generate docs/design.md token frontmatter with a CI drift gate`.

### Task 3: Detector baseline triage

**Files:** Modify: `.impeccable/config.json` (via `impeccable hooks ignore-value` only).

- [ ] Step 1: `impeccable detect --json app components`; bucket by rule.
- [ ] Step 2: File-scoped ignore-value with evidence for confirmed false positives
      (`broken-image` in `components/map/locator-attribution.test.ts`: the string is a test title;
      `layout-transition` in `components/v2/v2-continent-locator-map.tsx`: `stroke-width` on an SVG
      path, not layout width).
- [ ] Step 3: Remaining design-system findings are real drift: list them in a new READY task
      in `TASKS.md`, do not suppress.
- [ ] Step 4: Commit `chore(impeccable): record detector exceptions with evidence`.

### Task 4: Live mode config, rule line, PR

**Files:** Create `.impeccable/live/config.json`; modify `CLAUDE.md` impeccable rule.

- [ ] Step 1: Write `{"files":["app/[locale]/layout.tsx"],"insertBefore":"</body>",
"commentSyntax":"jsx","cspChecked":true}` (`detect-csp` returned `shape: null`).
- [ ] Step 2: typecheck, lint, test green; `impeccable context` shows both paths, no stale
      directive.
- [ ] Step 3: Commit, push, PR into `dev`.
