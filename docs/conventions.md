# cografya_web — conventions

Read before writing a component, a test, or a commit.

## Code style

- Prettier: double quotes, semicolons, trailing commas, width 100. ESLint: `eslint-config-next`
  (core-web-vitals + TS) with prettier last. `pnpm lint` is plain `eslint`.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `paths { "@/*": ["./*"] }`, bundler
  resolution, `allowImportingTsExtensions`. `.mjs` scripts are not typechecked.
- Server code says `import "server-only"` at the top. Client components say `"use client"`
  and never import `lib/env.server.ts`, `lib/api/client.ts` or `lib/*/transport.server.ts`.
- `cn()` from `lib/utils.ts` for class merging. `lucide-react` for icons. Toasts via
  `sonner` (`components/ui/sonner.tsx`).
- Comments explain a measured reason. Do not cite `ENGINEERING.md`, `CONVENTIONS.md`,
  `DEC ...` ids or reviewer tags; those documents are gone (`../CLAUDE.md`).

## Building a V2 page

1. Add TR + EN entries to `pathnames` in `i18n/routing.ts`.
2. `app/[locale]/v2/<route>/page.tsx`: server component, `setRequestLocale(locale)`,
   `generateMetadata` via `buildMetadata()`, data via `apiGet` or a `lib/<domain>` loader,
   `notFound()` on unknown slug.
3. Presentational pieces in `components/v2/v2-<name>.tsx`; interactive parts as small
   `"use client"` islands. Heavy widgets (maps, games) via `dynamic(..., { ssr: false })`
   inside a fixed-size box.
4. Use `components/ui/*` primitives and Tailwind theme keys (`bg-primary`, `text-muted-
foreground`, `border-border`, `font-heading`). Colours per `docs/design.md`.
5. Links: `Link` from `@/i18n/navigation`; button-looking links use `buttonVariants`.
6. Co-locate a `*.test.tsx` structure test under `components/v2/` if the component has
   branching or a11y-relevant structure (see existing `*.structure.test.tsx`).

## Tests (vitest, node environment)

- Co-located next to source: `foo.test.ts`, or a qualified suffix (`*.structure.test.tsx`,
  `*.contract.test.ts`, `*.<scope>.test.ts`). No `__tests__` folders.
- Included globs: `lib/**`, `components/**`, `tools/**`. Nothing under `app/` runs.
- No jsdom; component tests render with React and assert on the tree/markup. `server-only`
  is stubbed via `test/stubs/server-only.ts`; `next-intl` is inlined so `getPathname` is real.
- Fixtures: `test/fixtures/{marine,books}`. Do not add network calls to tests.
- Playwright is a library here, not a runner: no `playwright.config`, no e2e suite. Ad-hoc
  audits live in `scripts/` and `tools/dev-fixtures/`; do not wire them into CI.

## Generated artifacts

| File                                   | Regenerate                                  | Gate                        |
| -------------------------------------- | ------------------------------------------- | --------------------------- |
| `lib/api/schema.ts`                    | `pnpm codegen` (after copying the API spec) | `codegen:check`             |
| `lib/map/tr-provinces.generated.ts`    | `pnpm generate:map`                         | `generate:map:check`        |
| `lib/map/world-countries.generated.ts` | `pnpm generate:world-map`                   | `generate:world-map:check`  |
| `lib/map/tr-inland-water.generated.ts` | `pnpm generate:water`                       | `generate:water:check`      |
| `lib/map/tr-context.generated.ts`      | `pnpm generate:tr-context`                  | `generate:tr-context:check` |

Every entry must be in `.prettierignore` AND `eslint.config.mjs` `globalIgnores`, otherwise
lint-staged rewrites it on commit and the gate goes red on an untouched file.

## Git

- Conventional Commits, scope = surface (`feat(v2/header):`, `fix(deploy):`, `feat(v2/oyun):`).
- Pre-commit: `eslint --fix` + `prettier --write` on staged `ts/tsx`, prettier on
  json/css/md/yml, then a project-wide `tsc --noEmit`. Commit-msg: commitlint.
- `feature/*` → `dev` squash PR; CI must be green. `dev` → `main` deploys.
- Screenshot dirs (`*_shots/`, `*_verified/`), `.tmp-scratch/`, `.jrc-cache/` and
  `inspect_deprem.js` are gitignored scratch; do not reference them from tracked code.
