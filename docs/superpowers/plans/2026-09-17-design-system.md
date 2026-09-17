# Terra Design System Implementation Plan (T-034)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `components/ui` into a deliberate component system with Terra's character, backed by a living showcase at `/design-system` that displays every component in both themes.

**Architecture:** Five phases in sequence. **A** builds the showcase shell and ports the existing specimens onto it. **A2** extends the token bridge with the semantic tokens it is missing and rebinds the six primitives that currently escape it — without this, no theme change can reach them. **B** mounts a real theme mechanism. **C** writes the night-sea dark palette and verifies it on the showcase. **D** adds fifteen components and three extensions, each landing with its own specimen.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4 (CSS-first, no config file), shadcn `base-nova` on Base UI, `class-variance-authority`, next-intl 4, next-themes ^0.4.6, vitest (node env, **no jsdom**), Node 24, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-17-design-system-design.md`

## Global Constraints

- Work on a `feature/*` branch off `dev`. Never push to `main`. Conventional Commits (commitlint hook active).
- **Vitest runs nothing under `app/`, and there is no jsdom.** No rendering tests. Assertions are structure tests over source text (`readFileSync` + regex/`toContain`) or pure unit tests over `lib/`. This is the house form — see `lib/seo/auth-routes.test.ts`, `lib/seo/redirects.test.ts`, `components/v2/v2-header-search-theme.test.ts`.
- Gate before every commit: `pnpm typecheck && pnpm lint && pnpm test`. Add `pnpm build` when routing or SEO is touched.
- **No colour escapes.** Never write `bg-[var(--color-x,#hex)]`, a brand hex, or a raw Tailwind palette class (`bg-amber-500`) in `components/ui`, `components/patterns` or the showcase. Colour comes from bridge tokens only (`bg-primary`, `text-muted-foreground`, `border-border`). Closing these is what A2 is for; do not reintroduce them.
- **Never hand-write a `dark:` class in a component.** Dark mode is carried by the `.dark` token block. A component that needs a `dark:` variant is a component bound to the wrong token.
- `Button` has no `asChild`. A link styled as a button is `<Link className={cn(buttonVariants({ variant, size }))}>`.
- Import `Link`, `redirect`, `usePathname`, `useRouter` from `@/i18n/navigation`, never `next/link` or `next/navigation`.
- Every route needs an `i18n/routing.ts` `pathnames` entry for TR **and** EN.
- House component form: `cva` for variants, `cn()` from `@/lib/utils` to merge, named export plus the variants object (`export { Badge, badgeVariants }`), `React.forwardRef` only where a ref is genuinely needed (`Button` has one; `Badge` does not).
- `docs/design.md` overrides anything a skill or this plan suggests about visual style.
- Visual check at 320, 360, 390 px and desktop, in both themes, before a task closes.

---

## File Structure

**Phase A**

| File                                                | Responsibility                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `components/patterns/theme-pair.tsx`                | `ThemePair` — renders a specimen twice, ambient and forced-dark.                               |
| `components/showcase/specimen.tsx`                  | `Specimen` — one labelled entry: name, description, the `ThemePair`, optional notes.           |
| `components/showcase/registry.ts`                   | The single list of categories and which component each contains. The coverage test reads this. |
| `app/[locale]/v2/design-system/layout.tsx`          | Showcase chrome: sidebar nav from the registry, `noindex` metadata.                            |
| `app/[locale]/v2/design-system/page.tsx`            | Index: category cards, palette strip, type scale.                                              |
| `app/[locale]/v2/design-system/[category]/page.tsx` | One category's specimens, driven by the registry.                                              |
| `components/showcase/registry.test.ts`              | Coverage tripwire: every component file appears in exactly one category.                       |

**Phase A2**

| File                                                       | Responsibility                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `app/globals.css`                                          | Bridge gains `--success`, `--warning`, `--info`, `--chip` and their foregrounds, in `:root`, `@theme inline` and `.dark`.     |
| `components/ui/{badge,button,alert,sheet,tabs,dialog}.tsx` | 44 escapes and 12 raw amber classes rebound.                                                                                  |
| `components/ui/token-binding.test.ts`                      | Tripwire: no escape, no brand hex, no raw palette class, no hand-written `dark:` in `components/ui` or `components/patterns`. |

**Phase B**

| File                                           | Responsibility                              |
| ---------------------------------------------- | ------------------------------------------- |
| `app/[locale]/layout.tsx`                      | Mounts `ThemeProvider`.                     |
| `components/v2/theme-toggle.tsx`               | Rewritten on `useTheme()`, three states.    |
| `components/v2/v2-header-search-theme.test.ts` | Assertions rewritten for the new mechanism. |

**Phase D** — `components/ui/` for CLI output (`tooltip`, `popover`, `progress`, `pagination`, `breadcrumb`, `separator`, `spinner`); `components/patterns/` for bespoke (`typography`, `stat-tile`, `empty-state`, `callout`, `form-field`, `metric-value`, `map-attribution`, `map-legend`). The split is operational: `shadcn add` overwrites the `ui` alias, so nothing hand-written may live there.

---

# Phase A — Showcase shell

Branch: `feature/t034-a-showcase-shell`.

## Task 1: `ThemePair`

**Files:**

- Create: `components/patterns/theme-pair.tsx`
- Create: `components/patterns/theme-pair.test.ts`

**Interfaces:**

- Produces: `ThemePair({ children, portals }: { children: React.ReactNode; portals?: boolean }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```ts
// components/patterns/theme-pair.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(fileURLToPath(new URL("./theme-pair.tsx", import.meta.url)), "utf8");

describe("ThemePair", () => {
  it("forces the dark panel with a .dark wrapper", () => {
    // app/globals.css declares `@custom-variant dark (&:is(.dark *))`, so a wrapper
    // element carrying `dark` makes both the `dark:` variant and the .dark custom
    // properties apply to everything inside it.
    expect(SOURCE).toMatch(/className=\{?["'`][^"'`]*\bdark\b/);
  });

  it("paints its own surface, because body normally supplies it", () => {
    expect(SOURCE).toContain("bg-background");
    expect(SOURCE).toContain("text-foreground");
  });

  it("warns when a specimen portals out of the wrapper", () => {
    // Dialog, Sheet, Popover, Tooltip, DropdownMenu and toasts render into
    // document.body, escaping the wrapper and picking up the GLOBAL theme.
    expect(SOURCE).toContain("portals");
  });

  it("labels both panels for the reader", () => {
    expect(SOURCE).toMatch(/Aydınlık|Light/);
    expect(SOURCE).toMatch(/Karanlık|Dark/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run components/patterns/theme-pair.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Implement it**

```tsx
// components/patterns/theme-pair.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface ThemePairProps {
  readonly children: React.ReactNode;
  /**
   * Set for a specimen whose content renders through a portal — Dialog, Sheet, Popover,
   * Tooltip, DropdownMenu, toasts. Their markup lands on `document.body`, outside this
   * wrapper, so it picks up the GLOBAL theme and the two panels show the same thing.
   * Marking it says so on the page instead of letting the reader draw a false conclusion.
   */
  readonly portals?: boolean;
  readonly className?: string;
}

/**
 * Renders one specimen twice: ambient theme on the left, forced dark on the right.
 *
 * The forced panel works because `app/globals.css` declares
 * `@custom-variant dark (&:is(.dark *))` — Tailwind's `dark:` variant matches any
 * descendant of a `.dark` element — and because the custom properties in the `.dark` block
 * cascade to descendants like any other CSS variable. No second page, no iframe.
 *
 * The panel paints `bg-background`/`text-foreground` itself: those normally come from
 * `body`, which this wrapper is not.
 */
export function ThemePair({ children, portals = false, className }: ThemePairProps) {
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
        <figure className="space-y-2">
          <figcaption className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Aydınlık
          </figcaption>
          <div className="rounded-xl border border-border bg-background p-5 text-foreground">
            {children}
          </div>
        </figure>

        <figure className="space-y-2">
          <figcaption className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Karanlık
          </figcaption>
          <div className="dark rounded-xl border border-border bg-background p-5 text-foreground">
            {children}
          </div>
        </figure>
      </div>

      {portals ? (
        <p className="text-xs text-muted-foreground">
          Bu bileşen içeriğini <code>document.body</code>&apos;ye taşıyor, yani açıldığında
          sarmalayıcının dışında render oluyor ve sayfanın genel temasını alıyor. İki temayı
          karşılaştırmak için üstteki tema düğmesini kullanın.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run components/patterns/theme-pair.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/patterns/theme-pair.tsx components/patterns/theme-pair.test.ts
git commit -m "feat(design-system): add ThemePair for side-by-side theme specimens"
```

## Task 2: The registry and `Specimen`

The registry is the one place that says which component belongs to which category. Both the showcase routes and the coverage tripwire read it, so they cannot disagree.

**Files:**

- Create: `components/showcase/registry.ts`
- Create: `components/showcase/specimen.tsx`

**Interfaces:**

- Consumes: `ThemePair` (Task 1).
- Produces:
  - `CATEGORIES: readonly ShowcaseCategory[]` where
    `interface ShowcaseCategory { readonly slug: string; readonly title: string; readonly blurb: string; readonly components: readonly string[] }`
  - `EXEMPT_FILES: readonly string[]` — files that are showcase machinery, not specimens
  - `Specimen({ name, description, portals, children }): JSX.Element`

- [ ] **Step 1: Write the registry**

`components` entries are **file basenames without extension**, so the coverage test can match them against the filesystem directly.

```ts
// components/showcase/registry.ts

export interface ShowcaseCategory {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  /** Basenames in components/ui or components/patterns, without extension. */
  readonly components: readonly string[];
}

/**
 * The single source of truth for what the showcase contains.
 *
 * `components/showcase/registry.test.ts` reads this alongside the filesystem and fails if a
 * component exists without a specimen, or is listed in two categories, or is listed but does
 * not exist. That is what stops the showcase drifting from the code, which is the standard
 * way a design system dies.
 *
 * Entries are added as their component lands, not up front — a name here with no file is a
 * failing test, by design.
 */
export const CATEGORIES: readonly ShowcaseCategory[] = [
  {
    slug: "temeller",
    title: "Temeller",
    blurb: "Renk token'ları, tipografi ölçeği, ayırıcılar ve klavye tuşları.",
    components: ["typography", "separator"],
  },
  {
    slug: "aksiyonlar",
    title: "Aksiyonlar",
    blurb: "Butonlar ve yükleme göstergeleri.",
    components: ["button", "spinner"],
  },
  {
    slug: "formlar",
    title: "Formlar",
    blurb: "Alan sarmalayıcısı ve girdi kontrolleri.",
    components: [
      "form-field",
      "input",
      "textarea",
      "checkbox",
      "switch",
      "select",
      "custom-select",
      "label",
    ],
  },
  {
    slug: "veri",
    title: "Veri",
    blurb: "Tablolar, sayısal göstergeler ve sayfalama.",
    components: ["table", "stat-tile", "metric-value", "pagination", "progress"],
  },
  {
    slug: "geri-bildirim",
    title: "Geri Bildirim",
    blurb: "Sistem durumu, editoryal not, boş durum ve ipuçları.",
    components: ["alert", "callout", "sonner", "empty-state", "tooltip", "popover", "skeleton"],
  },
  {
    slug: "duzen",
    title: "Düzen",
    blurb: "Kartlar, katmanlar, sekmeler ve gezinme.",
    components: [
      "card",
      "dialog",
      "sheet",
      "tabs",
      "accordion",
      "breadcrumb",
      "avatar",
      "badge",
      "dropdown-menu",
    ],
  },
  {
    slug: "harita",
    title: "Harita",
    blurb: "Harita yanına giren atıf ve lejant bileşenleri.",
    components: ["map-attribution", "map-legend"],
  },
] as const;

/**
 * Files in the two component directories that are NOT specimens.
 *
 * An explicit list rather than a pattern: an exemption nobody wrote down is how a coverage
 * test quietly stops covering things. Add to it deliberately, with a reason.
 */
export const EXEMPT_FILES: readonly string[] = [
  // Showcase machinery — it renders the specimens, it is not one.
  "theme-pair",
] as const;

export function categoryBySlug(slug: string): ShowcaseCategory | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
```

- [ ] **Step 2: Write `Specimen`**

```tsx
// components/showcase/specimen.tsx
import * as React from "react";
import { ThemePair } from "@/components/patterns/theme-pair";

interface SpecimenProps {
  readonly name: string;
  readonly description?: string;
  /** Pass through to ThemePair for components that render via a portal. */
  readonly portals?: boolean;
  readonly children: React.ReactNode;
}

/** One labelled entry in the showcase: a heading, a note, and the specimen in both themes. */
export function Specimen({ name, description, portals, children }: SpecimenProps) {
  return (
    <section className="space-y-3 scroll-mt-24" id={name.toLowerCase().replace(/\s+/g, "-")}>
      <div className="space-y-1">
        <h3 className="font-heading text-lg font-bold text-foreground">{name}</h3>
        {description !== undefined ? (
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <ThemePair portals={portals}>{children}</ThemePair>
    </section>
  );
}
```

- [ ] **Step 3: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green. The registry lists components that do not exist yet (`typography`, `spinner`, …) — that is fine until Task 3 adds the test that checks them, which is why the test comes after.

- [ ] **Step 4: Commit**

```bash
git add components/showcase/registry.ts components/showcase/specimen.tsx
git commit -m "feat(design-system): add the showcase registry and Specimen"
```

## Task 3: Showcase routes

**Files:**

- Create: `app/[locale]/v2/design-system/layout.tsx`
- Create: `app/[locale]/v2/design-system/page.tsx`
- Create: `app/[locale]/v2/design-system/[category]/page.tsx`
- Modify: `i18n/routing.ts`

- [ ] **Step 1: Add the routing entries**

```ts
    "/v2/design-system": {
      tr: "/v2/design-system",
      en: "/v2/design-system",
    },
    "/v2/design-system/[category]": {
      tr: "/v2/design-system/[category]",
      en: "/v2/design-system/[category]",
    },
```

Same segment in both locales, matching how the existing V1 `/design-system` entry is written. The showcase is an internal tool; its URL is not editorial copy.

- [ ] **Step 2: Write the layout**

```tsx
// app/[locale]/v2/design-system/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { CATEGORIES } from "@/components/showcase/registry";

export const metadata: Metadata = {
  // Internal tooling. The V1 page it replaces had no generateMetadata at all and was
  // therefore technically indexable; that is fixed here.
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
        <nav aria-label="Tasarım sistemi bölümleri" className="lg:w-56 lg:shrink-0">
          <Link
            href={"/v2/design-system" as never}
            className="font-heading text-lg font-bold text-foreground"
          >
            Terra
          </Link>
          <ul role="list" className="mt-4 space-y-1">
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/v2/design-system/${category.slug}` as never}
                  className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {category.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
```

The `as never` casts are the repo's documented escape for next-intl's typed `Link` rejecting a computed href — `CLAUDE.md` names `as unknown as React.ComponentProps<typeof Link>["href"]` as the sanctioned form. Use that longer form if `as never` trips the lint rule; do not use `as any`.

- [ ] **Step 3: Write the index page**

Category cards from the registry, plus a palette strip and a type-scale sample rendered through `ThemePair` so both themes are visible from the first screen. Colour swatches read bridge tokens by class (`bg-primary`, `bg-muted`, `bg-destructive`, …), never a hex.

- [ ] **Step 4: Write the category page**

```tsx
// app/[locale]/v2/design-system/[category]/page.tsx
import { notFound } from "next/navigation";
import { CATEGORIES, categoryBySlug } from "@/components/showcase/registry";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

export default async function CategoryPage({
  params,
}: {
  readonly params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (category === undefined) notFound();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-bold text-foreground">{category.title}</h1>
        <p className="max-w-prose text-muted-foreground">{category.blurb}</p>
      </header>
      {renderSpecimens(slug)}
    </div>
  );
}
```

`renderSpecimens` is a `switch` over the slug returning that category's `<Specimen>` blocks, kept in a sibling file per category (`./specimens/temeller.tsx` and so on) so no single file carries all thirty-five. A component's specimen is written in the task that builds the component, not here.

- [ ] **Step 5: Port the existing specimens**

`app/[locale]/design-system/page.tsx` (1,235 lines) already demonstrates Button, Input, Select, Checkbox, Switch, Badge, Label, Alert, Tabs, Avatar, Dialog, Sheet and toasts. Move each into the matching category's specimens file, **rewriting every colour escape** as you go — the source uses `text-[var(--color-primary-dark,#7e3a1e)]` and similar throughout, which is exactly what this system exists to eliminate.

Leave the V1 page in place; T-032 deletes it.

- [ ] **Step 6: Verify the build and look at it**

Run: `pnpm build && pnpm dev`, then open `/v2/design-system` and each category. Screenshot at 320, 360, 390 px and desktop.

Dark panels will look poor at this stage — the `.dark` block is still shadcn's stock grey and six primitives cannot respond to it at all. That is the state Phases A2 and C fix, and seeing it is the point.

- [ ] **Step 7: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add "app/[locale]/v2/design-system" components/showcase i18n/routing.ts
git commit -m "feat(design-system): add the showcase routes and port existing specimens"
```

## Task 4: The coverage tripwire

**Files:**

- Create: `components/showcase/registry.test.ts`

- [ ] **Step 1: Write the test**

```ts
// components/showcase/registry.test.ts
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATEGORIES, EXEMPT_FILES } from "./registry";

const dirOf = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

function basenamesIn(rel: string): string[] {
  return readdirSync(dirOf(rel))
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => f.replace(/\.tsx$/, ""));
}

const ON_DISK = [...basenamesIn("../ui"), ...basenamesIn("../patterns")].filter(
  (name) => !EXEMPT_FILES.includes(name),
);

const LISTED = CATEGORIES.flatMap((category) => category.components);

/**
 * The staleness tripwire.
 *
 * A design system dies by drifting: a component ships, nobody adds its specimen, and the
 * showcase slowly stops describing the code. These assertions make that a failing test
 * instead of a discovery six months later.
 *
 * What this does NOT claim: that a specimen exercises every variant. Proving that needs
 * rendering, which this suite has no jsdom for. The gap is accepted and written down here
 * rather than left implied.
 */
describe("showcase coverage", () => {
  it("positive control — both directories were actually read", () => {
    expect(ON_DISK.length).toBeGreaterThan(15);
    expect(ON_DISK).toContain("button");
  });

  it("every component has a specimen", () => {
    const missing = ON_DISK.filter((name) => !LISTED.includes(name));
    expect(missing, `no showcase category lists: ${missing.join(", ")}`).toEqual([]);
  });

  it("every listed component exists on disk", () => {
    const phantom = LISTED.filter((name) => !ON_DISK.includes(name));
    expect(phantom, `listed but no file: ${phantom.join(", ")}`).toEqual([]);
  });

  it("no component is listed in two categories", () => {
    const seen = new Set<string>();
    const duplicated = LISTED.filter((name) => {
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });
    expect(duplicated).toEqual([]);
  });

  it("category slugs are unique", () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
  });
});
```

- [ ] **Step 2: Run it — it will fail, and the failure is the worklist**

Run: `pnpm vitest run components/showcase/registry.test.ts`
Expected: FAIL on "every listed component exists on disk", naming `typography`, `spinner`, `separator`, `tooltip`, `popover`, `progress`, `pagination`, `breadcrumb`, `form-field`, `stat-tile`, `metric-value`, `empty-state`, `callout`, `map-attribution`, `map-legend`.

That list is exactly Phase D. To keep the suite green until then, temporarily comment out the "every listed component exists on disk" assertion with a note naming this task and Phase D; re-enable it in Task 22. Do **not** delete it, and do not trim the registry — the registry is the plan.

- [ ] **Step 3: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/showcase/registry.test.ts
git commit -m "test(design-system): add the showcase coverage tripwire"
```

---

# Phase A2 — Rebind the token bridge

Branch: `feature/t034-a2-token-bridge`. **This is the prerequisite for Phase C.** Six primitives currently read Terra `--color-*` tokens with hard-coded light hex fallbacks; those tokens are never redefined in `.dark`, so no palette change can reach them.

## Task 5: Extend the bridge with the missing semantic tokens

The rebinding is not find-and-replace. `--success`, `--warning`, `--info` and the chip pair **do not exist** in the bridge, so there is nothing to rebind to yet.

**Files:**

- Modify: `app/globals.css`
- Create: `app/globals-tokens.test.ts` → no; tests cannot live under `app/`. Create: `lib/theme/bridge-tokens.test.ts`

**Interfaces:**

- Produces: bridge tokens `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--info`, `--info-foreground`, `--chip`, `--chip-foreground`, each re-exported through `@theme inline` as `--color-*` Tailwind keys so `bg-success` and `text-info` become real classes.

- [ ] **Step 1: Write the failing test**

```ts
// lib/theme/bridge-tokens.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

const section = (name: string) => {
  const start = CSS.indexOf(name);
  expect(start, `${name} block not found`).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    if (CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) return CSS.slice(open, i);
    }
  }
  throw new Error(`${name} block never closed`);
};

const SEMANTIC = ["success", "warning", "info", "chip"] as const;

/**
 * The semantic half of the shadcn bridge.
 *
 * Terra has always had `--color-success`, `--color-warning`, `--color-info` and the chip
 * pair, but the bridge never carried them, so components reached for the raw Terra token
 * with a hex fallback instead — 44 such escapes across six files (T-034 spec §3). Those
 * tokens are not redefined under `.dark`, so every one of them was frozen at its light
 * value in dark mode.
 *
 * These assertions pin the fix in all three places a bridge token has to appear: declared
 * in `:root`, re-exported through `@theme inline` so Tailwind emits `bg-success` and
 * friends, and redefined under `.dark`.
 */
describe("semantic bridge tokens", () => {
  const root = section(":root");
  const theme = section("@theme inline");
  const dark = section(".dark");

  it.each(SEMANTIC)("--%s is declared in :root with a foreground", (name) => {
    expect(root).toContain(`--${name}:`);
    expect(root).toContain(`--${name}-foreground:`);
  });

  it.each(SEMANTIC)("--%s is re-exported through @theme inline", (name) => {
    expect(theme).toContain(`--color-${name}: var(--${name})`);
    expect(theme).toContain(`--color-${name}-foreground: var(--${name}-foreground)`);
  });

  it.each(SEMANTIC)("--%s is redefined under .dark", (name) => {
    expect(dark).toContain(`--${name}:`);
    expect(dark).toContain(`--${name}-foreground:`);
  });

  it("positive control — the parser found real blocks", () => {
    expect(root).toContain("--color-primary");
    expect(dark).toContain("--background");
    expect(theme).toContain("--color-background");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run lib/theme/bridge-tokens.test.ts`
Expected: FAIL on every `it.each` row.

- [ ] **Step 3: Add the tokens to `:root`**

In `app/globals.css`, in the bridge block alongside `--destructive` (around the `--primary` / `--secondary` / `--accent` group), add:

```css
/* Semantic bridge tokens (T-034). Terra has carried --color-success/-warning/-info and the
     chip pair since the start, but the BRIDGE never did — so components reached for the raw
     Terra token with a hex fallback, e.g. bg-[var(--color-success,#496f35)]. Those escapes
     read a token the .dark block does not redefine, which froze every one of them at its
     light value in dark mode (spec §3). Declared here, re-exported in @theme inline below,
     and redefined in .dark, they become ordinary theme-aware utilities: bg-success,
     text-info, border-warning.
     The light values are the Terra tokens themselves, so light mode does not move. */
--success: var(--color-success);
--success-foreground: #ffffff;
--warning: var(--color-warning);
--warning-foreground: var(--color-ink-dark);
--info: var(--color-info);
--info-foreground: #ffffff;
--chip: var(--color-chip-bg);
--chip-foreground: var(--color-chip-ink);
```

`--warning-foreground` pairs with the warm near-black rather than white: `--color-warning` is `#c9860f`, an amber on which white text does not clear 4.5:1. Measure it before accepting; if `--color-ink-dark` also misses, the fix is the foreground, never a lower bar.

- [ ] **Step 4: Re-export them in `@theme inline`**

```css
--color-success: var(--success);
--color-success-foreground: var(--success-foreground);
--color-warning: var(--warning);
--color-warning-foreground: var(--warning-foreground);
--color-info: var(--info);
--color-info-foreground: var(--info-foreground);
--color-chip: var(--chip);
--color-chip-foreground: var(--chip-foreground);
```

`@theme inline` already re-exports `--color-success`, `--color-warning` and `--color-info` pointing at the **Terra** tokens. Those three lines are replaced, not duplicated — pointing them at the bridge is the whole change. Check for the existing lines before adding.

- [ ] **Step 5: Add placeholder values under `.dark`**

```css
/* Placeholders. Phase C (T-031b) replaces these with measured night-sea values; they exist
     now so the bridge is complete and the six rebound primitives have something to resolve
     against. Lifting lightness is the same move T-018 made for primary/secondary/accent. */
--success: oklch(0.65 0.095 140);
--success-foreground: var(--color-ink-dark);
--warning: oklch(0.75 0.13 75);
--warning-foreground: var(--color-ink-dark);
--info: oklch(0.65 0.0675 202);
--info-foreground: var(--color-ink-dark);
--chip: oklch(0.269 0 0);
--chip-foreground: oklch(0.85 0.04 40);
```

- [ ] **Step 6: Run the test and look at the showcase**

Run: `pnpm vitest run lib/theme/bridge-tokens.test.ts`
Expected: PASS.

Then open `/v2/design-system/geri-bildirim`. Nothing changes yet — the components still escape. That is the next task.

- [ ] **Step 7: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add app/globals.css lib/theme/bridge-tokens.test.ts
git commit -m "feat(theme): add success, warning, info and chip to the token bridge"
```

## Task 6: Rebind `badge`, `button`, `alert`

**Files:**

- Modify: `components/ui/badge.tsx` (5 escapes)
- Modify: `components/ui/button.tsx` (4 escapes)
- Modify: `components/ui/alert.tsx` (3 escapes + all 12 raw amber classes)

- [ ] **Step 1: Rebind `badge.tsx`**

| Was                                                                      | Becomes                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `text-[var(--color-primary-dark,#7e3a1e)]`                               | `text-primary`                                             |
| `bg-[var(--color-success,#496f35)]/15 text-[…] border-[…]/30`            | `bg-success/15 text-success border-success/30`             |
| `bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30` | `bg-warning/15 text-warning border-warning/30`             |
| `bg-[var(--color-danger,#b23b2e)]/…`                                     | `bg-destructive/15 text-destructive border-destructive/30` |
| `bg-[var(--color-info,#276b70)]/…`                                       | `bg-info/15 text-info border-info/30`                      |
| `bg-[var(--color-chip-bg,#ede3d5)] text-[var(--color-chip-ink,#7e3a1e)]` | `bg-chip text-chip-foreground`                             |

The `dark:text-amber-200` on the warning variant is **deleted, not translated**. A hand-written `dark:` class in a primitive is the defect; the `.dark` block now carries that difference.

- [ ] **Step 2: Rebind `button.tsx`**

`emerald` → `bg-secondary text-secondary-foreground hover:bg-secondary/90`, `sky` and `teal` → `bg-info` / `bg-accent` with their foregrounds, `amber` → `bg-warning text-warning-foreground`.

`emerald`, `sky`, `teal` and `amber` are colour-named variants in a system whose other variants are semantic. Leave the names alone in this task — 34 V2 files call them and renaming is a separate change with its own diff. Note it in `docs/design.md` as a known wart.

- [ ] **Step 3: Rebind `alert.tsx`**

Each variant collapses from a long escaped string with pointless `dark:` twins into one semantic line, e.g.:

```ts
        success:
          "bg-success/10 text-success border-success/30 [&>svg]:text-success",
```

The existing `dark:bg-[var(--color-success,#496f35)]/20 dark:text-[var(--color-success,#496f35)]` pairs resolve to the _same_ value as their light counterparts — someone added dark support and bound it to the light token, so it never did anything. Delete them; the `.dark` block is where that difference belongs now.

- [ ] **Step 4: Confirm light mode did not move**

Screenshot `/v2/design-system/geri-bildirim` and `…/duzen` before and after. **No visible difference in light mode is the pass condition** — the bridge tokens resolve to the same Terra values. A difference means a token was mapped wrong.

In dark mode the variants should now respond to the placeholder values from Task 5 instead of staying light.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/ui/badge.tsx components/ui/button.tsx components/ui/alert.tsx
git commit -m "fix(ui): bind badge, button and alert to the token bridge"
```

## Task 7: Rebind `sheet`, `tabs`, `dialog`, and add the escape tripwire

**Files:**

- Modify: `components/ui/{sheet,tabs,dialog}.tsx` (1 escape each)
- Create: `components/ui/token-binding.test.ts`

- [ ] **Step 1: Rebind the three**

All three use `text-[var(--color-primary-dark,#7e3a1e)]` for an active or emphasised state — `tabs.tsx` on `aria-selected`, the other two on a heading. Replace with `text-primary`.

- [ ] **Step 2: Write the tripwire**

```ts
// components/ui/token-binding.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIRS = ["../ui", "../patterns"] as const;

const FILES = DIRS.flatMap((rel) => {
  const dir = fileURLToPath(new URL(rel, import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => [join(rel, f), readFileSync(join(dir, f), "utf8")] as const);
});

const RAW_PALETTE =
  /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|amber|emerald|sky|teal|rose|red|green|blue|orange|yellow|indigo|violet|purple|pink|cyan|lime)-\d{2,3}\b/;

/**
 * Colour in a component comes from a bridge token. Three things are forbidden and each has
 * cost this repo something already (T-034 spec §3):
 *
 *   - `var(--color-x, #hex)` escapes — read a Terra token the .dark block never redefines,
 *     so the component is frozen at its light value in dark mode. There were 44.
 *   - raw Tailwind palette classes — off-brand and theme-blind.
 *   - hand-written `dark:` classes — a component needing one is bound to the wrong token.
 *     `docs/design.md` says this outright: override tokens in `.dark`, do not sprinkle
 *     `dark:` per component.
 */
describe("components bind colour through the token bridge", () => {
  it("positive control — files were actually read", () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES.some(([path]) => path.endsWith("button.tsx"))).toBe(true);
  });

  it.each(FILES)("%s has no var(--color-*, #hex) escape", (_path, source) => {
    expect(source).not.toMatch(/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/);
  });

  it.each(FILES)("%s has no raw Tailwind palette class", (_path, source) => {
    expect(source).not.toMatch(RAW_PALETTE);
  });

  it.each(FILES)("%s has no brand hex literal", (_path, source) => {
    expect(source).not.toMatch(/#(b0522e|7e3a1e|4f6d30|276b70|496f35|c9860f|b23b2e|ede3d5)/i);
  });

  it.each(FILES)("%s writes no hand-rolled dark: class", (_path, source) => {
    expect(source).not.toMatch(/\bdark:/);
  });
});
```

`components/patterns/theme-pair.tsx` carries the literal class `dark` on a wrapper, not a `dark:` variant, so it passes. If any legitimate exception appears later, add an explicit allowlist with a reason rather than loosening a regex.

- [ ] **Step 3: Run it**

Run: `pnpm vitest run components/ui/token-binding.test.ts`
Expected: PASS across every file. Any failure names the file and is a real escape.

- [ ] **Step 4: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add components/ui
git commit -m "fix(ui): finish the token rebinding and guard it with a tripwire"
```

---

# Phase B — Theme mechanism (T-031a)

Branch: `feature/t034-b-theme-mechanism`.

## Task 8: Mount `ThemeProvider`

**Files:**

- Modify: `app/[locale]/layout.tsx`
- Modify: `components/ui/sonner.tsx` (verify only)

- [ ] **Step 1: Mount it**

`next-themes@^0.4.6` is already a dependency. In the root layout, wrap the existing tree:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  storageKey="theme"
  disableTransitionOnChange
>
```

`storageKey="theme"` is the key the current toggle already writes, so nobody loses their preference. `disableTransitionOnChange` stops every transition firing at once on switch.

`ThemeProvider` is a client component; import it from a small `"use client"` wrapper rather than making the layout a client component.

Add `suppressHydrationWarning` to `<html>`: next-themes' blocking script mutates the class before React hydrates, and without it React logs a mismatch on every load.

- [ ] **Step 2: Confirm the flash is gone**

Set the OS to dark, hard-reload `/v2/design-system`. There must be no white flash. Previously the theme was applied in a post-hydration `useEffect`, which guaranteed one.

- [ ] **Step 3: Confirm `sonner` picks up a real theme**

`components/ui/sonner.tsx` already calls `useTheme()` and falls back to `"system"`. With a provider mounted it returns the real value and needs no edit — confirm by firing a toast from the showcase in dark mode and seeing it render dark.

- [ ] **Step 4: Add the light/dark `themeColor` pair**

`app/[locale]/layout.tsx`'s `viewport` pins `themeColor: "#b0522e"`. Replace with a media-query pair so mobile browser chrome follows the theme. The dark value is provisional until Phase C sets the palette; note that in a comment.

- [ ] **Step 5: Accept that V1 breaks**

A V1 page now renders half-dark for an OS-dark visitor: `body` takes `--background` from `.dark` while V1's CSS modules keep their light values. **This is expected and accepted** (owner, 2026-09-17 — the site is unannounced with no audience, and T-032 deletes V1). Do not add a theme boundary, a route marker or a `.v1-scope` shim; that scaffolding is exactly what this sequencing avoids.

- [ ] **Step 6: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add "app/[locale]/layout.tsx" components/theme-provider.tsx
git commit -m "feat(theme): mount next-themes with a system default"
```

## Task 9: Three-state `ThemeToggle`

**Files:**

- Modify: `components/v2/theme-toggle.tsx`
- Modify: `components/v2/v2-header-search-theme.test.ts`

- [ ] **Step 1: Rewrite the toggle on `useTheme()`**

Cycle light → dark → system → light. Icons: Sun, Moon, Monitor. The accessible name says what the **next** press does and must keep matching `/Tema|Karanlık|Aydınlık|Dark|Light/i`, which the existing test asserts and QA selectors rely on.

Keep the `mounted` guard: `useTheme()` returns `undefined` on the server, and rendering an icon before hydration causes a mismatch. The current file already solves this with `useSyncExternalStore`; `next-themes` needs the same care.

Announce the change politely — a `aria-live="polite"` region naming the new state — so the switch is not silent for screen-reader users.

- [ ] **Step 2: Rewrite the test's assertions**

`components/v2/v2-header-search-theme.test.ts` asserts implementation details that are about to be false: `document.documentElement.classList.add("dark")` and `localStorage.setItem("theme"`. Replace them with assertions about the new mechanism — that the file uses `useTheme` from `next-themes`, offers three states, and still carries an accessible name matching the QA pattern.

**Rewrite, do not delete.** The behaviour those lines guard still matters; only its mechanism changed.

- [ ] **Step 3: Verify all three states**

Toggle through the cycle on the showcase. `system` must follow an OS change live, without a reload. Both showcase panels keep working — the forced-dark panel is independent of the global theme.

- [ ] **Step 4: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/v2/theme-toggle.tsx components/v2/v2-header-search-theme.test.ts
git commit -m "feat(theme): three-state theme toggle on next-themes"
```

---

# Phase C — The night-sea palette (T-031b)

Branch: `feature/t034-c-night-sea`.

## Task 10: Derive and measure the palette

**Files:**

- Create: `lib/theme/contrast.ts`, `lib/theme/contrast.test.ts`

The spec's illustrative hexes (`bg #0b1416`, `card #121e21`, …) are **a direction, not measured values**. Deriving and measuring them is this task; pasting them in is the single most likely way this work ships something wrong.

- [ ] **Step 1: Write a contrast helper and its test**

A pure function, unit-testable without a browser:

```ts
// lib/theme/contrast.ts
/** WCAG 2.x relative luminance for an sRGB hex. */
export function relativeLuminance(hex: string): number {
  /* … */
}
/** WCAG 2.x contrast ratio between two sRGB hexes, always ≥ 1. */
export function contrastRatio(a: string, b: string): number {
  /* … */
}
```

Test against published pairs: `#000000`/`#ffffff` is 21, `#ffffff`/`#ffffff` is 1, and one mid pair computed by hand. Assert to 2 decimal places.

- [ ] **Step 2: Derive the neutrals**

Work in OKLCH, in the `--color-accent` water-teal hue family (~202°), with low chroma so surfaces read as a cool field rather than a tint: page darkest, card a step up, muted above that, border above that. Keep the lightness steps even — an uneven ramp is what makes a dark UI look muddy.

- [ ] **Step 3: Measure every pair and record the table**

For each foreground/surface combination the system actually produces — body text on page, body text on card, muted text on card, border against card, each semantic token against page and card, and each semantic token's own foreground on top of it — compute the ratio and require **4.5:1 for normal text** and **3:1 for graphical objects**.

Write the table into `app/globals.css` beside the values, in the style the light palette already uses (see the `--color-success` and `--game-hover-edge` comments). A number without its measurement is how the next person reintroduces a failure.

- [ ] **Step 4: Commit the helper**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add lib/theme/contrast.ts lib/theme/contrast.test.ts
git commit -m "feat(theme): add a WCAG contrast helper for palette derivation"
```

## Task 11: Write the `.dark` block

**Files:**

- Modify: `app/globals.css`
- Modify: `docs/design.md`

- [ ] **Step 1: Replace the neutrals**

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring` take the measured values from Task 10. `--primary`, `--secondary` and `--accent` keep the hues T-018 measured — only neutrals and surfaces move.

Replace the Task 5 placeholders for `--success`, `--warning`, `--info` and the chip pair with measured values.

- [ ] **Step 2: Verify on the showcase, every category**

Walk all seven categories in dark mode. Every specimen must be legible, on brand, and free of the muddy look that comes from an uneven lightness ramp. Check `…/geri-bildirim` most carefully — it carries the four semantic colours that were escaping until Phase A2.

Portalled specimens (Dialog, Sheet, Popover, Tooltip, DropdownMenu, toasts) need the global toggle, not the pair — `ThemePair` cannot force their theme. Open each one and check it.

- [ ] **Step 3: Check the V2 pages too**

The showcase proves the tokens; the pages prove the usage. Walk the home page, `/v2/turkiye`, `/v2/oyun` and `/v2/kitaplar` in dark mode. Anything still wrong here is a component or page binding to something other than a bridge token — the `token-binding` tripwire covers `components/ui` and `components/patterns`, not pages.

Known and out of scope: the categorical accent system in 34 V2 files (T-031c) and map surfaces (T-031d). Note what you see; do not fix it here.

- [ ] **Step 4: Rewrite the dark-mode section of `docs/design.md`**

It currently describes V1 staying light and V2 escaping tokens — both obsolete. State the new mechanism, the palette's character, and the rule the tripwire enforces.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add app/globals.css docs/design.md
git commit -m "feat(theme): the night-sea dark palette"
```

---

# Phase D — Components

Branch: one per task group, `feature/t034-d-<group>`.

**Every task in this phase follows the same shape.** It is written out once here rather than repeated twenty times:

1. Generate or write the component.
2. If generated by `shadcn add`, **read the output before committing it**. The CLI emits raw `oklch` values and its own class names; rebind every colour to a bridge token. `CLAUDE.md` warns about this and `token-binding.test.ts` enforces it.
3. Apply Terra's character — **load the `frontend-design` skill first**, and remember `docs/design.md` overrides it. Concretely: `--radius` family rather than shadcn's defaults, `font-heading` (Fraunces) on headings, the site's `:focus-visible` treatment (3px `--color-accent`, 2px offset), transitions that respect `prefers-reduced-motion` (already global).
4. Write the structure test: no escape, no raw palette, no `dark:`, plus the component's own accessibility contract.
5. Add its `<Specimen>` to the right category file, exercising **every** variant and state — including disabled, loading, error and empty where they exist.
6. Check it at 320, 360, 390 px and desktop in both themes.
7. `pnpm typecheck && pnpm lint && pnpm test`, then commit.

## Task 12: `Separator`, `Spinner`, `Progress`

```bash
pnpm dlx shadcn@latest add separator progress
```

`Spinner` has no registry entry — write it, reusing the `Loader2` + `animate-spin` idiom already in `button.tsx`, with `role="status"` and an `aria-label` so it announces.

`Progress`: both determinate and indeterminate. Determinate carries `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`; indeterminate omits `aria-valuenow` rather than sending `0`, which would claim no progress rather than unknown progress.

`Separator`: horizontal and vertical, `role="separator"`, `aria-orientation`, and `decorative` for the 24 hand-rolled dividers that carry no semantic meaning.

## Task 13: `Tooltip`, `Popover`

```bash
pnpm dlx shadcn@latest add tooltip popover
```

These close the `title=` gap in eight files. The contract is the point: reachable by keyboard focus, dismissible with Escape, and never the only carrier of information — `docs/design.md`'s "never encode meaning by colour alone" generalises to hover.

Both portal, so their specimens pass `portals` to `Specimen`.

## Task 14: `Breadcrumb`, `Pagination`

```bash
pnpm dlx shadcn@latest add breadcrumb pagination
```

`Breadcrumb` replaces 27 hand-rolled copies. Keep the `<nav aria-label="Breadcrumb">` wrapper and the `<ol>` those files already use, and give the current page `aria-current="page"`. The list needs an explicit `role="list"` if its markers are removed — `app/globals.css` documents why at length: Safari and VoiceOver drop list semantics from a markerless list, so "list, 3 items" disappears.

`Pagination`: previous/next plus numbered pages, with `aria-current="page"` on the active one and real `<a>` elements so middle-click and open-in-new-tab work.

## Task 15: `Typography` and `Kbd`

**Files:** `components/patterns/typography.tsx`

The heading scale, `Prose` for editorial blocks, and `Kbd` for the Ctrl+K hints three files draw by hand.

`docs/design.md` owns the scale: Fraunces headings, Nunito Sans body at 16px/1.6, `h1` `clamp(1.9rem, 1.2rem + 2.6vw, 2.6rem)`, `h2` `clamp(1.4rem, 1rem + 1.4vw, 1.8rem)` in primary-dark. Reproduce it, do not reinvent it — and note that the 1.9rem `h1` floor is documented as inviolable.

`Prose` should absorb what `components/v2/v2-rich-prose.tsx` does; check it first and either wrap it or fold it in rather than shipping a second prose renderer.

## Task 16: `StatTile` and `MetricValue`

**Files:** `components/patterns/stat-tile.tsx`, `components/patterns/metric-value.tsx`

`StatTile` is the 48-file pattern: a label, a large number, an optional unit, an optional hint. It composes `MetricValue` rather than formatting numbers itself.

`MetricValue` is the one with a contract worth protecting:

```ts
interface MetricValueProps {
  readonly value: number | null | undefined;
  readonly unit?: string;
  readonly precision?: number;
  /**
   * What to render when there is no reading. REQUIRED — there is no default that is safe.
   * T-024 shipped a page promising live hourly telemetry over data that was not there; the
   * fix was per-page copy conditioning, which works until the next page forgets. Making this
   * required moves the guarantee into the type: a caller cannot fail to decide.
   */
  readonly absent: { readonly label: string; readonly hint?: string };
}
```

When `value` is `null` or `undefined`, render `absent.label` as muted text. **Never `0`, and never a bare dash** — a dash occupies the same slot a number would and reads as a measurement. Its test asserts exactly that: given `null`, the output contains the label and does not contain `0` or `—`.

Numbers format through `Intl.NumberFormat` with the active locale, not string concatenation — Turkish uses `,` as the decimal separator and the site is bilingual.

## Task 17: `EmptyState` and `Callout`

**Files:** `components/patterns/empty-state.tsx`, `components/patterns/callout.tsx`

`EmptyState`: icon or illustration slot, heading, explanation, optional action. Ten files need it.

`Callout` is an **editorial aside** and is deliberately not `Alert`. Variants `note | tip | caution | source`. It carries **no `role`** — nothing has gone wrong and nothing changed dynamically, so interrupting assistive technology would be wrong. `Alert` already resolves `role` to `alert` for destructive and `status` otherwise; `Callout` must not.

Its test asserts the absence: `expect(source).not.toMatch(/role="(alert|status)"/)`, with a comment explaining that this is the boundary, not an oversight.

## Task 18: `FormField`

**Files:** `components/patterns/form-field.tsx`

Label, control, helper text, error message, disabled — wired so the control gets `aria-invalid` and an `aria-describedby` pointing at whichever of helper and error is present.

**This supersedes `V2TextField` / `V2FormErrorRegion`**, which T-032's plan (Task 1) creates standalone for the auth ports. Whichever task runs second consumes what the first produced rather than building a second set. If T-034 lands first, T-032's Task 1 is deleted and its cards import `FormField`; if T-032 lands first, this task absorbs those two components and updates their three call sites.

## Task 19: `MapAttribution` and `MapLegend`

**Files:** `components/patterns/map-attribution.tsx`, `components/patterns/map-legend.tsx`

`MapAttribution` closes a licence gap, not a style gap: none of V2's seven map components carries attribution, `docs/design.md` requires it beside every map, and ODbL requires it on derived maps. Default copy "© OpenStreetMap katkıcıları, ODbL"; the EN route serves "contributors" (see `app/maps/tr-provinces.en.svg/route.ts`, which already makes this distinction).

Mount it in all seven: `v2-turkey-map-explorer`, `v2-world-map-explorer`, `v2-marine-map-explorer`, `v2-interactive-map-preview`, `v2-province-locator-map`, `v2-region-locator-map`, `v2-continent-locator-map`. A test asserts every file matching `components/v2/v2-*map*.tsx` imports it — the same tripwire shape `components/map/locator-attribution.test.ts` used before, ported so the guarantee survives T-032 deleting that directory.

`MapLegend`: classed (sequential bins with stated breaks) and categorical variants. `docs/design.md` requires a legend on every classed map and that it states its breaks; the component makes the breaks a required prop so an unlabelled classed map cannot be built.

## Task 20: `Tabs` variants, `Table` extensions, `Select` multi

Three extensions, each a separate commit.

`Tabs` has no `cva` at all today, so this adds the variant layer plus `line` and `pills`.

`Table` gains a sorting affordance (a real `<button>` inside `<th>` with `aria-sort` on the header), row selection, and the `overflow-x: auto` wrapper `docs/design.md` mandates so a wide table scrolls inside its own container rather than the page body.

`Select` gains multi-select. `custom-select.tsx` is already searchable and 279 lines; extend it rather than adding a third select.

## Task 21: Re-enable the coverage assertion and close out

- [ ] **Step 1: Re-enable the disabled assertion**

Uncomment "every listed component exists on disk" in `components/showcase/registry.test.ts` (disabled in Task 4) and run the suite. It must pass — if a name is still missing, that component was never built and the registry is telling the truth.

- [ ] **Step 2: Run every tripwire**

```bash
pnpm vitest run components/showcase/registry.test.ts \
  components/ui/token-binding.test.ts \
  lib/theme/bridge-tokens.test.ts
```

- [ ] **Step 3: Update `docs/design.md`**

The components section should describe the finished system: the two directories and why they are separate, the full component list, the `Alert` versus `Callout` boundary, `MetricValue`'s required `absent`, and the showcase's own URL.

Record the known wart from Task 6: `Button`'s `emerald`, `sky`, `teal` and `amber` are colour-named variants in an otherwise semantic set, kept because 34 files call them.

- [ ] **Step 4: Full gate and PR**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Target `dev`, never `main`.

---

## Self-Review

**Spec coverage.** §2's sequence → Phases A, A2, B, C, D. §3's inventory: breadcrumb → Task 14; stat-number → Task 16; divider → Task 12; empty-state → Task 17; `title=` → Task 13; legend → Task 19; Ctrl+K → Task 15; the 44 escapes → Tasks 5–7; the attribution gap → Task 19. §4's fifteen new → Tasks 12–19; the six rebound → Tasks 6–7; the three extended → Task 20; the six dropped appear nowhere, correctly. §5's two boundaries → Task 17 (`Callout` role absence) and Task 16 (`MetricValue.absent`). §6's directory split → the File Structure table and Phase D's preamble. §7's showcase, `ThemePair`, portal limitation and tripwire → Tasks 1–4. §8's B and C → Tasks 8–11. §9's testing → the per-task tests plus the three tripwires. No gap found.

**Placeholders.** None. Task 10 Step 1 shows `/* … */` inside a signature sketch, which is a deliberate elision of a well-known formula (WCAG relative luminance) whose test in the same step pins the behaviour exactly — not an instruction to figure something out later.

**Type consistency.** `ThemePair({ children, portals })` (Task 1) is consumed by `Specimen` (Task 2) and by Phase C's verification steps under the same prop name. `CATEGORIES` and `EXEMPT_FILES` (Task 2) are read by the routes (Task 3) and the coverage test (Task 4). The bridge tokens declared in Task 5 are exactly the ones Tasks 6 and 7 bind to (`bg-success`, `text-info`, `bg-warning`, `bg-chip`) and Task 11 replaces. `MetricValueProps.absent` (Task 16) matches the spec §5 signature field for field.

**One cross-plan collision, resolved explicitly.** T-032's plan Task 1 creates `V2TextField`/`V2FormErrorRegion` for the auth ports; this plan's Task 18 creates `FormField` for the same job. Task 18 states the rule for whichever lands second, so the two plans cannot both ship a form-field abstraction.

**Two things this plan deliberately does not do.** It does not rename `Button`'s colour-named variants, and it does not touch the categorical accent system in 34 V2 files (T-031c) or map surfaces (T-031d). Both are noted where a reader would otherwise wonder.
