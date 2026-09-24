# T-037 Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every server fetch on the web site renders behind a Suspense boundary with a measured skeleton, and every route that must block before its first `return` gets a `loading.tsx` built from the same skeleton pieces.

**Architecture:** One pattern component (`components/patterns/page-skeleton.tsx`) supplies the skeleton pieces and the per-shape compositions. Loaders that more than one boundary reads are wrapped in React `cache()` inside `lib/api/*` so the split does not multiply API calls (`apiGet` passes an `AbortSignal`, which opts out of Next's fetch memoization). Each page keeps `notFound()`/`redirect()` before its first `return` and moves every data-consuming region into a top-level `async function` component **declared in the same `page.tsx`**, rendered inside `<Suspense>`. Declaring the sections in-file (not in `_sections/` files) is deliberate: the composition scanners pin exact `page.tsx` paths for FAQ blocks, breadcrumbs, `<h1>` and hand-drawn card counts, and an in-file top-level declaration is followed by their render walk while a new file is not.

**Tech Stack:** Next.js 16.2 App Router, React 19.2 (`Suspense`, `cache`), next-intl 4, Tailwind v4, vitest (node, `renderToStaticMarkup`), Playwright MCP for screenshots.

**Spec:** `docs/superpowers/specs/2026-09-24-t037-loading-states-design.md`

## Global Constraints

- Work on branch `feature/t037-loading-states` in `cografya_web`; never `git worktree`. Conventional Commits with a **lowercase** subject (commitlint rejects `T-037` in the subject; write `t-037`).
- Gate before every commit: `pnpm typecheck && pnpm lint && pnpm test`. `pnpm test` runs ~5,000 tests in ~2 min.
- `notFound()` and `redirect()` are called before the first `return` of a page, never inside a Suspense child.
- Skeleton surfaces use `Skeleton` (`bg-muted`) only. **No `bg-card` and no `border-border` on any skeleton element** — `lib/test-support/composition-scan.ts` `walkCardSurface()` scans `components/patterns/` and every `app/[locale]` file, and the hand-drawn card counters are pinned at 190 / 169 / 235.
- Colour through bridge tokens only (`bg-muted`, `text-muted-foreground`); no raw palette class, no `dark:` — `components/ui/token-binding.test.ts` applies all four rules to `components/patterns/`.
- Every export of `page-skeleton.tsx` has `className?: never`.
- `<Breadcrumbs>` stays in `page.tsx`, outside any boundary (`lib/seo/sitemap-surface-symmetry.test.ts` pins 33 pairs by file).
- JSX moved into an in-file section component keeps its class strings byte-identical (the card counters count spellings).
- Section components are Server Components: no `"use client"`, no state. A client island receives awaited data as props exactly as today.
- User-facing Turkish copy follows `docs/copy.md` ("sen", plain words). The only new copy is `Common.loading`.
- Skeleton geometry mirrors the live plates: `aspect-[1270/580]` (explorers, tool workbench, province/region locator), `aspect-[1000/521]` (continent locator), `aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]` (game plate).

## Review Focus

1. **A fetch that rejects inside a boundary during streaming** (API down after the shell was sent): the page must fall to `(site)/error.tsx` exactly as today, not render a half page with an empty box. Pinned in Task 2 by asserting the `*Resilient` wrappers still re-throw at runtime after being wrapped in `cache()`.
2. **`/en/...` requests while `ENGLISH_ENABLED = false`**: `loading.tsx` renders before the redirect logic? No — the 301 is in `proxy.ts`, before rendering. Task 1's test renders `PageSkeleton` under an `en` provider to prove the label falls back cleanly if EN is ever re-enabled.
3. **A province with no climate class and no series but with similar-climate provinces** (`climateBlockGates` `showSection` depends on `hasSimilarClimate`): moving `similarClimate` into a boundary must not hide the chips. Task 8 recomputes the gate inside the chips component and adds a test to `lib/climate/climate-block-gates.test.ts`.
4. **Two boundaries on one page calling the same loader** must issue one network request: Task 2 pins every shared loader as `cache(`-wrapped by source assertion (React's `cache` is a passthrough outside a server render, so a runtime dedupe test is not possible in vitest; the mutation is un-wrapping one loader).
5. **A skeleton left on screen for a reader using a screen reader**: exactly one `role="status"` per fallback tree. Task 1 tests that nested pieces with `announce={false}` emit no second live region, and Task 12 ensures the member hub's own `role="status"` is not doubled.

---

### Task 1: `PageSkeleton` pattern, message key, specimen, roster

**Files:**

- Create: `components/patterns/page-skeleton.tsx`
- Create: `components/patterns/page-skeleton.test.tsx`
- Modify: `messages/tr.json` (`Common` block, line 2–12), `messages/en.json` (`Common`)
- Modify: `components/showcase/registry.ts:54` (`geri-bildirim` category)
- Modify: `components/showcase/specimens/geri-bildirim.tsx` (add a specimen after the `Skeleton` one, ~line 65)
- Modify: `docs/design.md` patterns bullet (line ~178: the `- **\`components/patterns/\`**` bullet)

**Interfaces:**

- Produces:

  ```ts
  export type PlateAspect = "map" | "continent" | "game";
  export type PageSkeletonShape = "hub" | "detail" | "account" | "auth" | "play";
  export function PageSkeleton(props: { shape: PageSkeletonShape; className?: never }): JSX.Element;
  export function BreadcrumbsSkeleton(props: { className?: never }): JSX.Element;
  export function HeroSkeleton(props: {
    tier: "hub" | "detail";
    tiles?: 0 | 2 | 4;
    announce?: boolean;
    className?: never;
  }): JSX.Element;
  export function StatTileSkeleton(props: { announce?: boolean; className?: never }): JSX.Element;
  export function PlateSkeleton(props: {
    aspect: PlateAspect;
    announce?: boolean;
    className?: never;
  }): JSX.Element;
  export function ProseSkeleton(props: {
    lines: 2 | 3 | 4 | 6;
    heading?: boolean;
    announce?: boolean;
    className?: never;
  }): JSX.Element;
  export function CardGridSkeleton(props: {
    columns: "2" | "3" | "2-4";
    count: number;
    announce?: boolean;
    className?: never;
  }): JSX.Element;
  export function InlineSkeleton(props: {
    width: "sm" | "md" | "lg";
    announce?: boolean;
    className?: never;
  }): JSX.Element;
  ```

  `announce` defaults to `true`: the piece's root is `<div role="status" aria-busy="true">` with an `sr-only` label. `PageSkeleton` announces once and renders its pieces with `announce={false}`.

- [ ] **Step 1: Add the message key**

In `messages/tr.json`, inside `"Common"`, after `"enWorkInProgress": …,` add:

```json
    "loading": "Yükleniyor…",
```

In `messages/en.json`, inside `"Common"`, after `"enWorkInProgress": …,` add:

```json
    "loading": "Loading…",
```

Run `pnpm test -- lib/i18n` — expected PASS (the key-existence suite reads both catalogues).

- [ ] **Step 2: Write the failing test**

`components/patterns/page-skeleton.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import {
  BreadcrumbsSkeleton,
  CardGridSkeleton,
  HeroSkeleton,
  InlineSkeleton,
  PageSkeleton,
  PlateSkeleton,
  ProseSkeleton,
  StatTileSkeleton,
} from "./page-skeleton";

const SHAPES = ["hub", "detail", "account", "auth", "play"] as const;

function render(node: React.ReactNode, locale: "tr" | "en" = "tr") {
  const messages = locale === "tr" ? tr : en;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("PageSkeleton", () => {
  it.each(SHAPES)("shape %s announces exactly once and marks itself busy", (shape) => {
    const html = render(<PageSkeleton shape={shape} />);
    expect(count(html, 'role="status"')).toBe(1);
    expect(count(html, 'aria-busy="true"')).toBe(1);
    expect(html).toContain("Yükleniyor…");
  });

  it("reads the label from the active locale", () => {
    expect(render(<PageSkeleton shape="hub" />, "en")).toContain("Loading…");
  });

  it("hides every bar from assistive tech", () => {
    const html = render(<PageSkeleton shape="hub" />);
    const bars = count(html, 'data-slot="skeleton"');
    expect(bars).toBeGreaterThan(5);
    expect(count(html, 'data-slot="skeleton" aria-hidden="true"')).toBe(bars);
  });

  it("uses no card surface token — the hand-drawn card counters must not see it", () => {
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./page-skeleton.tsx", import.meta.url)), "utf8"),
    );
    expect(source).not.toMatch(/\bbg-card\b/);
    expect(source).not.toMatch(/\bborder-border\b/);
    expect(source).not.toMatch(/\bdark:/);
  });

  it("offers no className escape hatch on any export", () => {
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./page-skeleton.tsx", import.meta.url)), "utf8"),
    );
    // Once in the shared `Announce` props (six pieces), once on `BreadcrumbsSkeleton`, once on
    // `PageSkeleton`. Every `export function` must reach one of the three.
    expect(source.match(/className\?: never/g)?.length).toBe(3);
    const exportsWithoutIt = [...source.matchAll(/export function (\w+)\(([^)]*)\)/g)]
      .filter(([, , params]) => !/Announce|className\?: never/.test(params))
      .map(([, name]) => name);
    expect(exportsWithoutIt).toEqual([]);
  });

  it("InlineSkeleton is span-rooted so it can sit inside a <p>", () => {
    expect(render(<InlineSkeleton width="sm" />)).toMatch(/^<span role="status"/);
    expect(render(<InlineSkeleton width="sm" announce={false} />)).toMatch(/^<span /);
  });

  it("mirrors the live plates byte for byte", () => {
    const explorer = stripComments(
      readFileSync(
        fileURLToPath(new URL("../v2/v2-earthquake-explorer.tsx", import.meta.url)),
        "utf8",
      ),
    );
    const game = stripComments(
      readFileSync(fileURLToPath(new URL("../v2/v2-game-screen.tsx", import.meta.url)), "utf8"),
    );
    const continent = stripComments(
      readFileSync(
        fileURLToPath(new URL("../v2/v2-continent-locator-map.tsx", import.meta.url)),
        "utf8",
      ),
    );
    expect(explorer).toContain("aspect-[1270/580]");
    expect(game).toContain("aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]");
    expect(continent).toContain("aspect-[1000/521]");
    expect(render(<PlateSkeleton aspect="map" />)).toContain("aspect-[1270/580]");
    expect(render(<PlateSkeleton aspect="game" />)).toContain(
      "aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]",
    );
    expect(render(<PlateSkeleton aspect="continent" />)).toContain("aspect-[1000/521]");
  });

  it("pieces can be silenced so a page announces once", () => {
    for (const piece of [
      <HeroSkeleton key="h" tier="hub" tiles={4} announce={false} />,
      <StatTileSkeleton key="s" announce={false} />,
      <PlateSkeleton key="p" aspect="map" announce={false} />,
      <ProseSkeleton key="r" lines={3} announce={false} />,
      <CardGridSkeleton key="c" columns="2" count={4} announce={false} />,
      <InlineSkeleton key="i" width="md" announce={false} />,
    ]) {
      expect(count(render(piece), 'role="status"')).toBe(0);
    }
    expect(count(render(<BreadcrumbsSkeleton />), 'role="status"')).toBe(0);
  });

  it("the hub hero renders the requested tile count inside the shared grid", () => {
    const html = render(<HeroSkeleton tier="hub" tiles={4} />);
    expect(count(html, 'data-skeleton="stat-tile"')).toBe(4);
    expect(html).toContain("grid-cols-2 sm:grid-cols-4");
  });

  it("the detail shape renders the band and the 12-column body", () => {
    const html = render(<PageSkeleton shape="detail" />);
    expect(html).toContain("lg:grid-cols-12");
    expect(html).toContain("lg:col-span-8");
    expect(html).toContain("lg:col-span-4");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run components/patterns/page-skeleton.test.tsx`
Expected: FAIL — `Cannot find module './page-skeleton'`.

- [ ] **Step 4: Write the component**

`components/patterns/page-skeleton.tsx`:

```tsx
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageContainer } from "./page-container";
import { StatGrid } from "./stat-grid";

/**
 * The loading state of a reading page, and the pieces it is made of.
 *
 * Every piece mirrors one T-035 component's measured geometry — `PageHero`, `StatTile`,
 * `StatGrid`, the explorer plates — so that the content which replaces it lands in the same box.
 * A `loading.tsx` renders `PageSkeleton` with the shape its family of pages has; a Suspense
 * fallback inside a page renders one piece. Because both draw from this file, the swap from the
 * route-level skeleton to the page shell with its section fallbacks moves nothing.
 *
 * Only `bg-muted` (through `Skeleton`) — never `bg-card` or `border-border`. The card counters in
 * `components/v2/page-composition-cards.test.ts` walk `components/patterns/` too, and a skeleton
 * that borrowed a card's tokens would enter them as a hand-drawn card.
 *
 * `useTranslations`, not `getTranslations`: a Suspense fallback must not itself suspend, and the
 * sync hook is legal in a Server Component (`map-attribution.tsx` is the precedent).
 */

const PLATE_ASPECT = {
  /** `V2EarthquakeExplorer`, `V2MarineMapExplorer`, `V2TurkeyMapExplorer`, `V2ToolWorkbench`,
   *  `V2ProvinceLocatorMap`, `V2RegionLocatorMap`. */
  map: "aspect-[1270/580]",
  /** `V2ContinentLocatorMap`. */
  continent: "aspect-[1000/521]",
  /** `V2GameScreen`'s figure plate. */
  game: "aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]",
} as const;

export type PlateAspect = keyof typeof PLATE_ASPECT;
export type PageSkeletonShape = "hub" | "detail" | "account" | "auth" | "play";

interface Announce {
  /** `false` inside a tree that already carries one `role="status"`. */
  readonly announce?: boolean;
  /** No escape hatch — the rule `PageContainer`, `PageHero` and `StatTile` carry. */
  readonly className?: never;
}

function Status({
  announce,
  as: Tag = "div",
  children,
}: {
  announce: boolean;
  /** `span` for a piece that renders inside a `<p>` — a `<div>` there is invalid HTML. */
  as?: "div" | "span";
  children: ReactNode;
}) {
  const t = useTranslations("Common");
  if (!announce) return <>{children}</>;
  return (
    <Tag role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      {children}
    </Tag>
  );
}

function Bar({ className }: { className: string }) {
  return <Skeleton aria-hidden="true" className={className} />;
}

export function BreadcrumbsSkeleton(_props: { readonly className?: never }) {
  return (
    <div className="flex items-center gap-2 text-xs" aria-hidden="true">
      <Bar className="h-3 w-16" />
      <Bar className="h-3 w-3 rounded-full" />
      <Bar className="h-3 w-24" />
    </div>
  );
}

export function StatTileSkeleton({ announce = true }: Announce) {
  return (
    <Status announce={announce}>
      <div data-skeleton="stat-tile" className="flex flex-col rounded-2xl bg-muted/40 p-4">
        <Bar className="h-8 w-20 sm:h-9" />
        <Bar className="mt-1.5 h-4 w-28" />
      </div>
    </Status>
  );
}

export function HeroSkeleton({
  tier,
  tiles = 0,
  announce = true,
}: Announce & { readonly tier: "hub" | "detail"; readonly tiles?: 0 | 2 | 4 }) {
  const heading = tier === "hub" ? "h-9 w-3/4 sm:h-12" : "h-10 w-2/3 sm:h-[60px]";
  const body = (
    <>
      <div className="relative z-10 max-w-3xl space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Bar className="h-6 w-24 rounded-full" />
          <Bar className="h-6 w-32 rounded-full" />
        </div>
        <Bar className={heading} />
        <div className="space-y-2">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-11/12" />
        </div>
      </div>
      {tiles > 0 ? (
        <StatGrid columns={tiles === 2 ? "2" : "2-4"} gutter="hero">
          {Array.from({ length: tiles }, (_, i) => (
            <StatTileSkeleton key={i} announce={false} />
          ))}
        </StatGrid>
      ) : null}
    </>
  );
  return (
    <Status announce={announce}>
      {tier === "hub" ? <Card variant="feature">{body}</Card> : body}
    </Status>
  );
}

export function PlateSkeleton({
  aspect,
  announce = true,
}: Announce & { readonly aspect: PlateAspect }) {
  return (
    <Status announce={announce}>
      <Bar className={cn("w-full rounded-2xl", PLATE_ASPECT[aspect])} />
    </Status>
  );
}

export function ProseSkeleton({
  lines,
  heading = true,
  announce = true,
}: Announce & { readonly lines: 2 | 3 | 4 | 6; readonly heading?: boolean }) {
  return (
    <Status announce={announce}>
      <div className="space-y-3">
        {heading ? <Bar className="h-7 w-1/2" /> : null}
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </Status>
  );
}

const GRID_COLUMNS = {
  "2": "grid-cols-1 sm:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  "2-4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function CardGridSkeleton({
  columns,
  count,
  announce = true,
}: Announce & { readonly columns: keyof typeof GRID_COLUMNS; readonly count: number }) {
  return (
    <Status announce={announce}>
      <div className={cn("grid gap-5", GRID_COLUMNS[columns])}>
        {Array.from({ length: count }, (_, i) => (
          <Bar key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    </Status>
  );
}

const INLINE_WIDTH = { sm: "w-16", md: "w-32", lg: "w-56" } as const;

/**
 * One line of text still in flight — a lede variant, a stat trio, a footer credit. Renders a
 * `<span>`, not the `Skeleton` div, because its callers put it inside a `<p>` (`PageHero`'s lede).
 * The class string is `Skeleton`'s own three tokens; `components/ui/skeleton.tsx` is CLI-managed
 * and cannot grow an `as` prop without risking an overwrite.
 */
export function InlineSkeleton({
  width,
  announce = true,
}: Announce & { readonly width: keyof typeof INLINE_WIDTH }) {
  return (
    <Status announce={announce} as="span">
      <span
        data-slot="skeleton"
        aria-hidden="true"
        className={cn(
          "inline-block h-4 align-middle animate-pulse rounded-md bg-muted",
          INLINE_WIDTH[width],
        )}
      />
    </Status>
  );
}

function HubShape() {
  return (
    <PageContainer>
      <div className="space-y-4">
        <BreadcrumbsSkeleton />
        <HeroSkeleton tier="hub" tiles={4} announce={false} />
      </div>
      <PlateSkeleton aspect="map" announce={false} />
    </PageContainer>
  );
}

function DetailShape() {
  return (
    <>
      <section className="relative overflow-hidden py-10 sm:py-14">
        <PageContainer space="band">
          <BreadcrumbsSkeleton />
          <HeroSkeleton tier="detail" tiles={4} announce={false} />
        </PageContainer>
      </section>
      <PageContainer space="default">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-8">
            <Bar className="h-64 rounded-3xl" />
            <Bar className="h-48 rounded-3xl" />
          </div>
          <div className="lg:col-span-4">
            <Bar className="h-96 rounded-3xl" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function AccountShape() {
  return (
    <PageContainer space="tight">
      <BreadcrumbsSkeleton />
      <div className="space-y-1.5">
        <Bar className="h-9 w-64 sm:h-12" />
        <Bar className="h-4 w-96 max-w-full" />
      </div>
      <CardGridSkeleton columns="2" count={4} announce={false} />
    </PageContainer>
  );
}

function AuthShape() {
  return (
    <PageContainer>
      <BreadcrumbsSkeleton />
      <HeroSkeleton tier="hub" announce={false} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 xl:col-span-5">
          <Bar className="h-[520px] rounded-3xl" />
        </div>
        <div className="lg:col-span-6 xl:col-span-7">
          <Bar className="h-[520px] rounded-3xl" />
        </div>
      </div>
    </PageContainer>
  );
}

function PlayShape() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BreadcrumbsSkeleton />
        <div className="flex gap-2">
          <Bar className="h-8 w-28 rounded-lg" />
          <Bar className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <Bar className="h-24 rounded-3xl" />
      <div className="space-y-5 rounded-3xl bg-muted/30 p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Bar key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <PlateSkeleton aspect="game" announce={false} />
      </div>
    </div>
  );
}

const SHAPES: Record<PageSkeletonShape, () => ReactNode> = {
  hub: HubShape,
  detail: DetailShape,
  account: AccountShape,
  auth: AuthShape,
  play: PlayShape,
};

export function PageSkeleton({
  shape,
}: {
  readonly shape: PageSkeletonShape;
  readonly className?: never;
}) {
  const Shape = SHAPES[shape];
  return (
    <Status announce>
      <Shape />
    </Status>
  );
}
```

Check `components/ui/skeleton.tsx` spreads `...props` onto the `div` (it does) so `aria-hidden` lands on every bar.

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run components/patterns/page-skeleton.test.tsx`
Expected: PASS. If `NextIntlClientProvider` cannot be rendered in node, import `{ NextIntlClientProvider } from "next-intl"` is correct for next-intl 4; do not switch to `next-intl/server`.

- [ ] **Step 6: Add the specimen and the registry entry**

In `components/showcase/specimens/geri-bildirim.tsx`, add the import and, after the closing `</Specimen>` of the `Skeleton` specimen, a new one:

```tsx
import { PageSkeleton, PlateSkeleton, StatTileSkeleton } from "@/components/patterns/page-skeleton";
```

```tsx
<Specimen
  name="PageSkeleton"
  description="Bir sayfanın yükleme hâli. loading.tsx ve Suspense fallback'leri bu parçalardan kurulur; içerik gelince hiçbir şey yerinden oynamaz, çünkü parçalar gerçek sayfanın ölçüsünü taşır. Tek role=status, çubuklar aria-hidden."
>
  <div className="space-y-6">
    <PageSkeleton shape="hub" />
    <div className="grid grid-cols-2 gap-3">
      <StatTileSkeleton />
      <StatTileSkeleton />
    </div>
    <PlateSkeleton aspect="continent" />
  </div>
</Specimen>
```

In `components/showcase/registry.ts` line 54, change:

```ts
    components: ["alert", "sonner", "tooltip", "skeleton"],
```

to

```ts
    components: ["alert", "sonner", "tooltip", "skeleton", "page-skeleton"],
```

In `docs/design.md`, in the `components/patterns/` bullet, append `` `page-skeleton` `` to the list after `` `faq-section` ``.

- [ ] **Step 7: Run the showcase and token suites**

Run: `pnpm vitest run components/showcase components/ui/token-binding.test.ts components/orphan.test.ts`
Expected: PASS. (`orphan.test.ts` counts `page-skeleton.tsx` as showcase-only for now; it is reached from `components/showcase/specimens/geri-bildirim.tsx`, which is live via `/design-system`. It becomes product-live in Task 4.) If `orphan.test.ts` classifies a showcase-only pattern as an orphan, leave it red until Task 4 and note it in the commit body — do not add an exemption.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/patterns/page-skeleton.tsx components/patterns/page-skeleton.test.tsx messages/tr.json messages/en.json components/showcase/registry.ts components/showcase/specimens/geri-bildirim.tsx docs/design.md
git commit -m "feat(patterns): page skeleton pieces and shapes for loading states (t-037)"
```

---

### Task 2: Cached loaders in `lib/api/*`

**Files:**

- Modify: `lib/api/provinces.ts` (`getProvinces` :14, `getMapSummary` :25, `getProvincesResilient` :68, `getMapSummaryResilient` :95)
- Modify: `lib/api/countries.ts` (`getCountries` :18, `getCountryMapSummary` :44, `getCountriesResilient` :70, `getCountryMapSummaryResilient` :93)
- Modify: `lib/api/regions.ts` (`getRegionsResilient` :45)
- Modify: `lib/api/books.ts` (`getBooksResilient` :154)
- Modify: `lib/api/marine.ts` (`getMarinePointsSafe` :137, `getMarineLayersSafe` :161, `getMarineOverviewSafe` :218)
- Modify: `lib/api/earthquakes.ts` (`getEarthquakeMetaSafe` :180)
- Create: `lib/api/request-dedupe.test.ts`

**Interfaces:**

- Produces: the same names and signatures as today, declared as `export const name = cache(async (...) => …)`. Callers change nothing.

- [ ] **Step 1: Write the failing test**

`lib/api/request-dedupe.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * `apiGet` passes an `AbortSignal` on every call, and Next's `dedupe-fetch` returns the raw
 * `fetch` when a signal is present — so two sections of one page that each call
 * `getProvincesResilient()` make TWO requests unless something above `apiGet` memoizes. React
 * `cache()` is that something: per request, shared by `generateMetadata` and every Suspense
 * child. React's `cache` is a passthrough outside a server render, so this cannot be shown at
 * runtime under vitest; the wrap is pinned in source instead, comments stripped.
 */
const SHARED_LOADERS: Record<string, readonly string[]> = {
  "provinces.ts": [
    "getProvinces",
    "getMapSummary",
    "getProvincesResilient",
    "getMapSummaryResilient",
  ],
  "countries.ts": [
    "getCountries",
    "getCountryMapSummary",
    "getCountriesResilient",
    "getCountryMapSummaryResilient",
  ],
  "regions.ts": ["getRegionsResilient"],
  "books.ts": ["getBooksResilient"],
  "marine.ts": ["getMarinePointsSafe", "getMarineLayersSafe", "getMarineOverviewSafe"],
  "earthquakes.ts": ["getEarthquakeMetaSafe"],
};

const source = (file: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8"));

describe("loaders read by more than one Suspense boundary are wrapped in React cache()", () => {
  for (const [file, names] of Object.entries(SHARED_LOADERS)) {
    it(`${file} imports cache from react`, () => {
      expect(source(file)).toMatch(/import \{[^}]*\bcache\b[^}]*\} from "react"/);
    });
    for (const name of names) {
      it(`${file}: ${name} is a cache(...) constant`, () => {
        expect(source(file)).toMatch(new RegExp(`export const ${name} = cache\\(`));
        expect(source(file)).not.toMatch(new RegExp(`export async function ${name}\\b`));
      });
    }
  }

  it("the runtime re-throw of the Resilient wrappers survived the wrap", () => {
    // The wrap must not swallow: `isProductionBuild()` decides `return []` vs `throw error`.
    const provinces = source("provinces.ts");
    const resilient = provinces.slice(provinces.indexOf("export const getProvincesResilient"));
    expect(resilient).toMatch(
      /if \(isProductionBuild\(\)\) \{[\s\S]*?return \[\];[\s\S]*?\}\s*throw error;/,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/api/request-dedupe.test.ts`
Expected: FAIL on every `is a cache(...) constant` case.

- [ ] **Step 3: Wrap the loaders**

For each listed function, convert the declaration form without touching the body. Example, `lib/api/provinces.ts`:

```ts
import { cache } from "react";
```

```ts
// before
export async function getProvincesResilient(): Promise<ProvinceListItem[]> {
  try {
    return await getProvinces();
  } catch (error) {
    …
  }
}
// after
export const getProvincesResilient = cache(async (): Promise<ProvinceListItem[]> => {
  try {
    return await getProvinces();
  } catch (error) {
    …
  }
});
```

Do the same for `getProvinces`, `getMapSummary`, `getMapSummaryResilient`; in `countries.ts` for `getCountries`, `getCountryMapSummary`, `getCountriesResilient`, `getCountryMapSummaryResilient`; in `regions.ts` for `getRegionsResilient`; in `books.ts` for `getBooksResilient`; in `marine.ts` for `getMarinePointsSafe`, `getMarineLayersSafe`, `getMarineOverviewSafe`; in `earthquakes.ts` for `getEarthquakeMetaSafe`. Keep every docblock where it is; add one line to each wrapped loader's docblock: `Wrapped in React cache() — see lib/api/request-dedupe.test.ts.`

`getCountriesForFlagAuthorization` (countries.ts:32) is NOT wrapped: it is read by `app/flags/[flag]`, a route handler, once.

Hoisting note: `export const` is not hoisted like a function declaration. `getProvincesResilient` calls `getProvinces`, declared above it — fine. In `countries.ts`, `getCountriesResilient` (line 70) calls `getCountries` (line 18) — fine. Check each file's call order after converting; if a wrapped constant is referenced above its declaration, move the declaration up.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/api`
Expected: PASS, including the existing suites under `lib/api/` that call these loaders with mocked `fetch` (the passthrough `cache` keeps their behaviour).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add lib/api
git commit -m "perf(api): wrap shared loaders in react cache so split sections fetch once (t-037)"
```

---

### Task 3: `/turkiye` and `/dunya` — dynamic hubs

**Files:**

- Modify: `app/[locale]/(site)/turkiye/page.tsx` (default export lines 69–112, StatGrid lines 187–201, explorer lines 205–230, JSON-LD block ~lines 113–140)
- Create: `app/[locale]/(site)/turkiye/loading.tsx`
- Modify: `app/[locale]/(site)/dunya/page.tsx` (default export lines 69–128, JSON-LD 130–155, StatGrid 187–199, explorer 203–214)
- Create: `app/[locale]/(site)/dunya/loading.tsx`

**Interfaces:**

- Consumes: `PageSkeleton`, `StatTileSkeleton`, `PlateSkeleton` (Task 1); cached `getProvincesResilient`, `getMapSummaryResilient`, `getCountriesResilient`, `getCountryMapSummaryResilient` (Task 2).

- [ ] **Step 1: Create the two `loading.tsx` files**

`app/[locale]/(site)/turkiye/loading.tsx`:

```tsx
import { PageSkeleton } from "@/components/patterns/page-skeleton";

/**
 * `/turkiye` is `force-dynamic`, so Next prefetches the route only down to this boundary and
 * paints it on click, before the server answers. It renders the same pieces the page uses as
 * its Suspense fallbacks, so the swap to the page shell moves nothing.
 */
export default function Loading() {
  return <PageSkeleton shape="hub" />;
}
```

`app/[locale]/(site)/dunya/loading.tsx`: identical with `/dunya` in the docblock.

- [ ] **Step 2: Restructure `/turkiye`**

In `app/[locale]/(site)/turkiye/page.tsx`:

1. Add imports:
   ```tsx
   import { Suspense } from "react";
   import { PlateSkeleton, StatTileSkeleton } from "@/components/patterns/page-skeleton";
   ```
2. Move the data derivation (lines 74–112: the `Promise.all`, `summaryMap`, `provinces: ProvinceItem[]`, `totalProvinces`, `totalDistricts`) out of the default export into a top-level helper placed above it:
   ```tsx
   async function loadTurkiyeHub(locale: Locale) {
     const [rawProvinces, rawSummary] = await Promise.all([
       getProvincesResilient(),
       getMapSummaryResilient(),
     ]);
     const summaryMap = new Map<string, ProvinceMapSummary>();
     for (const s of rawSummary) summaryMap.set(s.plateCode, s);
     const provinces: ProvinceItem[] = rawProvinces.map((prov) => {
       // …the existing mapping body, unchanged…
     });
     return {
       provinces,
       totalProvinces: provinces.length,
       totalDistricts: rawSummary.reduce((acc, s) => acc + (s.districtCount ?? 0), 0),
     };
   }
   ```
   Keep the existing comments (`NO || 81 …`) with the lines they explain. Both loaders are `cache()`-wrapped, so every section below calling `loadTurkiyeHub` hits the network once per request; `generateMetadata`'s own `getProvincesResilient()` call joins the same entry.
3. Add three top-level async section components above the default export:
   ```tsx
   async function ProvinceCountTile() {
     const { totalProvinces } = await loadTurkiyeHub("tr");
     return (
       <StatTile
         label="İl sayısı"
         value={totalProvinces}
         unit="İl"
         tone="primary"
         absent={{ label: "İl listesi yok", hint: "Liste yüklenemedi" }}
       />
     );
   }

   async function DistrictCountTile() {
     const { totalDistricts } = await loadTurkiyeHub("tr");
     return (
       <StatTile
         label="İlçe sayısı"
         value={totalDistricts}
         tone="accent"
         absent={{ label: "İlçe sayısı yok", hint: "Özet verisi gelmedi" }}
       />
     );
   }

   async function TurkiyeExplorer({ locale }: { locale: Locale }) {
     const t = await getTranslations({ locale, namespace: "Turkiye" });
     const { provinces, totalProvinces } = await loadTurkiyeHub(locale);
     return (
       <>
         <JsonLd
           schema={[
             collectionPageJsonLd({/* the existing call, using totalProvinces */}),
             itemListJsonLd({/* the existing call, using provinces */}),
           ]}
         />
         <V2TurkeyMapExplorer
           provinces={provinces}
           regionsSection={/* the existing regionsSection JSX, moved verbatim */}
         />
       </>
     );
   }
   ```
   Note `loadTurkiyeHub("tr")` in the tiles: the tiles do not depend on locale (`slugForLocale` only affects `path`), and passing the literal keeps the cache key identical across the three sections. If `loadTurkiyeHub` is called with two different locales in one render it fetches once anyway (the loaders, not the helper, are cached) — the helper itself is cheap.
4. In the default export, delete the moved lines; the function now awaits only `params` and `getTranslations`. Replace the two data tiles in the `StatGrid` with:
   ```tsx
   <Suspense fallback={<StatTileSkeleton />}>
     <ProvinceCountTile />
   </Suspense>
   <StatTile label="Coğrafi bölge" fact="7" tone="secondary" />
   <Suspense fallback={<StatTileSkeleton />}>
     <DistrictCountTile />
   </Suspense>
   <StatTile label="Yüzölçümü (HGM)" fact="783.562 km²" tone="primary" />
   ```
   Replace the `<JsonLd …/>` block and the `<V2TurkeyMapExplorer …/>` with:
   ```tsx
   <Suspense fallback={<PlateSkeleton aspect="map" />}>
     <TurkiyeExplorer locale={locale} />
   </Suspense>
   ```
   placed where the explorer was (the JSON-LD `<script>` position in the DOM does not matter).

- [ ] **Step 3: Restructure `/dunya`**

Same shape in `app/[locale]/(site)/dunya/page.tsx`:

1. Imports: `Suspense`, `PlateSkeleton`, `StatTileSkeleton`.
2. `async function loadDunyaHub(locale: Locale)` holding lines 75–128 (the `Promise.all`, `summaryMap`, `countries`, `totalCountries`, `continentCounts`), returning `{ countries, totalCountries, continentCounts }`.
3. Sections:
   ```tsx
   async function CountryCountTile() {
     const { totalCountries } = await loadDunyaHub("tr");
     return (
       <StatTile
         label="Ülke ve bölge"
         value={totalCountries}
         unit="Ülke"
         tone="primary"
         absent={{ label: "Ülke listesi yok", hint: "Liste şu an yüklenemedi" }}
       />
     );
   }

   async function DunyaExplorer({ locale }: { locale: Locale }) {
     const t = await getTranslations({ locale, namespace: "Dunya" });
     const { countries, totalCountries, continentCounts } = await loadDunyaHub(locale);
     return (
       <>
         <JsonLd schema={[/* collectionPageJsonLd + itemListJsonLd, moved verbatim */]} />
         <V2WorldMapExplorer
           countries={countries}
           locale={locale}
           middleSections={
             <div key="v2-world-middle-sections" className="space-y-12 my-6">
               <V2WorldContinents countryCounts={continentCounts} />
               <V2WorldStatsSpotlight />
             </div>
           }
         />
       </>
     );
   }
   ```
4. In the default export: first tile → `<Suspense fallback={<StatTileSkeleton />}><CountryCountTile /></Suspense>`; JSON-LD + explorer → `<Suspense fallback={<PlateSkeleton aspect="map" />}><DunyaExplorer locale={locale} /></Suspense>`. (`getTranslations` is memoized by next-intl per request; calling it again inside a section costs nothing and keeps the section's props serializable primitives.)

- [ ] **Step 4: Run the scanners and the whole suite**

Run: `pnpm typecheck && pnpm vitest run components/v2/page-composition-headings.test.ts components/v2/page-composition-containers.test.ts components/v2/page-composition-cards.test.ts lib/seo/sitemap-surface-symmetry.test.ts components/orphan.test.ts`
Expected: PASS with the pinned counters unchanged. If `PAGES_WITHOUT_H1` moves, the render walk did not follow the in-file declaration; the fix is to keep `<PageHero>` in the default export (it already is) — do not add an exemption.

Then `pnpm test` — expected PASS.

- [ ] **Step 5: See it in the browser**

With `cografya-web-dev` serving `:3000`: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/turkiye` → 200. In Playwright MCP, navigate to `/`, then click the header link to `/turkiye`; run `docker pause cografya-api-dev` first and take a screenshot within ~3 s to catch the skeleton; `docker unpause cografya-api-dev`. Save to `t037_shots/turkiye-loading-1440-light.png`. Confirm the hero card, stat strip and plate top edges in the skeleton and in the loaded page differ by ≤ 8 px (read `getBoundingClientRect().top` of `[data-slot="card"]`/`.aspect-\[1270\/580\]` via `browser_evaluate`).

- [ ] **Step 6: Commit**

```bash
pnpm lint
git add app/\[locale\]/\(site\)/turkiye app/\[locale\]/\(site\)/dunya
git commit -m "feat(hubs): stream /turkiye and /dunya tiles and explorers behind suspense with loading.tsx (t-037)"
```

---

### Task 4: `/deprem`, `/deniz`, `/kitaplar` — ISR hubs

**Files:**

- Modify: `app/[locale]/(site)/deprem/page.tsx` (fetch 60–84, explorer 140–146, attribution 302–307)
- Modify: `app/[locale]/(site)/deniz/page.tsx` (fetch 92–172, lede 217–236, explorer 257, catalogue 294)
- Modify: `app/[locale]/(site)/kitaplar/page.tsx` (`loadBooks` 38–47, tile 152–158, hub 166, JSON-LD 84–98)

No `loading.tsx`: all three are `revalidate` routes whose bodies now return synchronously.

- [ ] **Step 1: `/deprem`**

Imports: `Suspense`, `PlateSkeleton`, `ProseSkeleton`. Add above the default export:

```tsx
async function loadDeprem(locale: Locale) {
  let initialEvents: EarthquakeEvent[] = [];
  const provinceMap = new Map<string, ProvinceMeta>();
  let earthquakeMeta: EarthquakeMeta | null = null;
  try {
    const [list, rawProvinces, meta] = await Promise.all([
      getEarthquakeListResilient(),
      getProvincesResilient(),
      getEarthquakeMetaSafe(),
    ]);
    initialEvents = list?.items || [];
    earthquakeMeta = meta;
    for (const p of rawProvinces) {
      provinceMap.set(p.plateCode, { name: p.nameTr, slug: locale === "en" ? p.slugEn : p.slugTr });
    }
  } catch (err) {
    console.warn("[v2/deprem] Live fetch degraded gracefully:", err);
  }
  return { initialEvents, provinceMap, earthquakeMeta };
}

async function DepremExplorer({ locale }: { locale: Locale }) {
  const { initialEvents, provinceMap } = await loadDeprem(locale);
  return (
    <V2EarthquakeExplorer
      initialEvents={initialEvents}
      provinceMap={provinceMap}
      defaultMinMagnitude={2.5}
      defaultWindowDays={7}
    />
  );
}

async function DepremAttribution() {
  const earthquakeMeta = await getEarthquakeMetaSafe();
  if (earthquakeMeta === null) return null;
  return (
    <EarthquakeAttribution
      attributions={earthquakeMeta.attributions}
      disclaimerTr={earthquakeMeta.disclaimerTr}
    />
  );
}
```

`getEarthquakeListResilient` is not cache-wrapped (single reader) and `getEarthquakeMetaSafe` is, so `DepremAttribution` reads the same meta entry `loadDeprem` filled. Move the existing docblocks with the code. In the default export delete the fetch block, render `<Suspense fallback={<PlateSkeleton aspect="map" />}><DepremExplorer locale={locale} /></Suspense>` where the explorer was and `<Suspense fallback={<ProseSkeleton lines={2} heading={false} />}><DepremAttribution /></Suspense>` where the attribution was (keep the SECTION 4 comment above it).

- [ ] **Step 2: `/deniz`**

Imports: `Suspense`, `InlineSkeleton`, `PlateSkeleton`, `ProseSkeleton`. Extract lines 92–172 into:

```tsx
async function loadDeniz(locale: Locale, format: Awaited<ReturnType<typeof getFormatter>>) {
  const [rawPoints, rawOverview, rawLayers, rawProvinces] = await Promise.all([
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
    getMarineLayersSafe(),
    getProvincesResilient(),
  ]);
  const showValues = marineShowsValues(rawOverview);
  // … provinceByPlate, overviewMap, marinePoints exactly as today …
  return { showValues, marinePoints, rawLayers };
}
```

Sections:

```tsx
async function DenizLede() {
  const showValues = marineShowsValues(await getMarineOverviewSafe());
  return showValues ? (
    <>
      Karadeniz, Marmara, Ege ve Akdeniz&apos;in açığında 30 nokta seçtik. Her birinde su
      sıcaklığını, dalga yüksekliğini ve rüzgârı gör; aşağıda dört denizin tuzluluğunu, derinliğini
      ve akıntılarını karşılaştır.
    </>
  ) : (
    <>
      Karadeniz, Marmara, Ege ve Akdeniz&apos;in açığında 30 nokta seçtik; her biri bir kıyı ilinin
      önünde. Bu noktaların güncel su sıcaklığı, dalga ve rüzgâr değerleri şu an gösterilmiyor. Dört
      denizin tuzluluğunu, derinliğini ve akıntılarını yine de aşağıda karşılaştırabilirsin.
    </>
  );
}

async function DenizExplorer({
  locale,
  format,
}: {
  locale: Locale;
  format: Awaited<ReturnType<typeof getFormatter>>;
}) {
  const { marinePoints } = await loadDeniz(locale, format);
  return <V2MarineMapExplorer marinePoints={marinePoints} locale={locale} />;
}

async function DenizLayerCatalogue() {
  const layers = await getMarineLayersSafe();
  return <V2MarineLayerCatalogue layers={layers} />;
}
```

Copy the two lede texts byte-identically from lines 219–234 (the `&apos;` entities included). In the default export: `lede={<Suspense fallback={<InlineSkeleton width="lg" />}><DenizLede /></Suspense>}` — `PageHero` wraps `lede` in its own `<p>`, which is why `InlineSkeleton` is span-rooted (Task 1). Explorer → `<Suspense fallback={<PlateSkeleton aspect="map" />}><DenizExplorer locale={locale} format={format} /></Suspense>`; catalogue → `<Suspense fallback={<ProseSkeleton lines={4} />}><DenizLayerCatalogue /></Suspense>`.

- [ ] **Step 3: `/kitaplar`**

Imports: `Suspense`, `StatTileSkeleton`, `CardGridSkeleton`. `loadBooks` already exists (line 38); `getBooksResilient` is now cached, so calling `loadBooks` from two sections fetches once. Sections:

```tsx
async function BooksCountTile() {
  const { books } = await loadBooks("tr");
  return (
    <StatTile
      label="Çözümü yayında"
      value={books.length}
      unit="kitap"
      tone="primary"
      absent={{ label: "Liste okunamadı", hint: "Kitap listesi gelmedi" }}
    />
  );
}

async function BooksCatalogue({ locale }: { locale: Locale }) {
  const { books, items } = await loadBooks(locale);
  return (
    <>
      <JsonLd schema={[itemListJsonLd({ name: "Video Çözümlü Kitaplar", items })]} />
      <V2BooksHub books={books} locale={locale} />
    </>
  );
}
```

The `collectionPageJsonLd` stays in the page's own `<JsonLd>` (it uses no data); the `itemListJsonLd` moves into `BooksCatalogue`. Tile → `<Suspense fallback={<StatTileSkeleton />}><BooksCountTile /></Suspense>`; hub → `<Suspense fallback={<CardGridSkeleton columns="2" count={4} />}><BooksCatalogue locale={locale} /></Suspense>`. Keep the long tile comment (lines 144–151) above the Suspense.

- [ ] **Step 4: Test, check in the browser, commit**

Run: `pnpm typecheck && pnpm lint && pnpm test` — expected PASS; `components/v2/page-composition-faq.test.ts` names `deniz/page.tsx` as a `FaqSection` site and it still is (the FAQ did not move).

Browser: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/deprem` and `/deniz` and `/kitaplar` → 200; view source of `/deniz` and confirm one `role="status"` per fallback is gone once loaded (`grep -c 'role="status"'` on the final HTML should equal the count before the change).

```bash
git add app/\[locale\]/\(site\)/deprem/page.tsx app/\[locale\]/\(site\)/deniz/page.tsx app/\[locale\]/\(site\)/kitaplar/page.tsx components/patterns/page-skeleton.tsx components/patterns/page-skeleton.test.tsx
git commit -m "feat(hubs): stream deprem, deniz and kitaplar data sections behind suspense (t-037)"
```

---

### Task 5: `/turkiye/bolge` and `/oyun/bolge-bolge-il`

**Files:**

- Modify: `app/[locale]/(site)/turkiye/bolge/page.tsx` (fetch + derivation 250–296; tiles 389–415; regions 476; comparison 558–680; FAQ 693–700)
- Modify: `app/[locale]/(site)/oyun/bolge-bolge-il/page.tsx` (fetch 47–61; defs 68; grid 113–150)

- [ ] **Step 1: `/turkiye/bolge`**

Imports: `Suspense`, `InlineSkeleton`, `CardGridSkeleton`, `ProseSkeleton`. Extract lines 250–296 into a top-level `async function loadRegions()` returning `{ regionsList, figuresAreLive, totalPop, totalArea }` (keep the two docblocks with it; `getRegionsResilient` is cached so four sections share one fetch).

Four sections, in-file:

```tsx
async function RegionTotalsTiles({ locale }: { locale: Locale }) {
  const { figuresAreLive, totalPop, totalArea } = await loadRegions();
  return (
    <>
      {/* the two `<div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">` tiles from lines 389–415, moved verbatim */}
    </>
  );
}

async function RegionsGrid() {
  const { regionsList } = await loadRegions();
  return <V2TurkeyRegions regions={regionsList} />;
}

async function RegionsComparison() {
  const { regionsList, figuresAreLive, totalPop, totalArea } = await loadRegions();
  return (
    /* the CONTENT of `<section id="kiyaslama">` — everything inside it, moved verbatim; the
       `<section id="kiyaslama" className="scroll-mt-28" tabIndex={-1}>` wrapper stays in the page */
  );
}

async function RegionsFaq({ locale }: { locale: Locale }) {
  const { regionsList } = await loadRegions();
  return (
    <FaqSection
      heading="Coğrafi Bölgeler Hakkında Sıkça Sorulan Sorular"
      lede="Bölgelerin nasıl çizildiği, en büyüğü ve denize kıyısı olanlar."
      locale={locale}
      items={buildBolgelerFaqs(regionsList)}
      structuredData="trOnly"
    />
  );
}
```

Page: the two hand-drawn tiles → `<Suspense fallback={<><StatTileSkeleton /><StatTileSkeleton /></>}><RegionTotalsTiles locale={locale} /></Suspense>` (the parent grid keeps its column count: two fallbacks for two tiles). `#bolgeler` content → `<Suspense fallback={<CardGridSkeleton columns="2-4" count={7} />}><RegionsGrid /></Suspense>`. `#kiyaslama` content → `<Suspense fallback={<ProseSkeleton lines={6} />}><RegionsComparison /></Suspense>`. FAQ → `{locale === "tr" && (<Suspense fallback={<ProseSkeleton lines={4} />}><RegionsFaq locale={locale} /></Suspense>)}`.

The `<FaqSection>` element is still written in `turkiye/bolge/page.tsx`, so `SURFACE_FILES_RENDERING_FAQSECTION` and the exact-path list in `page-composition-faq.test.ts` (line 865) still hold. The `locale === "tr" &&` gate stays on the JSX (that suite asserts the gate and the `structuredData="trOnly"` pairing).

- [ ] **Step 2: `/oyun/bolge-bolge-il`**

Imports: `Suspense`, `CardGridSkeleton`. Section:

```tsx
async function RegionPickerGrid({
  locale,
  regionLabels,
}: {
  locale: Locale;
  regionLabels: Awaited<ReturnType<typeof getRegionLabels>>;
}) {
  const summaries = await getMapSummaryResilient();
  const allShapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  const regionCards = REGION_KEYS.map((regionKey) => {
    /* as today */
  });
  const hasThumbs = allShapes.length > 0;
  return (
    <>
      {hasThumbs ? <V2RegionThumbDefs shapes={allShapes} /> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* the regionCards.map(...) block, verbatim */}
      </div>
    </>
  );
}
```

`V2RegionThumbDefs` moves inside the boundary because the thumbs reference its `<defs>`; rendering it before `PageContainer` and the thumbs later would leave `<use>` elements pointing at ids that arrive in a later chunk — in the same boundary they arrive together. Page: replace the defs line and the grid with `<Suspense fallback={<CardGridSkeleton columns="2-4" count={7} />}><RegionPickerGrid locale={locale} regionLabels={regionLabels} /></Suspense>`; `regionLabels` stays awaited in the page (translations only).

- [ ] **Step 3: Test and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test` — expected PASS. `HAND_DRAWN_CARDS` is unchanged because the two tiles and the seven cards moved within the same file.

```bash
git add app/\[locale\]/\(site\)/turkiye/bolge/page.tsx app/\[locale\]/\(site\)/oyun/bolge-bolge-il/page.tsx
git commit -m "feat(hubs): stream region figures, comparison, faq and region-game grid (t-037)"
```

---

### Task 6: Home page

**Files:**

- Modify: `app/[locale]/(site)/page.tsx` (fetch 87–121; cards 137–155; hero 165–176; sections at 177, 246, 375)
- Modify: `components/v2/v2-hero.tsx` (props 11–24; stat trio 310–331)

- [ ] **Step 1: Give `V2Hero` a `stats` slot**

In `components/v2/v2-hero.tsx`, replace the props `provinceCount`, `countryCount`, `provinceStatLabel`, `countryStatLabel`, `modeCount`, `modeStatLabel` with one prop:

```tsx
/** The stat trio under the lede, rendered by the server (it waits on two fetches). */
stats: React.ReactNode;
```

Replace the `<div className="flex items-center justify-center gap-3 …">…</div>` block (lines 310–331) with `{stats}`. Delete `totalCountries`/`totalProvinces` (lines 119–120) and their `|| 199` / `|| 81` fallbacks — they move to the server and the "no invented count" rule (`lib/geo/country-sources.test.ts` reasoning) is then met on the home page too. Run `pnpm vitest run lib/home components/v2/v2-hero` and fix any test that asserted the old prop names by updating it to render `stats`.

- [ ] **Step 2: Restructure the page**

Imports: `Suspense`, `InlineSkeleton`, `CardGridSkeleton`, `ProseSkeleton`. Sections (all top-level in `page.tsx`):

```tsx
async function HeroStats({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const [provinces, countries] = await Promise.all([
    getMapSummaryResilient(),
    getCountryMapSummaryResilient(),
  ]);
  const totalProvinces = provinces.length;
  const totalCountries = countries.length;
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground font-medium flex-wrap">
      <span>
        <strong className="font-heading text-foreground">{totalProvinces}</strong>{" "}
        {t("statProvincesLabel", { count: totalProvinces })}
      </span>
      <span aria-hidden="true" className="text-border">
        &bull;
      </span>
      <span>
        <strong className="font-heading text-foreground">{totalCountries}</strong>{" "}
        {t("statCountriesLabel", { count: totalCountries })}
      </span>
      <span aria-hidden="true" className="text-border">
        &bull;
      </span>
      <span>
        <strong className="font-heading text-foreground">{V2_GAME_MODE_COUNT}</strong>{" "}
        {t("statGameModesLabel", { count: V2_GAME_MODE_COUNT })}
      </span>
    </div>
  );
}
```

(`V2_GAME_MODE_COUNT` becomes a module-scope constant above the sections, with its docblock; `lib/home/game-modes.test.ts` reads the literal out of this file and still finds it.) The three label keys and their `{ count }` argument are exactly what the page passes today at lines 170–173.

```tsx
async function AtlasCounts({ locale }: { locale: Locale }) {
  // Section 1's two data lines: "N il · <population>" and "N ülke".
  const [provinces, countries] = await Promise.all([getMapSummaryResilient(), getCountryMapSummaryResilient()]);
  const population = nationalPopulation(provinces);
  return /* the two mono lines from Section 1 that read totalProvinces / population / totalCountries, verbatim */;
}

async function MarineToday({ locale }: { locale: Locale }) {
  const [marinePoints, marineOverview] = await Promise.all([getMarinePointsSafe(), getMarineOverviewSafe()]);
  const marine = buildMarineHomeSummary(marineOverview, locale);
  const scope = marineScope(marinePoints);
  const showMarineValues = marineSummaryShowsValues(marine);
  return /* the body of Section 4 (line 246 `<section>`): basin cards, VintageLine, MarineDataNotice gate, fallback Alert — verbatim */;
}

async function FeaturedPlaces({ locale, tDetail, tRegions, tContinents, format }: …) {
  const [provinces, countries] = await Promise.all([getMapSummaryResilient(), getCountryMapSummaryResilient()]);
  const now = new Date();
  const provinceCards = pickDailyProvinces(provinces, locale, now).map(/* as today */);
  const countryCards = pickDailyCountries(countries, locale, now).map(/* as today */);
  return /* the body of Section 5 (line 375 `<section>`), verbatim */;
}
```

Section 1's heading, the "7 coğrafi bölge"/`totalContinents` line and the card chrome stay in the page; only the two data lines go into `AtlasCounts` with `<Suspense fallback={<InlineSkeleton width="md" />}>`. Section 4 keeps its heading row and "Tüm Denizler" link in the page; its body → `<Suspense fallback={<CardGridSkeleton columns="2-4" count={4} />}><MarineToday locale={locale} /></Suspense>`. Section 5 keeps its `<section className="space-y-8">` in the page; its body → `<Suspense fallback={<CardGridSkeleton columns="3" count={6} />}><FeaturedPlaces … /></Suspense>`. Hero: `<V2Hero title={t("heading")} lede={t("lede")} stats={<Suspense fallback={<InlineSkeleton width="lg" />}><HeroStats locale={locale} /></Suspense>} />`.

Passing a Server Component element as a prop to a Client Component is the supported RSC composition; `V2Hero` just renders `{stats}`.

- [ ] **Step 3: Test, view, commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`. Load `/` in the browser: hero renders with the trio; `docker pause` shows three `InlineSkeleton`/grid fallbacks and the hero text is present immediately.

```bash
git add app/\[locale\]/\(site\)/page.tsx components/v2/v2-hero.tsx
git commit -m "feat(home): hero stats and three data sections stream behind suspense (t-037)"
```

---

### Task 7: `/turkiye/[slug]` — province detail

**Files:**

- Modify: `app/[locale]/(site)/turkiye/[slug]/page.tsx` (body 212–300; gates 340–360; locator card 707–772; air/marine row 846–887; earthquake 890–903; foot 932–944)
- Create: `app/[locale]/(site)/turkiye/[slug]/loading.tsx`
- Modify: `lib/climate/climate-block-gates.test.ts` (add one case)

- [ ] **Step 1: `loading.tsx`**

```tsx
import { PageSkeleton } from "@/components/patterns/page-skeleton";

/**
 * The province page must resolve `getProvinceBySlug` before its first return — an unknown slug
 * has to be a real 404, and a `notFound()` thrown after the shell streamed cannot change the
 * status. While that lookup runs, the reader sees this. Same pieces as the page's own fallbacks.
 */
export default function Loading() {
  return <PageSkeleton shape="detail" />;
}
```

- [ ] **Step 2: Pin the gate behaviour**

Add to `lib/climate/climate-block-gates.test.ts`:

```ts
it("showSection is unaffected by hasSimilarClimate whenever a class or a series exists", () => {
  const base = {
    isTr: true,
    hasCurriculumName: false,
    hasClimateNote: false,
    hasCurriculumNoteText: false,
  };
  expect(
    climateBlockGates({
      ...base,
      hasClimateClass: true,
      hasClimateSeries: false,
      hasSimilarClimate: false,
    }).showSection,
  ).toBe(true);
  expect(
    climateBlockGates({
      ...base,
      hasClimateClass: false,
      hasClimateSeries: true,
      hasSimilarClimate: false,
    }).showSection,
  ).toBe(true);
  // The one case the province page's chips component must recompute for itself:
  expect(
    climateBlockGates({
      ...base,
      hasClimateClass: false,
      hasClimateSeries: false,
      hasSimilarClimate: true,
    }).showSection,
  ).toBe(true);
  expect(
    climateBlockGates({
      ...base,
      hasClimateClass: false,
      hasClimateSeries: false,
      hasSimilarClimate: false,
    }).showSection,
  ).toBe(false);
});
```

Run it: PASS (it documents current behaviour).

- [ ] **Step 3: Restructure the page**

Imports: `Suspense`, `ProseSkeleton`, `InlineSkeleton`. Keep `getProvinceBySlug` + `notFound()` + translations at the top. Delete lines 221–223 (the three eager promises), 251–261 (`neighbors`/`similarClimate`), 263–276 (marine), 278–279 (earthquake awaits). In `climateBlockGates` (line ~352) pass `hasSimilarClimate: false` and add the comment: `// Similar-climate chips resolve inside their own boundary and recompute this gate; here it only matters when neither a class nor a series exists, and then the section that would show is the chips themselves.`

Cached per-request loaders for this page, top-level in the file:

```tsx
const loadProvinceLinks = cache(async (province: ProvinceDetail, slug: string) => {
  try {
    const all = await getProvinces();
    const byCode = byPlateCode(all);
    const neighbors = province.neighborPlateCodes
      .map((code) => byCode.get(code))
      .filter((p): p is ProvinceListItem => p !== undefined);
    const ownAnnualMeanTempC = province.climate?.derived.annualMeanTempC ?? null;
    return {
      neighbors,
      similarClimate: selectSimilarClimateProvinces(all, province, ownAnnualMeanTempC),
    };
  } catch (error) {
    console.warn(`[province:${slug}] cross-links skipped: ${String(error)}`);
    return { neighbors: [] as ProvinceListItem[], similarClimate: [] as ProvinceListItem[] };
  }
});

const loadProvinceMarine = cache(async (plateCode: string) => {
  const marinePoints = await getMarinePointsSafe();
  const [marineLayers, marineConditions] = hasMarinePoint(marinePoints, plateCode)
    ? await Promise.all([getMarineLayersSafe(), getMarineProvinceConditionsSafe(plateCode)])
    : [[], null];
  return {
    marineLayers,
    marineBlocks: provinceMarineBlocks(marineConditions),
    showMarine: provinceShowsMarine(marineConditions),
  };
});

const loadProvinceEarthquakes = cache(async (plateCode: string) => {
  const [provinceEarthquakes, earthquakeMeta] = await Promise.all([
    getProvinceEarthquakesSafe(plateCode),
    getEarthquakeMetaSafe(),
  ]);
  return { provinceEarthquakes, earthquakeMeta };
});
```

(`import { cache } from "react"` — `cache` keys on argument identity; `plateCode` is a string, and `province` is the same object for both calls in one render. Pass `province.plateCode` rather than `province` where a primitive suffices.)

Sections:

```tsx
async function ProvinceLinkChips({ province, slug, locale, isTr, format }: {…}) {
  const { neighbors, similarClimate } = await loadProvinceLinks(province, slug);
  const showSimilar =
    isTr &&
    (province.climateClassTr !== null && province.climateKoppen !== null ||
      province.climate !== null ||
      similarClimate.length > 0);
  return (
    <>
      {neighbors.length > 0 && ( /* the Komşu İller block, lines 707–729, verbatim */ )}
      {showSimilar && similarClimate.length > 0 && ( /* the İklimi Benzeyen block, lines 732–772, verbatim */ )}
    </>
  );
}
```

Check what `climateSeries` is derived from (search `const climateSeries =` near line 330) and use the same expression for the `province.climate !== null` term so `showSimilar` equals the old `climate.showSection` exactly.

```tsx
async function ProvinceEnvironmentRow({ province, name, locale, pm25Annual, sectionHeading }: {…}) {
  const { marineLayers, marineBlocks, showMarine } = await loadProvinceMarine(province.plateCode);
  return /* the whole `{pm25Annual && showMarine ? (…) : pm25Annual ? (…) : showMarine ? (…) : null}` expression, lines 846–887, verbatim */;
}

async function ProvinceMarineNotice({ plateCode }: { plateCode: string }) {
  const { showMarine } = await loadProvinceMarine(plateCode);
  return showMarine ? <MarineDataNotice /> : null;
}

async function ProvinceEarthquakeCard({ province, name, locale }: {…}) {
  const { provinceEarthquakes, earthquakeMeta } = await loadProvinceEarthquakes(province.plateCode);
  if (provinceEarthquakes === null || earthquakeMeta === null) return null;
  return (
    <Card as="section" variant="panel" space="4">
      <ProvinceEarthquakeSection locale={locale} provinceName={name} plateCode={province.plateCode} list={provinceEarthquakes} headingId="province-earthquake" />
    </Card>
  );
}

async function ProvinceEarthquakeCredit({ plateCode, heading }: { plateCode: string; heading: string }) {
  const { provinceEarthquakes, earthquakeMeta } = await loadProvinceEarthquakes(plateCode);
  if (provinceEarthquakes === null || earthquakeMeta === null) return null;
  return (
    <EarthquakeAttribution attributions={provinceEarthquakes.meta.attributions} disclaimerTr={earthquakeMeta.disclaimerTr} heading={heading} />
  );
}
```

Page render sites:

- After the "Bağlı Olduğu Coğrafi Bölge" row inside the locator card: `<Suspense fallback={<ProseSkeleton lines={2} heading={false} />}><ProvinceLinkChips … /></Suspense>`.
- Air/marine row: `<Suspense fallback={<ProseSkeleton lines={6} />}><ProvinceEnvironmentRow … /></Suspense>`. The `AirPollutionSection` needs no fetch but its row layout depends on `showMarine`, so it rides inside the boundary; its fallback is the prose skeleton at panel size.
- Earthquake: `<Suspense fallback={<ProseSkeleton lines={4} />}><ProvinceEarthquakeCard … /></Suspense>`.
- Foot: `<Suspense fallback={null}><ProvinceMarineNotice plateCode={province.plateCode} /></Suspense>` and `<Suspense fallback={<ProseSkeleton lines={2} heading={false} />}><ProvinceEarthquakeCredit plateCode={province.plateCode} heading={t("earthquakeSourcesHeading")} /></Suspense>`. (`fallback={null}` for the notice: it is a one-paragraph disclaimer whose presence is data-gated; a placeholder for something that may not come is the invented-content shape the page already refuses elsewhere.)

Keep every moved docblock with its JSX.

- [ ] **Step 4: Test, view, commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`. `components/marine/marine-attribution-coverage.test.ts` and `components/attribution-not-optional.test.ts` read this file for `MarineDataNotice`/`EarthquakeAttribution` render sites — they still find the elements (comments stripped) in the same file. Browser: `/turkiye/ankara` (inland: no marine row), `/turkiye/izmir` (marine row), `/turkiye/yok-boyle-il` → 404 status via `curl -s -o /dev/null -w '%{http_code}'`.

```bash
git add app/\[locale\]/\(site\)/turkiye/\[slug\] lib/climate/climate-block-gates.test.ts
git commit -m "feat(province): stream cross-links, marine and earthquake sections; detail loading.tsx (t-037)"
```

---

### Task 8: The other four detail routes

**Files:**

- Create: `app/[locale]/(site)/turkiye/bolge/[slug]/loading.tsx`, `app/[locale]/(site)/kitaplar/[slug]/loading.tsx`, `app/[locale]/(site)/dunya/[slug]/loading.tsx`
- Modify: `app/[locale]/(site)/dunya/[slug]/page.tsx` (neighbours 164–187, flag 276–278, nav pill 553–560, section 1004–1126)
- Modify: `app/[locale]/(site)/dunya/kita/[slug]/page.tsx` (fetch 102–108, locator 277–281, directory 412–440, stale comment 585–587)

- [ ] **Step 1: Three `loading.tsx` files**

Each is the Task 7 file with `shape="detail"`; adjust the docblock's first sentence to name the loader (`getRegionBySlug`, `getBookBySlug`, `getCountryBySlug`). `dunya/kita/[slug]` gets NONE: its `notFound()` comes from the static continent registry, synchronously, and after Step 3 its body awaits no loader before returning — so by the rule in Task 14 it is not owed one, and a full-page skeleton on a static route is a flash.

`turkiye/bolge/[slug]` and `kitaplar/[slug]` get no Suspense: their single fetch feeds the hero, so nothing is left to stream.

- [ ] **Step 2: `/dunya/[slug]` neighbours**

Imports: `Suspense`, `ProseSkeleton`, `cache`. Top-level:

```tsx
const loadNeighbours = cache(async (country: CountryDetail, locale: Locale, slug: string, t: …) => {
  const neighbors: Neighbor[] = [];
  try {
    const allCountries = await getCountries();
    // … lines 166–183 verbatim …
  } catch (error) {
    console.warn(`[v2:country:${slug}] neighbour resolution skipped: ${String(error)}`);
  }
  const showsNeighbourSection =
    !(isSpecialGeography(country) && country.neighborCount === 0) &&
    !(country.neighborCount > 0 && neighbors.length === 0);
  return { neighbors, showsNeighbourSection };
});
```

Check how `isSpecialGeography` is computed at line ~270 and pass/compute it identically. Sections:

```tsx
async function NeighboursNavPill(props) {
  const { showsNeighbourSection } = await loadNeighbours(…);
  return showsNeighbourSection ? ( /* the `<a href="#komsular">` pill, verbatim */ ) : null;
}
async function NeighboursSection(props) {
  const { neighbors, showsNeighbourSection } = await loadNeighbours(…);
  return showsNeighbourSection ? ( /* `<section id="komsular">…</section>`, lines 1004–1126, verbatim */ ) : null;
}
```

Render: pill → `<Suspense fallback={null}><NeighboursNavPill … /></Suspense>` (a pill for a section that may not exist has no honest placeholder); section → `<Suspense fallback={<ProseSkeleton lines={4} />}><NeighboursSection … /></Suspense>`. `neighborLabel` (line 160) is a closure over `country`, `locale`, `t` — move it inside `loadNeighbours` or pass it in.

- [ ] **Step 3: `/dunya/kita/[slug]`**

Imports: `Suspense`, `PlateSkeleton`, `ProseSkeleton`. Sections:

```tsx
async function ContinentLocator({ continent, locale }: {…}) {
  const all = await getCountryMapSummaryResilient();
  const continentCountries = all.filter((c) => c.continent === continent.id);
  return <V2ContinentLocatorMap /* the existing props, lines 277–281 */ countries={continentCountries} />;
}
async function ContinentDirectory({ continent, locale }: {…}) {
  const all = await getCountryMapSummaryResilient();
  const sortedCountries = [...all.filter((c) => c.continent === continent.id)].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return sortedCountries.length > 0 ? ( /* lines 412–440 verbatim */ ) : null;
}
```

Render: locator → `<Suspense fallback={<PlateSkeleton aspect="continent" />}>`; directory → `<Suspense fallback={<ProseSkeleton lines={6} />}>`. Delete lines 102–108 from the body. Fix the comment at 585–587: replace "this page reads no api and the one map it draws" with "this page reads the country map summary for its locator and directory, both behind Suspense, and the one map it draws".

- [ ] **Step 4: Test, view, commit**

`pnpm typecheck && pnpm lint && pnpm test`. Browser: `/dunya/almanya` (neighbours), `/dunya/kita/avrupa`, `/kitaplar/yok` → 404.

```bash
git add app/\[locale\]/\(site\)/dunya app/\[locale\]/\(site\)/turkiye/bolge/\[slug\]/loading.tsx app/\[locale\]/\(site\)/kitaplar/\[slug\]/loading.tsx
git commit -m "feat(details): detail loading.tsx on four routes; stream neighbours and continent data (t-037)"
```

---

### Task 9: The four sea basins

**Files:**

- Create: `components/v2/v2-basin-telemetry.tsx` (client; the table)
- Modify: `components/v2/v2-sea-basin-detail-view.tsx` (props 38–43; `sortedPoints` 81; section 167–253)
- Modify: `app/[locale]/(site)/deniz/{akdeniz,ege,karadeniz,marmara}/page.tsx` (fetch 55–130; view call ~172)

- [ ] **Step 1: Extract the telemetry table**

Create `components/v2/v2-basin-telemetry.tsx`:

```tsx
"use client";

import { Link } from "@/i18n/navigation";
import type { MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { tr } from "@/lib/text/format-number";

type LinkHref = React.ComponentProps<typeof Link>["href"];

interface V2BasinTelemetryProps {
  readonly basinNameTr: string;
  readonly marinePoints: readonly MarinePointData[];
}

/**
 * The per-point value table of a basin page — the ONE part of `V2SeaBasinDetailView` that waits
 * on the API. It left the view so the page can stream it behind a Suspense boundary while the
 * hero, the prose and the FAQ render at once. Markup byte-identical to the section it replaces.
 */
export function V2BasinTelemetry({ basinNameTr, marinePoints }: V2BasinTelemetryProps) {
  const sortedPoints = [...marinePoints].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <section aria-labelledby="basin-telemetry-heading" className="space-y-4">
      {/* lines 168–252 of v2-sea-basin-detail-view.tsx, verbatim, with `data.nameTr` → `basinNameTr` */}
    </section>
  );
}
```

Copy the `LinkHref` type alias from the view (search `type LinkHref`) if it is declared there. In the view: replace `marinePoints: MarinePointData[]` with `telemetry: React.ReactNode`, delete `sortedPoints`, and render `{telemetry}` where the section was. Update `components/v2/v2-sea-basin-detail-view.*.test.ts(x)` if one asserts the table inside the view (search `basin-telemetry-heading` under `components/`): point that assertion at `v2-basin-telemetry.tsx`.

- [ ] **Step 2: Restructure the four pages**

In each basin page, imports: `Suspense`, `ProseSkeleton`, `V2BasinTelemetry`. Move lines 55–130 (the `Promise.all` and the `marinePoints` mapping) into a top-level `async function loadBasinPoints(locale: Locale, format: …)` returning `marinePoints`; the `seaBasin` filter string and `isStraits` stay exactly as in each file. Section:

```tsx
async function BasinTelemetry({ locale, format }: {…}) {
  const marinePoints = await loadBasinPoints(locale, format);
  return <V2BasinTelemetry basinNameTr={basinData.nameTr} marinePoints={marinePoints} />;
}
```

View call: `telemetry={<Suspense fallback={<ProseSkeleton lines={6} />}><BasinTelemetry locale={locale} format={format} /></Suspense>}` in place of `marinePoints={marinePoints}`.

- [ ] **Step 3: Test and commit**

`pnpm typecheck && pnpm lint && pnpm test`. The table's `rounded-3xl border border-border bg-card` moved from one `components/v2` file to another: `HAND_DRAWN_CARDS` total is unchanged. If `page-composition-cards.test.ts` pins a per-file count that now differs, its docblock says how the pin is re-measured — update the pinned figure in the same commit and say so in the body; do not exempt the new file.

```bash
git add components/v2/v2-basin-telemetry.tsx components/v2/v2-sea-basin-detail-view.tsx app/\[locale\]/\(site\)/deniz
git commit -m "feat(deniz): basin telemetry table streams behind suspense on the four basin pages (t-037)"
```

---

### Task 10: Three tool pages

**Files:**

- Modify: `app/[locale]/(site)/araclar/{alan-hesaplama,koordinat-bulma,mesafe-olcme}/page.tsx` (fetch 48–54; workbench call)

- [ ] **Step 1: One section per page**

Imports: `Suspense`, `PlateSkeleton`. Top-level in each file:

```tsx
async function AreaWorkbench({ locale }: { locale: Locale }) {
  const provinces = await getProvincesResilient();
  const provincePoints = buildProvincePoints(provinces);
  const provinceAreas = provinces.map((p) => ({
    plateCode: p.plateCode,
    name: p.nameTr,
    slug: locale === "en" ? p.slugEn : p.slugTr,
  }));
  return (
    <V2ToolWorkbench
      initialMode="area"
      lockMode={true}
      provincePoints={provincePoints}
      provinceAreas={provinceAreas}
      downloadName="cografya-alan"
    />
  );
}
```

(`CoordinatesWorkbench` / `DistanceWorkbench` with each page's own `initialMode`, `downloadName` and any other prop the existing call passes — copy the call verbatim.) Page: delete the fetch lines; render `<Suspense fallback={<PlateSkeleton aspect="map" />}><AreaWorkbench locale={locale} /></Suspense>` where the workbench was.

- [ ] **Step 2: Test and commit**

`pnpm typecheck && pnpm lint && pnpm test` — `components/v2/v2-tool-workbench.structure.test.ts` reads the workbench, not the pages. Browser: `/araclar/alan-hesaplama` draws.

```bash
git add app/\[locale\]/\(site\)/araclar
git commit -m "feat(tools): workbench streams behind a plate skeleton on the three tool pages (t-037)"
```

---

### Task 11: `/hesabim`, `/hesabim/ayarlar`, `/kayit`

**Files:**

- Create: `app/[locale]/(site)/hesabim/loading.tsx`, `app/[locale]/(site)/hesabim/ayarlar/loading.tsx`, `app/[locale]/(site)/kayit/loading.tsx`
- Modify: `app/[locale]/(site)/hesabim/page.tsx` (48–78, 91–98), `app/[locale]/(site)/hesabim/ayarlar/page.tsx` (51–52, 78), `app/[locale]/(site)/kayit/page.tsx` (46, 72)

- [ ] **Step 1: `loading.tsx` files**

`hesabim/loading.tsx` and `hesabim/ayarlar/loading.tsx` render `<PageSkeleton shape="account" />` (docblock: `force-dynamic`, the session/profile read decides a redirect and must finish before the first return). `kayit/loading.tsx` renders `<PageSkeleton shape="auth" />` (docblock: `force-dynamic` because the province list is a required form field).

- [ ] **Step 2: `/hesabim`**

Imports: `Suspense`, `CardGridSkeleton`. Keep `getSession` → `redirect` and `readProfileForPage` in the body. Section:

```tsx
async function MemberHub({ session, profile }: { session: Session; profile: Profile | null }) {
  const [rawProvinces, rawCountries, rawRegions, rawBooks] = await Promise.all([
    getProvincesResilient(),
    getCountriesResilient(),
    getRegionsResilient(),
    getBooksResilient(),
  ]);
  // the four `.map`s, verbatim
  return (
    <V2MemberHub
      session={session}
      profile={profile}
      provinces={provinces}
      countries={countries}
      regions={regions}
      books={books}
    />
  );
}
```

Use the types the page already imports for `session`/`profile` (search the import lines). Render `<Suspense fallback={<CardGridSkeleton columns="2" count={4} announce={false} />}><MemberHub session={session} profile={profile} /></Suspense>`. `announce={false}`: `V2MemberHub` owns a `role="status"` live region (line 316) for its own announcements, and `PageSkeleton shape="account"` in `loading.tsx` already announced once for this route; a second status region here would double the announcement on the loaded page. Wrap the fallback in `<div aria-busy="true">` so the busy state is still exposed.

- [ ] **Step 3: `/hesabim/ayarlar`**

Section:

```tsx
async function AccountSettings({ locale, profile }: { locale: Locale; profile: Profile }) {
  const rawProvinces = await getProvincesResilient();
  const provinces = rawProvinces.map((p) => ({ plateCode: p.plateCode, nameTr: p.nameTr }));
  return <V2AccountSettings locale={locale} profile={profile} provinces={provinces} />;
}
```

In the `result.kind === "unavailable" ? … : (…)` branch render `<Suspense fallback={<CardGridSkeleton columns="2" count={4} />}><AccountSettings locale={locale} profile={result.profile} /></Suspense>`. Delete lines 51–52.

- [ ] **Step 4: `/kayit`**

Section:

```tsx
async function RegisterCard({ locale }: { locale: Locale }) {
  const provinces = await getProvinces();
  return <V2RegisterCard locale={locale} provinces={provinces} />;
}
```

Render inside the left column: `<Suspense fallback={<CardGridSkeleton columns="2" count={1} />}><RegisterCard locale={locale} /></Suspense>` — one `h-40` box is too short for the form card; add `count={1}` support by making the grid render `min-h-[520px]` when `count === 1` — or simpler: render `<PlateSkeleton aspect="map" />` and accept the different proportion? No: the auth shape in Task 1 uses `h-[520px]`. Add to Task 1 an `AuthCardSkeleton` export? Keep the surface small: reuse `CardGridSkeleton` and add an optional `height?: "card" | "form"` prop (`h-40` | `h-[520px]`) with a one-line test in Task 1's file (`expect(render(<CardGridSkeleton columns="2" count={1} height="form" />)).toContain("h-[520px]")`). `getProvinces()` throws on failure and that reaches `(site)/error.tsx` as before.

- [ ] **Step 5: Test, view, commit**

`pnpm typecheck && pnpm lint && pnpm test` — `components/v2/v2-register-card.structure.test.ts` and `v2-member-hub.test.ts` read the islands, not the pages. Browser (logged out): `/hesabim` → redirects to `/giris`; `/kayit` shows the hero at once and the form after the list.

```bash
git add app/\[locale\]/\(site\)/hesabim app/\[locale\]/\(site\)/kayit components/patterns/page-skeleton.tsx components/patterns/page-skeleton.test.tsx
git commit -m "feat(account): loading.tsx on the three dynamic auth routes; islands stream behind suspense (t-037)"
```

---

### Task 12: Attribution-only readers

**Files:**

- Modify: `app/[locale]/(site)/deprem/fay-hatlari/page.tsx` (54, 384–389), `app/[locale]/(site)/deprem/hazirlik/page.tsx` (45, 234–239), `app/[locale]/(site)/hakkimizda/page.tsx` (94, 181–185)

- [ ] **Step 1: One section each**

fay-hatlari and hazirlik (same code in both files):

```tsx
async function AfadAttribution() {
  const earthquakeMeta = await getEarthquakeMetaSafe();
  if (earthquakeMeta === null) return null;
  return (
    <EarthquakeAttribution
      attributions={earthquakeMeta.attributions}
      disclaimerTr={earthquakeMeta.disclaimerTr}
    />
  );
}
```

Render `<Suspense fallback={<ProseSkeleton lines={2} heading={false} />}><AfadAttribution /></Suspense>` in place of the gated element; delete the `await` at the top (keep its comment above the new component).

hakkimizda:

```tsx
async function MarineDataCredit({ heading }: { heading: string }) {
  const marineLayers = await getMarineLayersSafe();
  return (
    <MarineAttribution layers={marineLayers} headingId="veri-kaynaklari-deniz" heading={heading} />
  );
}
```

Render `<Suspense fallback={<ProseSkeleton lines={3} />}><MarineDataCredit heading={t("marineDataHeading")} /></Suspense>`.

- [ ] **Step 2: Test and commit**

`pnpm typecheck && pnpm lint && pnpm test`. `components/attribution-not-optional.test.ts` and `components/marine/marine-attribution-coverage.test.ts` scan these files for the attribution elements — they still find them.

```bash
git add app/\[locale\]/\(site\)/deprem/fay-hatlari/page.tsx app/\[locale\]/\(site\)/deprem/hazirlik/page.tsx app/\[locale\]/\(site\)/hakkimizda/page.tsx
git commit -m "feat(credits): footer attributions stream behind suspense on three static pages (t-037)"
```

---

### Task 13: The three `(play)` screens

**Files:**

- Modify: `components/v2/v2-game-screen.tsx` (imports 31–32; lines 704–707)
- Modify: `app/[locale]/(play)/oyun/81-il/page.tsx`, `app/[locale]/(play)/oyun/bolge-bulma/page.tsx`, `app/[locale]/(play)/oyun/bolge-bolge-il/[bolge]/page.tsx`

- [ ] **Step 1: Move the chrome out of the screen**

In `v2-game-screen.tsx` delete the `V2Header` and `V2LiveTicker` imports and the two elements at 704–707 (the screen never hides them — `grep -n "V2Header" components/v2/v2-game-screen.tsx` shows the import and one render site only). Keep the `min-h-screen … pb-24` wrapper and `<main>`.

- [ ] **Step 2: Restructure the three pages**

Imports in each: `Suspense`, `PageSkeleton`, `V2Header`, `V2LiveTicker`. `81-il`:

```tsx
async function ProvinceGame({ locale, modeName, regionLabels }: {…}) {
  const summaries = await getMapSummaryResilient();
  const allShapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  const targetEntries = toTargetEntries(allShapes);
  return (
    <V2GameScreen
      mode="provinces"
      modeName={modeName}
      shapes={allShapes}
      targetEntries={targetEntries}
      regionLabels={regionLabels}
      allowEarlyFinish={true}
      provinceUrlTemplate={getPathname({ locale, href: { pathname: "/turkiye/[slug]", params: { slug: SLUG_PLACEHOLDER } } })}
      submitModeTag={buildGameRoundModeTag("provinces", null)}
      viewBox={MAP_VIEWBOX}
      currentPath="/oyun/81-il"
    />
  );
}

export default async function V2ProvinceModePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");
  const regionLabels = await getRegionLabels(locale);
  return (
    <>
      <V2Header />
      <V2LiveTicker />
      <Suspense fallback={<PageSkeleton shape="play" />}>
        <ProvinceGame locale={locale} modeName={t("mode2Name")} regionLabels={regionLabels} />
      </Suspense>
    </>
  );
}
```

`bolge-bulma`: same with `mode="regions"`, `allowEarlyFinish={false}`, `buildGameRoundModeTag("regions", null)`, `currentPath="/oyun/bolge-bulma"` and the mode name key the file uses today. `bolge-bolge-il/[bolge]`: `regionFromSlug` + `notFound()` stay in the page; the section filters `allShapes` by region and computes `viewBoxForPaths` exactly as lines 55–58 do.

The `(play)` layout's `min-h-screen bg-background text-foreground` div still wraps everything; the screen's own `min-h-screen` wrapper is unchanged, so the loaded page's DOM under `<main>` is what it was.

- [ ] **Step 3: Test, view, commit**

`pnpm typecheck && pnpm lint && pnpm test` — `components/v2/v2-game-screen.structure.test.ts` and `v2-a11y-navigation-polish.test.ts` do not assert the header inside the screen (verified by grep in planning). Browser: `/oyun/81-il` renders header, ticker and game; `docker pause` shows header + play skeleton.

```bash
git add components/v2/v2-game-screen.tsx app/\[locale\]/\(play\)
git commit -m "feat(play): game screens stream behind a play skeleton; chrome moves to the pages (t-037)"
```

---

### Task 14: Guards, scanner docblock, docs, board

**Files:**

- Modify: `lib/test-support/composition-scan.ts` (docblock 55–72; add `walkLoadingFiles` after `walkRenderRoots`)
- Create: `components/v2/page-composition-loading.test.ts`
- Modify: `docs/architecture.md` (Routing bullets; Data access bullets), `TASKS.md` (T-037 → DONE)

- [ ] **Step 1: Walker**

In `composition-scan.ts`, after `walkRenderRoots`:

```ts
/**
 * Every `loading.tsx` under `PAGE_ROOTS`. NOT a render root (`RENDER_ROOT_FILENAMES` is not
 * widened): a loading file renders a skeleton, never a heading or a breadcrumb, so folding it into
 * the heading and container counters would give them ten files that legitimately have none.
 * `components/v2/page-composition-loading.test.ts` owns this walk.
 */
export function walkLoadingFiles(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => basename(path) === "loading.tsx")
    .sort();
}
```

Replace the docblock sentence at line 72 — "there is no `(play)` equivalent and no `loading.tsx` or `template.tsx` anywhere." — with "there is no `(play)` equivalent and no `template.tsx` anywhere; the nine `loading.tsx` files (T-037) are walked by `walkLoadingFiles()` and are deliberately not render roots."

- [ ] **Step 2: Write the guard suite**

`components/v2/page-composition-loading.test.ts`:

```ts
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  label,
  repoRoot,
  sourceOf,
  surfaceFiles,
  walkLoadingFiles,
  walkPages,
} from "@/lib/test-support/composition-scan";

/**
 * T-037's three pins. `sourceOf` strips comments, so a docblock quoting `await getX(` or
 * `animate-pulse` cannot answer for the code.
 */

/** Routes whose page must block before its first return, or which are `force-dynamic`. */
const ROUTES_OWED_A_LOADING_FILE = [
  "app/[locale]/(site)/turkiye/page.tsx",
  "app/[locale]/(site)/dunya/page.tsx",
  "app/[locale]/(site)/hesabim/page.tsx",
  "app/[locale]/(site)/hesabim/ayarlar/page.tsx",
  "app/[locale]/(site)/kayit/page.tsx",
  "app/[locale]/(site)/turkiye/[slug]/page.tsx",
  "app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx",
  "app/[locale]/(site)/dunya/[slug]/page.tsx",
  "app/[locale]/(site)/kitaplar/[slug]/page.tsx",
] as const;

/** An import from one of these modules is a loader; awaiting it before `return (` blocks the page. */
const LOADER_MODULES =
  /from "@\/lib\/(api\/(provinces|countries|regions|books|marine|earthquakes)|auth\/session|profile\/profile\.server)"/;

function defaultExportBody(source: string): string {
  const start = source.indexOf("export default async function");
  if (start === -1) return "";
  const ret = source.indexOf("return (", start);
  return ret === -1 ? source.slice(start) : source.slice(start, ret);
}

function loaderNames(source: string): string[] {
  const names: string[] = [];
  for (const m of source.matchAll(/import \{([^}]+)\} from "@\/lib\/[^"]+"/g)) {
    if (!LOADER_MODULES.test(m[0])) continue;
    for (const raw of m[1]!.split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop()!
        .trim();
      if (name && !/^[A-Z]/.test(name)) names.push(name);
    }
  }
  return names;
}

function isOwedALoadingFile(page: string): boolean {
  const source = sourceOf(page);
  if (/export const dynamic = "force-dynamic"/.test(source)) return true;
  const body = defaultExportBody(source);
  return loaderNames(source).some((name) => new RegExp(`await ${name}\\(`).test(body));
}

describe("loading.tsx coverage", () => {
  it("every route that blocks before its first return, or is force-dynamic, has a loading.tsx", () => {
    const missing = walkPages()
      .filter(isOwedALoadingFile)
      .filter((page) => !existsSync(join(dirname(page), "loading.tsx")))
      .map(label);
    expect(missing).toEqual([]);
  });

  it("the owed population is exactly the nine routes the spec names", () => {
    const owed = walkPages().filter(isOwedALoadingFile).map(label).sort();
    expect(owed).toEqual([...ROUTES_OWED_A_LOADING_FILE].sort());
  });

  it("no other route carries a loading.tsx — a full-page skeleton on a static route is a flash, not a state", () => {
    const extra = walkLoadingFiles()
      .map((file) => join(dirname(file), "page.tsx"))
      .filter((page) => !isOwedALoadingFile(page))
      .map(label);
    expect(extra).toEqual([]);
  });

  it("the predicate sees a real blocking await — anti-vacuity", () => {
    expect(isOwedALoadingFile(join(repoRoot, "app/[locale]/(site)/turkiye/[slug]/page.tsx"))).toBe(
      true,
    );
    expect(isOwedALoadingFile(join(repoRoot, "app/[locale]/(site)/deprem/page.tsx"))).toBe(false);
  });
});

describe("every loading.tsx is one PageSkeleton", () => {
  it("imports and renders PageSkeleton and nothing else", () => {
    for (const file of walkLoadingFiles()) {
      const source = sourceOf(file);
      expect(source, label(file)).toMatch(
        /import \{ PageSkeleton \} from "@\/components\/patterns\/page-skeleton"/,
      );
      expect(source, label(file)).toMatch(
        /return <PageSkeleton shape="(hub|detail|account|auth|play)" \/>;/,
      );
      expect(source, label(file)).not.toMatch(/<Skeleton\b|animate-pulse/);
    }
  });
});

describe("skeleton spellings live in one place", () => {
  it("no page or v2 component renders the Skeleton primitive directly", () => {
    const offenders = surfaceFiles()
      .filter((file) => /<Skeleton\b/.test(sourceOf(file)))
      .map(label);
    expect(offenders).toEqual([]);
  });

  /**
   * Three client components pulse their OWN pending indicators (a ticker value, a map tile, a
   * game overlay) and predate T-037; they are not route skeletons. Pinned by name so a fourth —
   * a page writing its own fallback instead of reaching for `page-skeleton.tsx` — goes red.
   */
  it("animate-pulse outside components/patterns is the measured three", () => {
    const pulsing = surfaceFiles()
      .filter((file) => /animate-pulse/.test(sourceOf(file)))
      .map(label)
      .sort();
    expect(pulsing).toEqual([
      "components/v2/v2-game-screen.tsx",
      "components/v2/v2-live-ticker.tsx",
      "components/v2/v2-marine-map-explorer.tsx",
    ]);
  });
});
```

Run: `pnpm vitest run components/v2/page-composition-loading.test.ts` — expected PASS after Tasks 3–13. If the "owed population" case lists a page not in the spec's nine, read that page: either it still awaits a loader before `return (` (finish its split) or it exports `force-dynamic` the spec missed (then the spec and this list are wrong together — fix both and say so in the commit).

- [ ] **Step 3: Documentation**

`docs/architecture.md`, Routing section, add a bullet:

```
- **Loading states (T-037).** A route gets a `loading.tsx` only when its page must block before
  its first `return` — an entity lookup that decides `notFound()`, a session read that decides
  `redirect()` — or is `force-dynamic` (Next prefetches a dynamic route down to its loading
  boundary, which is what makes the click instant). Nine routes today; static routes get none,
  because Next prefetches them in full and a full-page skeleton there is a flash. Every other
  server fetch renders behind `<Suspense>` with a piece of `components/patterns/page-skeleton.tsx`
  as its fallback, and the section component is a top-level `async function` in the same
  `page.tsx` — the composition scanners pin exact page paths, and an in-file declaration is
  followed by their render walk while a new file is not.
  `components/v2/page-composition-loading.test.ts` holds all three rules.
```

Data access section, add a bullet:

```
- **Shared loaders are `cache()`-wrapped.** `apiGet` passes an `AbortSignal`, and Next's fetch
  memoization returns the raw `fetch` when a signal is present — so two Suspense sections calling
  the same loader would fetch twice. The loaders read by more than one boundary (or by
  `generateMetadata` and the body) are `export const x = cache(async () => …)` in `lib/api/*`;
  `lib/api/request-dedupe.test.ts` pins the list. A page-local composite loader follows the same
  form (`const loadX = cache(async (plateCode) => …)` at module scope in the page).
```

`TASKS.md`: move T-037 to DONE with the measured counts (9 `loading.tsx`, number of Suspense boundaries from `grep -rc "<Suspense" app | awk -F: '{s+=$2} END {print s}'`, test totals) and the PR number once opened.

- [ ] **Step 4: Full gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add lib/test-support/composition-scan.ts components/v2/page-composition-loading.test.ts docs/architecture.md
git commit -m "test(composition): pin loading.tsx coverage and skeleton spellings; document the rules (t-037)"
```

(`TASKS.md` lives in the workspace root, which is not a git repo — edit it, no commit.)

---

### Task 15: Build, screenshots, overflow sweep

**Files:** none new in the repo except `t037_shots/**` (gitignored pattern `*_shots/**` already exists per T-035 PR4).

- [ ] **Step 1: Production build**

```bash
docker stop cografya-web-dev
pnpm build
docker start cografya-web-dev
```

Expected: `✓ Compiled successfully`, prerender floor script green, no `MISSING_MESSAGE`. If a province or country page fails with `ECONNRESET`/`ApiError 500`, make sure no Playwright session or sweep is running, then rerun (recorded flake in `docs/architecture.md`).

- [ ] **Step 2: Skeleton screenshots and layout-shift measurement**

For each of `/turkiye`, `/dunya`, `/turkiye/ankara`, `/hesabim` (logged in, or accept the `/giris` redirect and screenshot `/kayit` instead), `/oyun/81-il`:

1. Load `/` at the viewport, wait for `document.fonts.ready`.
2. `docker pause cografya-api-dev`.
3. Click the in-page link to the route (or `browser_navigate` for the play screen); within 3 s take the screenshot `t037_shots/<route>-loading-<w>-<theme>.png` and read `Array.from(document.querySelectorAll('[data-slot="card"], .aspect-\\[1270\\/580\\], [data-skeleton]')).map(e => Math.round(e.getBoundingClientRect().top))`.
4. `docker unpause cografya-api-dev`; wait for the content; screenshot `t037_shots/<route>-loaded-<w>-<theme>.png`; read the same tops for the loaded hero card, stat strip and plate.
5. Viewports 320, 360, 390, 1440; themes light and dark (toggle via the header control).

Record the top-edge deltas in a table in the PR description. Any delta above 8 px is a measurement failure: fix the skeleton piece's height, not the tolerance.

- [ ] **Step 3: Overflow sweep**

```bash
pnpm sweep:overflow
```

Expected: PASS. For the skeleton states, run once with the API paused: `pnpm sweep:overflow -- --filter=/turkiye` while `docker pause cografya-api-dev` is in effect (the sweep's 15 s budget may time out on the paused route; that is the API, not an overflow — unpause and rerun the filter to confirm the loaded state is clean).

- [ ] **Step 4: Finish the branch**

Follow `superpowers:finishing-a-development-branch`: squash PR `feature/t037-loading-states` → `dev` in `cografya_web`, description with the counter table, the layout-shift table and the screenshot pairs. Do not push without being asked.

---

## Self-review notes

- Spec §4 listed `dunya/kita/[slug]` as a `loading.tsx` route; the plan drops it (its `notFound()` is synchronous and its body awaits no loader after the split), and the spec was corrected in the same commit: nine `loading.tsx`, not ten.
- Spec §1 pieces: `BreadcrumbsSkeleton`, `HeroSkeleton`, `StatTileSkeleton`, `PlateSkeleton`, `ProseSkeleton`, `CardGridSkeleton` → Task 1; the spec's `TableSkeleton` reuse is not needed (the basin table's fallback is `ProseSkeleton`), and `InlineSkeleton` was added for the one-line cases (hero stat trio, `/deniz` lede, section-1 counts). Spec §2 → Task 2. Spec §3 (in-file sections, play chrome move) → Tasks 3–13. Spec §4 per-page table → Tasks 3–13 one to one; the `home` row → Task 6. Spec §5 guards 1–4 → Tasks 1, 2, 14; guard 5 (rsc-boundary) runs in every task's `pnpm test`; guard 6 (pinned counters unchanged) is asserted by the existing suites in every task. Spec §6 → Task 15.
- Type consistency: `PlateAspect` = `"map" | "continent" | "game"` everywhere; `CardGridSkeleton` gains `height?: "card" | "form"` in Task 11 — the edit lands in `page-skeleton.tsx` with their tests in `page-skeleton.test.tsx`, and Task 1's `className?: never` count stays 3 (the new props are on existing exports).
- Placeholder scan: every "verbatim" instruction names the exact line range in the file as of `a5ca222`; line numbers drift after earlier edits in the same file, so executors locate by the quoted first line, not the number.
