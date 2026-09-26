# Fullscreen on the earthquake and sea maps — Implementation Plan (T-119)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/deprem` and `/deniz` get T-118's fullscreen button, a compact selection card in
fullscreen, and a fullscreen credit that also names the data drawn on the map.

**Architecture:** Reuse `useLandscapeMode`, `MapFullscreenToggle`, `MapRotateHint`,
`fullscreenCardStyle` and `MapSelectionCard`. New: a fitted-map layout (the box keeps its viewBox
shape inside a `container-type: size` stage), a `dataCredit` slot on `MapAttribution` shown only in
fullscreen, and two small credit components (AFAD from the API payload, sea data from the
catalogue).

**Tech Stack:** Next.js App Router, React 19, next-intl, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-t119-quake-marine-fullscreen-design.md`

## Global Constraints

- The page view of both maps does not change, except `/deniz`'s basin chip moving right of the
  toggle.
- The AFAD strings come from the API payload, never hard-coded; Turkish-only strings carry
  `lang="tr"`.
- No zoom or pan added.
- Copy in `messages/{tr,en}.json`; Turkish copy follows `docs/copy.md`.

## Review Focus

- An earthquake or sea point with no province: the card renders with no explore link (task 1).
- `/deprem` closing the card must not clear the selection (the spotlight would say "no match");
  selecting any event reopens it (task 4, browser check).
- A tall portrait fullscreen: the map stays in shape and centred, labels stay placed (task 3 test
  pins the fitted width; browser check at 390×844).
- Meta fetch failed on `/deprem` (`earthquakeMeta === null`): no data credit line, no crash
  (task 4: prop is optional).
- The basin chip and toggle overlap from `sm` (task 5, browser check at 640 px).

---

### Task 1: `MapSelectionCard` without an explore link

**Files:** Modify `components/v2/map-selection-card.tsx`; Test `components/v2/map-selection-card.test.tsx`

- [ ] Test: render with no `href`/`exploreLabel`; expect no `<a`, the close button still there.
- [ ] Make `href` and `exploreLabel` optional; render the `Link` only when `href` is set.
- [ ] `pnpm vitest run components/v2/map-selection-card.test.tsx`, commit
      `feat(map): selection card without an explore link (T-119)`.

### Task 2: Data credit in the fullscreen credit

**Files:** Modify `components/patterns/map-attribution.tsx`,
`components/earthquake/earthquake-attribution.tsx`, `messages/{tr,en}.json`; Create
`components/marine/marine-map-credit.tsx`; Test `components/patterns/map-attribution-fullscreen.test.tsx`

**Produces:** `MapAttribution({ dataCredit?: ReactNode })`; `EarthquakeMapCredit({ attributions })`
(sync, server-safe); `MarineMapCredit()` (client-safe, `useTranslations("Map")`);
`Map.attributionMarine` = `"Deniz verileri: <sources>Copernicus Marine Service ve ECMWF</sources>"`
/ `"Sea data: <sources>Copernicus Marine Service and ECMWF</sources>"`.

- [ ] Test: fullscreen render with `dataCredit={<span>X-DATA</span>}` contains `X-DATA` inside the
      panel; page render with the same prop does not.
- [ ] `MapAttribution`: `if (fullscreen) return <FullscreenCredit>{lines}{" "}{dataCredit}</FullscreenCredit>;`
- [ ] `EarthquakeMapCredit`: one `<span lang="tr">` per attribution:
      `{attribution.requiredNoticeTr}{attribution.regulationReference !== "" && \` (${attribution.regulationReference})\`}`.
- [ ] `MarineMapCredit`: `<span>{t.rich("attributionMarine", { sources: (c) => <Link href={MARINE_SOURCES_ANCHOR} className="underline hover:no-underline">{c}</Link> })}</span>`.
- [ ] Run the attribution tests (`components/patterns`, `components/earthquake`,
      `components/attribution-not-optional.test.ts`), commit.

### Task 3: Fitted map layout

**Files:** Modify `components/v2/map-fullscreen-controls.tsx`; Test `components/v2/map-fullscreen-controls.test.ts`

**Produces:** `FULLSCREEN_FITTED_STAGE: CSSProperties` (`FULLSCREEN_STAGE` + `position: relative`,
`containerType: "size"`, `background: "var(--map-plate)"`), `fittedMapBoxStyle(width, height)`
→ `{ flex: "none", width: \`min(100cqw, calc(100cqh * ${width} / ${height}))\`, aspectRatio: \`${width} / ${height}\`, margin: "auto", borderRadius: 0, borderWidth: 0 }`.

- [ ] Test the two exports' values; implement; run; commit.

### Task 4: `/deprem`

**Files:** Modify `components/v2/v2-earthquake-explorer.tsx`, `app/[locale]/(site)/deprem/page.tsx`;
Test `components/v2/v2-atlas-fullscreen.test.ts`, `components/v2/v2-fullscreen-credit.test.ts`

- [ ] Tests: add the explorer to the atlas surfaces (wheel assertion only for surfaces flagged
      `wheel: true`); credit test lists it and asserts `dataCredit` is passed on both new surfaces.
- [ ] Explorer: `figureRef` + `useLandscapeMode`; figure `relative`, `FULLSCREEN_FIGURE`; new stage
      `div.relative` around the map box with `FULLSCREEN_FITTED_STAGE`; box `fittedMapBoxStyle(1270, 580)`;
      toggle in the box (label overlay); rotate hint in the stage; `MapSelectionCard` in the stage only
      in fullscreen; `cardOpen` state (true on every selection, false on close); `dataCredit` prop to
      `MapAttribution`. Context labels get `blocked` from the overlays, as on `/deniz`.
- [ ] Page: `DepremExplorer` passes `dataCredit={earthquakeMeta && <EarthquakeMapCredit attributions={earthquakeMeta.attributions} />}`.
- [ ] Run tests, typecheck, commit.

### Task 5: `/deniz`

**Files:** Modify `components/v2/v2-marine-map-explorer.tsx`; Tests as task 4.

- [ ] Same wiring; the existing `div.relative` is the stage; the large station card renders only
      outside fullscreen; basin chip `top-3 left-16`; toggle joins `chipOverlays`;
      `dataCredit={<MarineMapCredit />}`.
- [ ] Run tests, typecheck, commit.

### Task 6: Verify and hand off

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [ ] Playwright: both pages, desktop 1280×800, 390×844, 844×390, 360, 320; light/dark; Esc;
      Fullscreen API removed (CSS fallback + rotate hint); card open/close; credit collapses to ⓘ and
      reopens with the data line.
- [ ] `pnpm sweep:overflow -- --filter=/deprem` and `--filter=/deniz`.
- [ ] Push, PR into `dev`, move T-119 to `TASKS-DONE.md`.
