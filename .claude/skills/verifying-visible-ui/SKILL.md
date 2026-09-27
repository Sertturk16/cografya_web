---
name: verifying-visible-ui
description: Use when a cografya_web change alters anything a visitor sees (a page, component, layout, spacing, colour, icon, dark-mode style or on-screen copy) and you are about to call it done, commit it, or open its PR.
---

# Verifying a visible UI change

`CLAUDE.md` (Hard rules: Visible UI change; Done means), `docs/conventions.md` (The overflow
sweep) and `docs/design.md` are the authority; where this file disagrees, they win.

## Steps

1. **A server for THIS tree.** `cografya-web-dev` serves :3000 from the workspace checkout;
   confirm the route answers 200 (`curl -s -o /dev/null -w '%{http_code}' localhost:3000/<path>`).
   Any other checkout: `pnpm dev -p <port>` there and pass `--base-url` below. The API must
   answer on :3001.
2. **Routes.** List every route the change reaches (a shared component such as the header or
   footer reaches all of them) and find the sweep ids covering them in
   `lib/overflow-sweep/routes.ts`. A new route gets an entry there.
3. **Overflow and screenshots, one run.**
   `pnpm sweep:overflow -- --filter=<id> --shots=<task>-<change>` must end green. It measures
   every width in both themes and saves a PNG per URL × width × theme in the workspace root's
   `.playwright-mcp/<task>-<change>/`. Signed-in pages need `SWEEP_AUTH_PASSWORD` (docs).
4. **Look.** Read the 320, 360, 390 and desktop PNGs, light and dark. Judge the change itself:
   alignment, wrapping, clipping, dark-mode contrast, touch-target size. A green sweep only
   proves nothing scrolls sideways. A tall page arrives shrunk; for detail, take an element
   screenshot with Playwright MCP (step 5).
5. **What a PNG cannot show** (focus ring, hover, an open menu, a route the sweep does not
   list): Playwright MCP at the widths that matter; save as `.playwright-mcp/<name>.png`
   (relative: it resolves from the workspace root).
6. **impeccable** `audit <route>` (root `CLAUDE.md`); fix its P0/P1 findings.

## Report

Routes checked, the sweep's summary line, the screenshot folder, and what you saw at each
width and theme. A step that could not run (no server, no API) is reported as not done, never
as passed.
