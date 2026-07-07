# cografya_web

Frontend for the **Coğrafya platform** — an SEO-first, free geography education site
(TR + EN). Built with **Next.js (App Router)** and TypeScript in `strict` mode.

> Working title. The brand/domain is not final yet (provisional: "Terraloji").
> This is the standalone web repo; the API lives in a separate repo (`cografya_api`).

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (`strict` + `noUncheckedIndexedAccess`)
- **Node 24** (pinned in `.nvmrc`) · **pnpm** (pinned via `packageManager`)
- **next-intl 4** — i18n routing (TR `/`, EN `/en`) + localized pathnames
- **zod** — boot-time env validation (`lib/env.ts`)
- **ESLint** (flat config, from `eslint-config-next`) + **Prettier**
- **husky** + **lint-staged** + **commitlint** (Conventional Commits)

## Prerequisites

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm (`corepack enable` or install per the version in `package.json`)

## Getting started

```bash
pnpm install      # installs deps + sets up git hooks (husky)
pnpm dev          # start the dev server at http://localhost:3000
```

## Scripts

| Script              | What it does               |
| ------------------- | -------------------------- |
| `pnpm dev`          | Start the local dev server |
| `pnpm build`        | Production build           |
| `pnpm start`        | Serve the production build |
| `pnpm lint`         | ESLint over the project    |
| `pnpm typecheck`    | `tsc --noEmit`             |
| `pnpm format`       | Prettier write             |
| `pnpm format:check` | Prettier check (no writes) |

## Conventions

- **Commits:** Conventional Commits, enforced by commitlint on the `commit-msg` hook.
- **Pre-commit:** `lint-staged` runs `eslint --fix` + Prettier on staged files and a
  project-wide `tsc --noEmit`.
- **Branches:** `feature/* → dev` (squash PR). `main` is a placeholder until the
  hosting / prod-promotion model is decided.
- **CI (GitHub Actions):** a `typecheck-and-lint` job and a `build` job run on every PR
  to `dev`/`main`. No deploy job yet — hosting is undecided.

## Environment

Copy `.env.example` to `.env.local`. Vars are validated at boot by a zod schema
(`lib/env.ts`) — no unvalidated `process.env` reads.

- `NEXT_PUBLIC_SITE_URL` — absolute site origin. Drives `metadataBase` + canonical /
  hreflang / sitemap URLs. Defaults to `http://localhost:3000`; **must** be the real
  domain in production.
- `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION` — declared, not wired yet.

## Internationalization (`next-intl`)

- Sub-path routing: **TR at `/`** (default, unprefixed), **EN at `/en`**.
  `localePrefix: "as-needed"` (never `"never"` — distinct crawlable URLs per locale).
  `localeDetection: false` — no Accept-Language redirects; URLs are deterministic for
  crawlers and hreflang carries the language mapping.
- **Localized pathnames** (static segments): `/il` ↔ `/en/province`,
  `/iller` ↔ `/en/provinces`, `/hakkimizda` ↔ `/en/about`. Defined once in
  `i18n/routing.ts`.
- **Localized slugs** (`slug_tr` / `slug_en`): the dynamic `[slug]` value is the
  per-locale slug supplied by the caller; resolution lives in the page + `lib/geo`.
- Config: `i18n/routing.ts` (routing + pathnames), `i18n/request.ts` (per-request
  messages), `i18n/navigation.ts` (`Link`/`getPathname`/…), `proxy.ts` (middleware —
  renamed from `middleware.ts` in Next 16). Messages: `messages/{tr,en}.json`.
  Faz-1 is TR-content; EN carries the translated chrome so `/en` is a valid shell.

## SEO surface

Central helpers keep every page uniform:

- `lib/seo/metadata.ts` — `buildMetadata()` builds the templated title/description,
  self-canonical, and **symmetric hreflang** (tr / en / x-default) from `getPathname`.
  `metadataBase` is set once in `app/[locale]/layout.tsx`.
- `lib/seo/json-ld.tsx` — server-rendered JSON-LD (`<JsonLd>` + typed builders:
  WebSite, Organization, BreadcrumbList, CollectionPage, AdministrativeArea).
- `app/sitemap.ts` — flat, hreflang-annotated urlset today; structured with per-hub
  entry builders so a hub can split to `generateSitemaps()` when it nears 50k URLs.
- `app/robots.ts` — allow-all + `Disallow: /api/` (de-indexing uses `noindex` meta,
  never Disallow) + sitemap/host.
- Unknown slug → `notFound()` (real 404, never a soft-200).

## Theme (Terra visual identity)

The locked "Terra" direction (terracotta / olive / water-teal + Fraunces / Nunito Sans)
lives as a **token layer** in `app/globals.css` (`:root` custom properties) — reference
`var(--token)` only; never hardcode brand hex elsewhere. Fonts load via `next/font`
(`lib/fonts.ts`, self-hosted, `latin` + `latin-ext` for Turkish glyphs) — **not** a
render-blocking Google Fonts `<link>`. Component styling uses CSS Modules.

## `next/image` conventions

No images ship yet. When they do: local images live in `/public` and always render
through `next/image` with explicit `width`/`height` (or `fill` + a fixed-size
container) to hold CLS < 0.1. Remote sources are allowlisted via `images.remotePatterns`
in `next.config.ts` (never the deprecated `images.domains`).

## Roadmap notes (scope guard)

PR-2w wired the i18n + SEO foundations + Terra theme on top of the PR-0w scaffold. The
`app/[locale]/il/[slug]` province pages currently render from a **placeholder routing
fixture** (`lib/geo/placeholder-provinces.ts`, names + slugs only, no geographic facts)
that exists solely to exercise the localized-slug pattern end to end. Real province data
arrives from the api repo (`cografya_api`, Deniz) — replace the fixture with the typed
API client then.
