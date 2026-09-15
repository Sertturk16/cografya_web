# cografya_web

Next.js 16 App Router, React 19, TypeScript `strict` + `noUncheckedIndexedAccess`, Tailwind v4
(CSS-first, no config file), shadcn `base-nova` on **Base UI** (no Radix anywhere), next-intl 4,
vitest (node env, no jsdom). Node 24, pnpm. Parent workspace rules: `../CLAUDE.md`.

Read on demand, not every session:

- `docs/architecture.md` — routing, V1/V2 split, API access path, SEO helpers, generated
  artifacts, known gaps. Read before adding a route, a fetch, or touching i18n/SEO.
- `docs/design.md` — Terra tokens, typography, dark mode state, a11y floor, data-viz colour
  doctrine, component patterns. Read before any visible UI change.
- `docs/conventions.md` — style, tests, commits, generated-file hygiene.
- `README.md` — human onboarding (setup, scripts, layout).

## Commands

```bash
pnpm dev                                  # http://localhost:3000/v2 (needs the API on :3001)
pnpm typecheck && pnpm lint && pnpm test  # gate before every commit
pnpm build                                # needs the API on :3001 (prerenders flags + district routes)
pnpm codegen                              # after replacing openapi/openapi.json from the API repo
pnpm generate:map | generate:world-map | generate:water | generate:tr-context   # map artifacts
```

## Hard rules

- **V2 only.** New work lives under `app/[locale]/v2/**` and `components/v2/**`, styled with
  Tailwind + `components/ui/*`. V1 routes, `components/site-*`, and every `*.module.css` are
  frozen. Do not touch them, do not port V1 patterns into V2.
- `Button` has no `asChild`. A link that looks like a button is
  `<Link className={cn(buttonVariants({ variant, size }))}>`. Do not add `asChild` or a Slot.
- Href typing: never `as any`. When next-intl's typed `Link` rejects a computed href, use
  `as unknown as React.ComponentProps<typeof Link>["href"]`.
- Import `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from
  `@/i18n/navigation`, never from `next/link` or `next/navigation`.
- Every route needs an entry in `i18n/routing.ts` `pathnames` (TR and EN).
- Reads from the API go through `apiGet` in `lib/api/client.ts` (server-only, ISR 3600 s,
  attaches the internal token). Mutations and authenticated reads go through
  `lib/<domain>/transport.server.ts` behind `app/api/**/route.ts` BFF routes. No third path,
  no `fetch` to the API from client code.
- Types from the contract: alias `components["schemas"][...]` once in `lib/api/types.ts`,
  never reference `schema.ts` shapes at call sites.
- Five committed generated files, never hand-edited: `lib/api/schema.ts` and
  `lib/map/{tr-provinces,world-countries,tr-inland-water,tr-context}.generated.ts`. Each has
  a CI drift gate. Each must be listed in BOTH `.prettierignore` and the ESLint
  `globalIgnores`.
- Colours: `var(--token)` from `app/globals.css` or the Tailwind theme keys (`bg-primary`,
  `text-muted-foreground`). No brand hex in components. Brand tokens never encode data on
  maps/charts (see `docs/design.md`).
- SEO on any indexable page: `generateMetadata` via `buildMetadata()`, unknown slug →
  `notFound()`, JSON-LD server-rendered via `lib/seo/json-ld.tsx`. De-index with
  `noindex`, never with robots `Disallow`.
- Anything under `public/` is served ahead of the router. Check for a route collision
  before adding a directory there (`docs/public-kitaplar.md`).
- `import "server-only"` guards are load-bearing; never import `lib/env.server.ts` or
  `lib/api/client.ts` from a client component.
- Tests are co-located `*.test.ts(x)` under `lib/`, `components/`, `tools/`. Vitest does
  not run anything under `app/`.
- Visible UI change: check 320, 360, 390 px and desktop, light and dark, before calling it
  done (Playwright MCP). Take a screenshot when the user asked for a visual fix.
- `/impeccable audit|critique|polish` and the `web-design-guidelines` skill are review
  aids; `docs/design.md` overrides them. Never `/impeccable init`.

## Done means

typecheck + lint + test green, `pnpm build` passes if you touched routing/SEO/config, the
relevant `generate:*:check` or `codegen:check` is green if you touched an input, and the
matching `pathnames` entry exists for any new route.
