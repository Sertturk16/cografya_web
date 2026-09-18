# cografya_web

Frontend of the **Coğrafya platform**, a free, SEO-first geography education site in Turkish
with an English shell. Built with **Next.js 16 (App Router)**, **React 19** and TypeScript in
`strict` mode. The API lives in the separate
[`cografya_api`](https://github.com/Sertturk16/cografya_api) repo.

Written and maintained by [Ömer Can Serttürk](https://github.com/Sertturk16). Working title;
the brand and domain are not final.

## Stack

- Next.js 16 App Router, React 19, TypeScript (`strict` + `noUncheckedIndexedAccess`)
- Tailwind CSS v4 (CSS-first config in `app/globals.css`), shadcn `base-nova` on Base UI
- next-intl 4 (TR at `/`, EN at `/en`, localized pathnames)
- zod env validation (`lib/env.ts` public, `lib/env.server.ts` server-only)
- vitest (node environment), ESLint flat config, Prettier, husky + lint-staged + commitlint
- Node 24 (`.nvmrc`), pnpm (pinned via `packageManager`)

## Getting started

```bash
pnpm install                 # deps + git hooks
cp .env.example .env.local   # set API_BASE_URL (default http://localhost:3001)
pnpm dev                     # http://localhost:3000/v2
```

The site expects the API running on port 3001 (see the API repo's README). Without it,
content pages render their empty states.

## Scripts

| Script                                                                                | What it does                                                                            |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`                                              | Dev server, production build (standalone), serve                                        |
| `pnpm typecheck`                                                                      | `tsc --noEmit`                                                                          |
| `pnpm lint`                                                                           | ESLint                                                                                  |
| `pnpm test` / `pnpm test:watch`                                                       | vitest                                                                                  |
| `pnpm format` / `pnpm format:check`                                                   | Prettier                                                                                |
| `pnpm codegen`                                                                        | `openapi/openapi.json` → `lib/api/schema.ts` (after copying the spec from the API repo) |
| `pnpm codegen:check`                                                                  | fails if the committed `schema.ts` is stale                                             |
| `pnpm generate:map` / `generate:world-map` / `generate:water` / `generate:tr-context` | rebuild the committed SVG map artifacts in `lib/map/` from `data/*.geojson`             |
| `pnpm generate:*:check`                                                               | drift gates for the four artifacts above                                                |
| `pnpm sweep:overflow`                                                                 | Playwright horizontal-overflow check over a running server (see `docs/conventions.md`)  |

## Layout

- `app/[locale]/` — the root layout and every page. `v2/**` is the current UI (Tailwind +
  shadcn); the routes outside `v2/` are the frozen V1 surface (CSS Modules).
- `app/api/**` — BFF route handlers that proxy authenticated and mutating calls to the API.
- `components/ui/` shadcn primitives · `components/v2/` V2 surface · `components/{game,map,
tools,marine,book,...}` feature components.
- `lib/api/` typed API client (`client.ts` is the only read path; `schema.ts` is generated).
- `lib/seo/` metadata, hreflang, JSON-LD, sitemap builders · `lib/map/` projection, zoom-pan,
  generated geometry · `lib/<domain>/transport.server.ts` server-side transports.
- `i18n/` routing, request config, navigation · `messages/{tr,en}.json`.
- `data/` build-time GeoJSON with its provenance ledger (`data/README.md`) · `scripts/`
  artifact generators and ad-hoc Playwright audits.
- `docs/` — `architecture.md`, `conventions.md`, `design.md` (Terra design system and
  data-viz colour rules), `public-kitaplar.md`.

## Environment

Validated at boot by zod; an invalid value aborts startup.

- `NEXT_PUBLIC_SITE_URL` — absolute site origin, drives canonicals, hreflang and the sitemap.
- `API_BASE_URL` — server-only API origin (`http://api:3001` in production compose).
- `INTERNAL_REQUEST_TOKEN` — server-only; exempts server-side GETs from the API throttle.
- `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION` — declared, not wired yet.

## Conventions

Conventional Commits (commitlint), `feature/*` → `dev` squash PR, `dev` → `main` deploys via
GitHub Actions to the production host. CI on every PR: typecheck, lint, five drift gates,
tests, build. Details in `docs/conventions.md`.

## License

MIT — see [LICENSE](LICENSE).
