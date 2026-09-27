# design-sync notes — cografya_web → claude.ai/design

- **Shape: package, synth entry.** The web is a Next.js app with no `dist/`. The public surface is
  `.design-sync/entry.ts` (re-exports of `components/ui/*` and `components/patterns/*`), and every
  component is enumerated in `cfg.componentSrcMap` because the app ships no `.d.ts` tree.
- **Left out on purpose** (need the Next runtime): `Breadcrumbs`/`BreadcrumbsNav` (next-intl
  navigation), `MapAttribution` and `page-skeleton` (next-intl translations), `FaqSection`
  (`server-only` JSON-LD), `Toaster` (next-themes).
- **H1/H2/H3/H4 have no cards**: the converter's `isComponentName` treats all-caps names as
  constants. They still ship in the bundle (`window.CografyaGurmesi.H1`) and conventions.md names
  them. Not worth a `dts.mjs` fork.
- **CSS is compiled, not scraped.** Run `cfg.buildCmd` (`node .design-sync/build-css.mjs`) BEFORE
  every `package-build.mjs`: it compiles `.design-sync/ds.css` (= `app/globals.css` + the next/font
  variables) with the site's Tailwind v4 PostCSS plugin into `.design-sync/ds.compiled.css`
  (`cfg.cssEntry`). Tailwind scans the repo like the Next build, so previews' classes are included
  only if the CSS is rebuilt after they change.
- **Fonts** come from a Google Fonts `@import` in `ds.css` (Fraunces, Nunito Sans) — validate prints
  `[FONT_REMOTE]`, expected. The app itself self-hosts them via next/font.
- **Previews** are ported from the site's own `/design-system` specimens
  (`components/showcase/specimens/*.tsx`). Overlays open with `defaultOpen` and
  `cardMode: single`; CustomSelect has no open prop, so its preview clicks its own trigger on mount.
- **Playwright**: validate/capture need `playwright@1.62.1` in `.ds-sync/` (matches the cached
  chromium-1234; `cd .ds-sync && npm i playwright@1.62.1`).
- **Props come from a `dts.mjs` fork** (`cfg.libOverrides`). Upstream only reads a shipped `.d.ts`
  tree; this repo has none, and its `lib/` dir fooled `findTypesRoot`, so the first sync shipped
  every `<Name>.d.ts` as `[key: string]: unknown`. The fork points ts-morph at `.design-sync/entry.ts`
  with the repo tsconfig (`@/*` paths) and reads the real `.tsx` sources. It imports `ts-morph`
  bare: on a fresh clone run `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules`.
- **Guidelines**: only `docs/copy.md` (`cfg.guidelinesGlob`); the other docs are engineering notes.

## Known render warns

- none open (Progress → single card, StatGrid → column, per `[GRID_OVERFLOW]` advice).

## Re-sync risks

- `.design-sync/overrides/dts.mjs` is a fork of the converter's `lib/dts.mjs`: diff it against the
  freshly staged `.ds-sync/lib/dts.mjs` on every re-sync and port upstream changes. Its bytes key
  every component's grade, so any edit (or reformat) re-verifies all 29; `.prettierignore` covers it.
- Commit sync inputs BEFORE uploading, or upload after lint-staged has run: a Prettier pass on a
  preview `.tsx` after upload makes the next sync re-capture that card (formatting only).
- `ds.compiled.css` is generated from the live `app/globals.css`; a token rename there changes every
  card without touching a preview — conventions.md names tokens and must be re-validated.
- `componentSrcMap` and `entry.ts` are hand lists: a new `components/ui/*` file is NOT picked up
  until both are edited.
- The CustomSelect preview depends on the trigger carrying the passed `id`
  (`components/ui/custom-select.tsx` `selectId = id || reactId`).
- Only the light theme was graded; dark mode relies on the `.dark` token block.
