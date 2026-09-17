# T-035 Page Composition Implementation Plan — PR1 and PR2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 37 product pages one container and one breadcrumb, and pin both with a test that cannot be quietly walked back.

**Architecture:** Two new `components/patterns/` components, each adopted on every call site in the same PR that introduces it. A single scanner test (`components/v2/page-composition.test.ts`) holds exact counts of the shapes being collapsed; each task tightens a constant in it. `Breadcrumbs` derives its visible `<nav>` and its `BreadcrumbList` JSON-LD from one array, so the two cannot diverge.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4 (CSS-first), shadcn `base-nova` on Base UI, next-intl 4, vitest (node env, no jsdom).

**Spec:** `docs/superpowers/specs/2026-09-17-page-composition-design.md`

## Scope of THIS plan

PR1 (`PageContainer`) and PR2 (`Breadcrumbs`) only — tasks 1-8. PR3-PR6 get their own plan
after PR2 lands. This is deliberate: the exact content of PR4's `Card` variants depends on
what the spellings look like once the container and hero wrappers stop contributing to them,
and writing those steps now would mean inventing them. Each of PR1 and PR2 ships working,
independently reviewable software.

## Global Constraints

Copied from `CLAUDE.md`, `docs/conventions.md` and `docs/design.md`. Every task's requirements
implicitly include these.

- Import `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/i18n/navigation`,
  **never** from `next/link` or `next/navigation`.
- Colour comes from a bridge token (`bg-primary`, `text-muted-foreground`, `border-border`).
  No brand hex, no `bg-[var(--color-x,#hex)]` escape, no hand-written `dark:`.
  `components/ui/token-binding.test.ts` enforces all four in `components/patterns`.
- `Button` has no `asChild`. A link styled as a button is
  `<Link className={cn(buttonVariants({ variant, size }))}>`.
- Tests are co-located `*.test.ts(x)`. Vitest globs are `lib/**`, `components/**`, `tools/**` —
  **nothing under `app/` runs**, though a test elsewhere may read those files.
- No jsdom. Component tests render with React and assert on the tree/markup.
- A test that greps source text strips comments first, using
  `lib/test-support/strip-comments.ts` — never a pair of `String.replace` calls.
- Every new component in `components/ui` or `components/patterns` needs a specimen at
  `/design-system` and an entry in `components/showcase/registry.ts`, or
  `components/showcase/registry.test.ts` fails.
- Prettier: double quotes, semicolons, trailing commas, width 100.
- Conventional Commits, scope = surface (e.g. `feat(v2/layout):`).
- Gate before every commit: `pnpm typecheck`, `pnpm lint`, `pnpm test` — run as **separate
  commands**, each exit code read on its own, never chained behind `&&`.

## File Structure

| File                                                                             | Responsibility                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/v2/page-composition.test.ts`                                         | **Create.** The scanner. Walks the page tree and `components/v2`, strips comments, and holds one exact constant per shape being collapsed. Grows across tasks; every other file in this plan tightens a number here. |
| `components/patterns/page-container.tsx`                                         | **Create.** Horizontal width, padding and vertical rhythm for a page's body. Owns nothing the `(site)` layout already owns.                                                                                          |
| `components/patterns/page-container.test.tsx`                                    | **Create.** Unit test for the component's own contract.                                                                                                                                                              |
| `components/patterns/breadcrumbs.tsx`                                            | **Create.** One `items` array → the visible `<nav>` (via the `components/ui/breadcrumb` primitives) **and** `breadcrumbJsonLd`, gated on `isIndexable`.                                                              |
| `components/patterns/breadcrumbs.test.tsx`                                       | **Create.** Unit test, including the JSON-LD gate.                                                                                                                                                                   |
| `components/showcase/registry.ts`                                                | **Modify.** Two new entries.                                                                                                                                                                                         |
| `components/showcase/specimens/duzen.tsx`                                        | **Modify.** Two new specimens.                                                                                                                                                                                       |
| 34 files under `app/[locale]/(site)/**`                                          | **Modify.** Adopt the container, then the breadcrumb.                                                                                                                                                                |
| `components/v2/v2-sea-basin-detail-view.tsx`, `components/v2/v2-game-screen.tsx` | **Modify.** The two shared components that render a breadcrumb for 7 pages between them.                                                                                                                             |

---

# PR1 — `PageContainer`

## Task 1: The scanner, pinned at today's numbers

The scanner comes first and is asserted against the CURRENT state, not the target. A counter
that starts at its target is green from birth and has never been shown to detect anything.

**Files:**

- Create: `components/v2/page-composition.test.ts`

**Interfaces:**

- Consumes: `stripComments` from `@/lib/test-support/strip-comments`.
- Produces: `walkPages()`, `sourceOf()` and the exported constant `PAGE_BODY_SPELLINGS`, reused
  by every later task in this plan.

- [ ] **Step 1: Write the scanner with its positive controls, pinned at 8**

Today there are two container families and six tails between them, which the scanner counts as
distinct spellings of the page body wrapper. Measured 2026-09-17: **8**.

```ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The reading and play surfaces. `design-system` is deliberately absent: it is internal
 * tooling that brings its own chrome, and including it would let showcase markup answer for
 * product markup — the shape of vacuity `components/ui/orphan.test.ts` guards against by
 * naming its roots instead of globbing `app/`.
 */
const PAGE_ROOTS = ["app/[locale]/(site)", "app/[locale]/(play)"] as const;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });
}

export function walkPages(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => path.endsWith("page.tsx"))
    .sort();
}

/** Comments stripped: a docblock quoting a className must not answer for the markup. */
export function sourceOf(path: string): string {
  return stripComments(readFileSync(path, "utf8"));
}

const label = (path: string) => relative(repoRoot, path);

/**
 * The page BODY wrapper: the element carrying the container width. Both families are matched
 * — `max-w-7xl mx-auto …` and `container mx-auto px-4 max-w-7xl …` — because the second is
 * the same intent with the Tailwind tokens written in the other order, and a counter that saw
 * only the first would report progress while five pages kept their own spelling.
 */
const BODY_WRAPPER = /className="((?:[^"]*\b(?:max-w-7xl|container)\b)[^"]*)"/g;

function bodySpellings(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of walkPages()) {
    for (const match of sourceOf(path).matchAll(BODY_WRAPPER)) {
      const spelling = match[1]!.trim().replace(/\s+/g, " ");
      found.set(spelling, [...(found.get(spelling) ?? []), label(path)]);
    }
  }
  return found;
}

/**
 * EXACT, not a ceiling. `docs/design.md` records what a ceiling is worth here: a raw-palette
 * count "moved without anyone noticing" from 749 to 895 because it lived only in a comment.
 * An exact number makes raising it and lowering it equally deliberate, and equally visible in
 * a diff.
 */
const PAGE_BODY_SPELLINGS = 8;

describe("the scanner itself", () => {
  it("walked the product surface and nothing else", () => {
    const pages = walkPages().map(label);
    expect(pages.length).toBe(37);
    expect(pages).toContain("app/[locale]/(site)/araclar/page.tsx");
    expect(pages.some((p) => p.includes("design-system"))).toBe(false);
  });

  it("strips comments — a className in prose does not count", () => {
    const stripped = stripComments('const a = 1; /* className="max-w-7xl mx-auto" */');
    expect(stripped).not.toContain("max-w-7xl");
  });

  it("the BODY_WRAPPER pattern matches source that carries one", () => {
    const hit = [...'<div className="max-w-7xl mx-auto px-4">'.matchAll(BODY_WRAPPER)];
    expect(hit).toHaveLength(1);
  });
});

describe("page body wrappers converge on one spelling", () => {
  it("has exactly the recorded number of spellings", () => {
    const spellings = bodySpellings();
    expect(
      spellings.size,
      `spellings:\n${[...spellings].map(([s, f]) => `  ${f.length}x ${s}`).join("\n")}`,
    ).toBe(PAGE_BODY_SPELLINGS);
  });
});
```

- [ ] **Step 2: Run it and read the failure**

Run: `pnpm vitest run components/v2/page-composition.test.ts`

Expected: the three scanner tests PASS. The spelling count may not be exactly 8 — the regex is
being run against the real tree for the first time. **Do not change the regex to reach 8.**
Read the printed spelling list, confirm each entry is a real page body wrapper, and set
`PAGE_BODY_SPELLINGS` to what is actually there. Record the number in the commit message.

- [ ] **Step 3: Mutation-check the counter**

Add a ninth spelling by hand to any page body wrapper (e.g. append ` pb-1` in
`app/[locale]/(site)/araclar/page.tsx:70`), run the test, and confirm it goes RED naming the
new spelling. Then revert the edit and confirm GREEN.

Run: `pnpm vitest run components/v2/page-composition.test.ts`
Expected: RED with the edit, GREEN without it. A counter that has never failed has not been
shown to work.

- [ ] **Step 4: Gate and commit**

```bash
pnpm typecheck
pnpm lint
pnpm test
git add components/v2/page-composition.test.ts
git commit -m "test(v2/layout): pin the page body wrapper spellings before collapsing them"
```

## Task 2: `PageContainer`

**Files:**

- Create: `components/patterns/page-container.tsx`
- Create: `components/patterns/page-container.test.tsx`
- Modify: `components/showcase/registry.ts`
- Modify: `components/showcase/specimens/duzen.tsx`

**Interfaces:**

- Produces: `PageContainer`, props
  `{ children: ReactNode; space?: "tight" | "default" | "loose"; className?: never }`.
  Tasks 3 and 4 import it from `@/components/patterns/page-container`.

- [ ] **Step 1: Write the failing test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageContainer } from "./page-container";

describe("PageContainer", () => {
  it("renders one container with the shared width and padding", () => {
    const html = renderToStaticMarkup(<PageContainer>body</PageContainer>);
    expect(html).toContain("max-w-7xl");
    expect(html).toContain("mx-auto");
    expect(html).toContain("px-4");
  });

  it("carries no min-h-screen and no background — the (site) layout owns those", () => {
    // Five pages used to duplicate the layout's wrapper. If the container starts providing
    // it too, that duplication becomes invisible instead of removed.
    const html = renderToStaticMarkup(<PageContainer>body</PageContainer>);
    expect(html).not.toContain("min-h-screen");
    expect(html).not.toContain("bg-background");
  });

  it("offers exactly three rhythms and no open className escape", () => {
    const tight = renderToStaticMarkup(<PageContainer space="tight">b</PageContainer>);
    const loose = renderToStaticMarkup(<PageContainer space="loose">b</PageContainer>);
    expect(tight).not.toEqual(loose);
    // The six tails collapsed into three named rhythms; an open `className` would let a
    // seventh tail back in through the prop, which is how the spellings grew in the first
    // place. TypeScript blocks it (`className?: never`); this asserts the runtime shape.
    expect(tight).toContain("space-y-");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run components/patterns/page-container.test.tsx`
Expected: FAIL — `Cannot find module './page-container'`.

- [ ] **Step 3: Write the component**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The body of a reading page: width, horizontal padding, and vertical rhythm.
 *
 * It owns NONE of the page skeleton. `app/[locale]/(site)/layout.tsx` already renders
 * `min-h-screen flex flex-col justify-between bg-background text-foreground`, and five pages
 * carried a redundant copy of it — removing those is part of adopting this.
 *
 * `space` is a closed union rather than a `className` passthrough on purpose. The six tails
 * this replaces (`space-y-8` through `space-y-16`, with and without `pb-20`) grew because
 * each page could write its own; a passthrough would reproduce them through the prop and the
 * counter in `components/v2/page-composition.test.ts` would stop meaning anything.
 */
const RHYTHM = {
  tight: "space-y-8",
  default: "space-y-14",
  loose: "space-y-16",
} as const;

interface PageContainerProps {
  children: ReactNode;
  space?: keyof typeof RHYTHM;
  /** No escape hatch. See the note above. */
  className?: never;
}

export function PageContainer({ children, space = "default" }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 pt-6 pb-20 sm:px-6 sm:pt-10 lg:px-8",
        RHYTHM[space],
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run components/patterns/page-container.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Register the specimen**

In `components/showcase/registry.ts`, add `"page-container"` to the `duzen` category's
`components` array. In `components/showcase/specimens/duzen.tsx`, add a specimen rendering all
three rhythms with visible child blocks so the difference is legible in both themes.

Run: `pnpm vitest run components/showcase/registry.test.ts`
Expected: PASS. It fails if the registry lists a component with no specimen, or the reverse.

- [ ] **Step 6: Gate and commit**

```bash
pnpm typecheck
pnpm lint
pnpm test
git add components/patterns/page-container.tsx components/patterns/page-container.test.tsx components/showcase/registry.ts components/showcase/specimens/duzen.tsx
git commit -m "feat(v2/layout): add PageContainer, one width and three rhythms"
```

## Task 3: Adopt on the five family-B pages

Family B is `container mx-auto px-4 max-w-7xl …` — the same intent with the tokens reversed.
Five pages: `kitaplar/[slug]`, `dunya/[slug]`, `turkiye/[slug]`, `turkiye/bolge/[slug]`,
`turkiye/bolge/page`. Three of them also carry the redundant `min-h-screen …` wrapper.

**Files:**

- Modify: `app/[locale]/(site)/kitaplar/[slug]/page.tsx`
- Modify: `app/[locale]/(site)/dunya/[slug]/page.tsx`
- Modify: `app/[locale]/(site)/turkiye/[slug]/page.tsx`
- Modify: `app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx`
- Modify: `app/[locale]/(site)/turkiye/bolge/page.tsx`
- Modify: `components/v2/page-composition.test.ts`

**Interfaces:**

- Consumes: `PageContainer` from Task 2.

- [ ] **Step 1: Replace each family-B wrapper**

For each of the five files, replace the body wrapper element with `PageContainer`. The
before/after for `turkiye/bolge/page.tsx:329`:

```tsx
// before
<div className="container mx-auto px-4 max-w-7xl space-y-6">

// after
<PageContainer space="tight">
```

Add `import { PageContainer } from "@/components/patterns/page-container";` to each file.

Where the page also returns an outer `<div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">`, delete that element and return the children directly — `(site)/layout.tsx` renders the same classes one level up, so it was always a duplicate. `selection:bg-primary/20` is lost with it; if the selection colour is wanted it belongs in `app/globals.css`'s base layer once, not on five pages. Raise it rather than reproducing it.

- [ ] **Step 2: Tighten the counter**

In `components/v2/page-composition.test.ts`, lower `PAGE_BODY_SPELLINGS` by the number of
spellings the five pages contributed (read the failure output to see exactly which are gone).

- [ ] **Step 3: Run the gate**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all green. `pnpm test` should show `page-composition.test.ts` passing at the new
lower number. If it reports MORE spellings than expected, a page had two body wrappers — read
the printed list rather than adjusting the constant to match.

- [ ] **Step 4: Verify nothing moved visually**

These five are detail pages with real data. Start the API (`cd ../cografya_api && docker compose up -d && pnpm start:dev`), then `pnpm dev`, and check `/turkiye/istanbul` and `/turkiye/bolge` at 390px and desktop in light and dark via Playwright MCP. The container's padding is identical to what family B resolved to; if anything shifts, the rhythm choice (`tight`) is wrong for that page.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(site)" components/v2/page-composition.test.ts
git commit -m "refactor(v2/layout): move the five reversed-token pages onto PageContainer"
```

## Task 4: Adopt on the 29 family-A pages

**Files:**

- Modify: the 29 remaining `page.tsx` files under `app/[locale]/(site)/**`
- Modify: `components/v2/page-composition.test.ts`

- [ ] **Step 1: Replace each family-A wrapper**

The before/after for `app/[locale]/(site)/araclar/page.tsx:70`:

```tsx
// before
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">

// after
<PageContainer>
```

Map the six tails onto the three rhythms: `space-y-8` → `space-y-{8,10}` becomes `"tight"`,
`space-y-{12,14}` becomes the default, `space-y-16` becomes `"loose"`. Two pages need a
judgement call — `hakkimizda` has no `space-y-*` at all (use `"tight"`) and
`oyun/bolge-bolge-il` uses `pt-6 sm:pt-8` rather than `sm:pt-10` (accept `sm:pt-10`; an 8px
difference on one page is what the six tails were made of).

While in each file, delete the dead `{/* V2 Header */}` and `{/* Modern V2 Footer */}` marker
comments and the empty `<div>` they sit in. T-032 PR3 moved the chrome into the layout and
left the markers behind; they now describe markup that is not there.

- [ ] **Step 2: Set the counter to 1**

```ts
const PAGE_BODY_SPELLINGS = 1;
```

The one remaining spelling is `PageContainer`'s own, which the scanner sees because the
component file is not a page and the pages no longer write it. If the number is not 1, read
the printed list: a page still writing its own wrapper is the finding, not the constant.

- [ ] **Step 3: Run the gate, separately**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm build` is included because 29 page files changed and it prerenders flag and district
routes; it needs the API running on :3001.

- [ ] **Step 4: Visual round**

Playwright MCP at 320, 360, 390 px and desktop, light and dark, on four pages spanning the
three rhythms: `/araclar` (default), `/hesabim` (tight), `/` (loose), `/deniz` (loose, no
`pb-20` before). Confirm no horizontal scroll at 320px. Screenshot each.

- [ ] **Step 5: Commit and open the PR**

```bash
git add "app/[locale]/(site)" components/v2/page-composition.test.ts
git commit -m "refactor(v2/layout): one page container, thirty-four pages"
gh pr create --base dev --title "T-035 PR1: one page container" --body "$(cat <<'BODY'
Thirty-four pages wrote their body wrapper in two families and six tails —
`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 …` on 29 and `container mx-auto px-4 max-w-7xl …`
on 5, the same intent with the Tailwind tokens reversed. They now share `PageContainer`,
which offers three named rhythms and deliberately takes no `className`: an open passthrough
is how six tails grew out of one.

Five pages also returned their own `min-h-screen bg-background text-foreground flex flex-col`
wrapper, duplicating what `(site)/layout.tsx` has rendered since T-032 PR3. Deleted.

`components/v2/page-composition.test.ts` holds the spelling count as an exact number rather
than a ceiling. `docs/design.md` records why: a raw-palette count that lived only in a comment
"moved without anyone noticing" from 749 to 895. The counter was pinned at its pre-migration
value first and mutation-checked before being tightened.

Verified: typecheck, lint, test and build run as separate commands; Playwright at 320/360/390
and desktop in both themes on four pages spanning the three rhythms.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

# PR2 — `Breadcrumbs`

## Task 5: Pin the three breadcrumb counters

**Files:**

- Modify: `components/v2/page-composition.test.ts`

**Interfaces:**

- Consumes: `walkPages()`, `sourceOf()` from Task 1.
- Produces: the constants `HAND_WRITTEN_BREADCRUMBS`, `BREADCRUMBS_WITHOUT_ARIA_CURRENT`,
  `BREADCRUMBS_WITHOUT_JSONLD`.

- [ ] **Step 1: Add the three counters, pinned at today's numbers**

Measured 2026-09-17: 27 files hand-write the nav; `aria-current` appears **nowhere** on the
product surface (its only two occurrences repo-wide are inside `components/ui/breadcrumb.tsx`
and its showcase specimen); 24 files render a visible breadcrumb and emit no
`breadcrumbJsonLd`.

```ts
/**
 * Both capitalisations. The hand-written navs say `aria-label="Breadcrumb"`; the primitive
 * says `aria-label="breadcrumb"`. A counter matching only the capital spelling would read
 * zero the moment pages migrated AND would have read zero if someone had merely lowercased
 * theirs, so it would not have distinguished the fix from the typo.
 */
const BREADCRUMB_NAV = /aria-label="[Bb]readcrumb"/;

/** The primitive and the component built on it are where the nav is SUPPOSED to be written. */
const BREADCRUMB_OWNERS = [
  "components/ui/breadcrumb.tsx",
  "components/patterns/breadcrumbs.tsx",
] as const;

const SURFACE_ROOTS = [...PAGE_ROOTS, "components/v2"] as const;

function surfaceFiles(): string[] {
  return SURFACE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => !BREADCRUMB_OWNERS.some((owner) => path.endsWith(owner)))
    .sort();
}

const HAND_WRITTEN_BREADCRUMBS = 27;

describe("breadcrumbs are rendered by one component", () => {
  it("the hand-written nav count is exactly the recorded number", () => {
    const files = surfaceFiles().filter((path) => BREADCRUMB_NAV.test(sourceOf(path)));
    expect(files.map(label).sort(), "files still writing their own breadcrumb nav").toHaveLength(
      HAND_WRITTEN_BREADCRUMBS,
    );
  });

  it("the pattern fires on source that carries one — positive control", () => {
    expect(BREADCRUMB_NAV.test('<nav aria-label="Breadcrumb">')).toBe(true);
    expect(BREADCRUMB_NAV.test('<nav aria-label="Breadcrumbs">')).toBe(true);
  });
});
```

Add the `aria-current` and JSON-LD counters in the same shape: a file that matches
`BREADCRUMB_NAV` but not `/aria-current/`, and a file that matches `BREADCRUMB_NAV` but whose
page does not call `breadcrumbJsonLd`. Pin each at the number the run reports, not at the
number written above — the numbers above are the 2026-09-17 measurement and the tree may have
moved.

- [ ] **Step 2: Run and record**

Run: `pnpm vitest run components/v2/page-composition.test.ts`
Expected: PASS once each constant matches reality. Record all three numbers in the commit
message.

- [ ] **Step 3: Mutation-check each of the three**

For the nav counter, delete one hand-written `<nav aria-label="Breadcrumb">` and confirm RED.
For the `aria-current` counter, add `aria-current="page"` to one hand-written last item and
confirm RED. For the JSON-LD counter, add a `breadcrumbJsonLd` call to one page and confirm
RED. Revert all three.

- [ ] **Step 4: Gate and commit**

```bash
pnpm typecheck
pnpm lint
pnpm test
git add components/v2/page-composition.test.ts
git commit -m "test(v2/seo): pin the breadcrumb nav, aria-current and JSON-LD gaps"
```

## Task 6: `Breadcrumbs`

**Files:**

- Create: `components/patterns/breadcrumbs.tsx`
- Create: `components/patterns/breadcrumbs.test.tsx`
- Modify: `components/showcase/registry.ts`
- Modify: `components/showcase/specimens/duzen.tsx`

**Interfaces:**

- Consumes: `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`,
  `BreadcrumbPage`, `BreadcrumbSeparator` from `@/components/ui/breadcrumb`;
  `breadcrumbJsonLd` and `JsonLd` from `@/lib/seo/json-ld`; `isIndexable` and `ContentSurface`
  from `@/lib/seo/indexing`; `Link` from `@/i18n/navigation`.
- Produces: `Breadcrumbs`, props
  `{ items: readonly BreadcrumbTrailItem[]; locale: Locale; surface: ContentSurface }`, where
  `BreadcrumbTrailItem` is `{ label: string; href?: AppPathname; path: string }`. `href` is
  omitted on the last item; `path` is required on every item, because `breadcrumbJsonLd` needs
  a root-relative path for the current page too. Tasks 7 and 8 import both the component and
  the type from `@/components/patterns/breadcrumbs`.

- [ ] **Step 1: Write the failing test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "./breadcrumbs";

const TRAIL = [
  { label: "Ana Sayfa", href: "/" as const, path: "/" },
  { label: "CBS Araçları", path: "/araclar" },
];

describe("Breadcrumbs", () => {
  it("marks the current page with aria-current", () => {
    // Not cosmetic. `aria-current` occurs zero times across the product surface today: 28
    // pages render a trail whose last item is a plain styled span, so assistive technology
    // is never told which crumb is the page you are on.
    const html = renderToStaticMarkup(
      <Breadcrumbs items={TRAIL} locale="tr" surface="localized" />,
    );
    expect(html).toContain('aria-current="page"');
  });

  it("renders a real list, not a row of spans", () => {
    const html = renderToStaticMarkup(
      <Breadcrumbs items={TRAIL} locale="tr" surface="localized" />,
    );
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
  });

  it("emits BreadcrumbList JSON-LD from the same array on an indexable page", () => {
    const html = renderToStaticMarkup(
      <Breadcrumbs items={TRAIL} locale="tr" surface="localized" />,
    );
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"name":"CBS Araçları"');
  });

  it("emits no JSON-LD on a page this locale cannot index", () => {
    // The gate is computed from the surface, never passed per page: a per-page boolean is how
    // 24 files ended up with a visible trail and no structured data.
    const html = renderToStaticMarkup(<Breadcrumbs items={TRAIL} locale="en" surface="trOnly" />);
    expect(html).not.toContain("BreadcrumbList");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run components/patterns/breadcrumbs.test.tsx`
Expected: FAIL — `Cannot find module './breadcrumbs'`.

- [ ] **Step 3: Write the component**

```tsx
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@/i18n/navigation";
import type { AppPathname, Locale } from "@/i18n/routing";
import { isIndexable, type ContentSurface } from "@/lib/seo/indexing";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";

export interface BreadcrumbTrailItem {
  label: string;
  /** Omitted on the last item — the page you are already on is not a link. */
  href?: AppPathname;
  /** Root-relative path for the structured data. Required on the last item, which has no href. */
  path: string;
}

interface BreadcrumbsProps {
  items: readonly BreadcrumbTrailItem[];
  locale: Locale;
  surface: ContentSurface;
}

/**
 * The trail, and the BreadcrumbList that describes it, from ONE array.
 *
 * Measured before this existed: 27 files hand-wrote `<nav aria-label="Breadcrumb">` as a row
 * of spans, and `aria-current` occurred zero times across the whole product surface — 28
 * pages rendered a trail and never told assistive technology which crumb was the current
 * page. Separately, 31 files rendered a visible trail and 11 emitted `breadcrumbJsonLd`, so
 * 24 showed a path to the reader and nothing to a crawler.
 *
 * Both gaps have the same cause: the markup and the structured data were two independent
 * pieces of work, and the second one was optional in practice. Here they are one argument.
 *
 * The indexability gate is COMPUTED from the surface rather than passed as a boolean. A
 * per-page flag is precisely what produced the 24-file gap, and it would reproduce it the
 * first time someone added a page and left the prop off.
 */
export function Breadcrumbs({ items, locale, surface }: BreadcrumbsProps) {
  const last = items.length - 1;

  return (
    <>
      {isIndexable(locale, surface) && (
        <JsonLd
          schema={breadcrumbJsonLd(items.map((item) => ({ name: item.label, path: item.path })))}
        />
      )}
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          {items.map((item, index) => (
            <Fragment key={item.path}>
              <BreadcrumbItem>
                {index === last || item.href === undefined ? (
                  <BreadcrumbPage className="font-semibold">{item.label}</BreadcrumbPage>
                ) : (
                  // `render` is Base UI's slot: the primitive's styling merges onto next-intl's
                  // `Link` instead of wrapping it in a second anchor.
                  <BreadcrumbLink render={<Link href={item.href} prefetch={false} />}>
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index !== last && <BreadcrumbSeparator />}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
```

Note the `path` field: `breadcrumbJsonLd` needs a root-relative path for EVERY item including
the last, which has no `href`. Carrying both is why `BreadcrumbTrailItem` is not just
`{ label, href }`. `prefetch={false}` matches the decision T-029 recorded for chrome links
that appear on every page.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run components/patterns/breadcrumbs.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Register the specimen, then gate and commit**

```bash
pnpm vitest run components/showcase/registry.test.ts
pnpm typecheck
pnpm lint
pnpm test
git add components/patterns/breadcrumbs.tsx components/patterns/breadcrumbs.test.tsx components/showcase/registry.ts components/showcase/specimens/duzen.tsx
git commit -m "feat(v2/seo): add Breadcrumbs, one array for the nav and the BreadcrumbList"
```

## Task 7: Adopt in the two shared components and the four primitive pages

Doing the small, already-correct call sites first surfaces contract problems on six files
rather than twenty-five.

**Files:**

- Modify: `components/v2/v2-sea-basin-detail-view.tsx` (serves 4 sea pages)
- Modify: `components/v2/v2-game-screen.tsx` (serves the 3 play pages)
- Modify: `app/[locale]/(site)/hakkimizda/page.tsx`, `e-posta-dogrulama/page.tsx`,
  `sifre-sifirlama/page.tsx`, `sifre-sifirlama/yeni/page.tsx`
- Modify: `components/v2/page-composition.test.ts`

- [ ] **Step 1: Replace the two shared components' hand-written navs**

Both need `locale` and `surface` threaded in. `v2-sea-basin-detail-view.tsx` already receives
the basin data; add the two props and pass them from the four sea pages, which already hold
their own `surface` constant for `buildMetadata`.

`v2-game-screen.tsx` serves `(play)` routes. Check each against `lib/seo/indexing.ts`: if a
play route is `noindex`, `Breadcrumbs` will correctly emit nothing, and that is the answer, not
a reason to skip the component.

- [ ] **Step 2: Convert the four pages already using the primitive**

These four assemble `Breadcrumb`/`BreadcrumbList`/`BreadcrumbPage` inline. Replace each with
one `Breadcrumbs` call. They gain the JSON-LD they lack today; their visible markup should not
change, because the component renders the same primitives.

- [ ] **Step 3: Lower the three counters, run the gate**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add components/v2 "app/[locale]/(site)" components/v2/page-composition.test.ts
git commit -m "refactor(v2/seo): move the shared views and the four primitive pages onto Breadcrumbs"
```

## Task 8: Adopt on the remaining 25 pages, drive the counters to zero

**Files:**

- Modify: the 25 remaining page files listed by the Task 5 counter
- Modify: `components/v2/page-composition.test.ts`

- [ ] **Step 1: Replace each hand-written nav**

The before/after for `app/[locale]/(site)/araclar/page.tsx:73-86`:

```tsx
// before
<nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
  <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
    <Home className="size-3.5" />
    <span>Ana Sayfa</span>
  </Link>
  <ChevronRight className="size-3.5" />
  <span className="text-foreground font-semibold">CBS Araçları</span>
</nav>

// after
<Breadcrumbs
  items={[
    { label: "Ana Sayfa", href: "/", path: "/" },
    { label: "CBS Araçları", path: "/araclar" },
  ]}
  locale={locale}
  surface={TOOLS_SURFACE}
/>
```

Delete the now-unused `Home` and `ChevronRight` imports from each file; `pnpm lint` catches any
that are missed. Where a page already calls `breadcrumbJsonLd` by hand, delete that call — the
component now emits it from the same array, and leaving both would publish the trail twice.

- [ ] **Step 2: Set all three counters to zero**

```ts
const HAND_WRITTEN_BREADCRUMBS = 0;
const BREADCRUMBS_WITHOUT_ARIA_CURRENT = 0;
const BREADCRUMBS_WITHOUT_JSONLD = 0;
```

A zero counter needs its positive control more than any other: with nothing left to find, a
broken regex and a finished migration look identical. The `BREADCRUMB_NAV` control from Task 5
covers this and must stay.

- [ ] **Step 3: Run the full gate separately**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

- [ ] **Step 4: Verify the structured data is real, not just present**

Run `pnpm dev`, open `/araclar`, and read the emitted JSON-LD out of the served HTML:

```bash
curl -s http://localhost:3000/araclar | grep -o '"@type":"BreadcrumbList".\{0,400\}'
```

Expected: a `BreadcrumbList` whose `itemListElement` entries carry absolute URLs on the real
origin and positions starting at 1. Then confirm a `noindex` page emits none:

```bash
curl -s http://localhost:3000/giris | grep -c 'BreadcrumbList'
```

Expected: `0`.

- [ ] **Step 5: Accessibility check**

Playwright MCP on `/araclar` and `/turkiye/istanbul`: confirm the breadcrumb is announced as a
list, the last crumb carries `aria-current="page"`, and the focus ring is visible on each link
at 390px and desktop in both themes.

- [ ] **Step 6: Commit and open the PR**

```bash
git add "app/[locale]/(site)" components/v2/page-composition.test.ts
git commit -m "refactor(v2/seo): one breadcrumb component, and the BreadcrumbList 24 pages were missing"
gh pr create --base dev --title "T-035 PR2: one breadcrumb, with its structured data" --body "$(cat <<'BODY'
Two defects, one cause.

`aria-current` occurred **zero** times across the product surface. Its only two occurrences
repo-wide were inside `components/ui/breadcrumb.tsx` and that primitive's showcase specimen.
28 pages rendered a breadcrumb whose last item was a styled `<span>`, so assistive technology
was never told which crumb is the page you are on — and none of the hand-written trails used
`<ol>`/`<li>`, so none was announced as a list either. The four pages already using the
primitive were fine; the other 28 hand-wrote the markup.

Separately, 31 files rendered a visible trail and 11 emitted `breadcrumbJsonLd`. 24 showed a
path to the reader and nothing to a crawler. Unlike FAQ rich results, which Google restricted
to authoritative government and health sites in 2023, BreadcrumbList is unrestricted and
widely shown — the trail replaces the raw URL in the result.

Both gaps had the same cause: markup and structured data were two independent pieces of work
and the second was optional in practice. `Breadcrumbs` derives them from one array, and
computes indexability from the page's `ContentSurface` rather than taking a boolean — a
per-page flag is exactly what produced the 24-file gap.

Verified: typecheck, lint, test and build as separate commands; the emitted BreadcrumbList
read out of served HTML with absolute URLs and positions from 1; a `noindex` page confirmed to
emit none; Playwright announcement and focus-ring check in both themes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## After both PRs land

Verify on production once `dev` reaches `main`, per the T-032/T-038 lesson that a green deploy
and a verified local build both reported "no problem" while the live sitemap served 31 URLs
instead of 320:

```bash
curl -s http://62.238.60.47/araclar | grep -c 'BreadcrumbList'
```

(Plain HTTP on a bare IP is T-019; it is the reason this is a `curl` and not a browser check.)

Then write the PR3-PR6 plan against the tree as it stands at that point, not as it stands now.
