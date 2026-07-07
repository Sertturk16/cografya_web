# cografya_web

Frontend for the **Coğrafya platform** — an SEO-first, free geography education site
(TR + EN). Built with **Next.js (App Router)** and TypeScript in `strict` mode.

> Working title. The brand/domain is not final yet (provisional: "Terraloji").
> This is the standalone web repo; the API lives in a separate repo (`cografya_api`).

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (`strict` + `noUncheckedIndexedAccess`)
- **Node 24** (pinned in `.nvmrc`) · **pnpm** (pinned via `packageManager`)
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

Copy `.env.example` to `.env.local`. The analytics / Search Console placeholders
(`NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION`) are declared but not wired yet.

## Roadmap notes (scope guard)

This is the **PR-0w scaffold** — a bare Next.js shell only. The i18n routing
(`next-intl`, TR at `/`, EN at `/en`), the SEO surface (`sitemap.ts`, `robots.ts`,
metadata/hreflang/JSON-LD helpers), and the "Terra" visual-identity theme tokens are
intentionally deferred to **PR-2w**.
