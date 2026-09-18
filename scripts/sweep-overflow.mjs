// @ts-check
/**
 * Horizontal-overflow sweep. `pnpm sweep:overflow`.
 *
 * Asserts `document.documentElement.scrollWidth <= clientWidth` on a representative route
 * per shape, at 320/360/390/desktop, in both themes. Exits non-zero on any overflow and
 * names the route, the viewport, the theme, the pixel count and the offending elements.
 *
 * WHY A BROWSER, when the rest of the suite is node-env vitest: the three defects this
 * exists for are not in the JSX tree at any depth — two were CSS-Module declarations
 * (`climate.module.css`'s bare `min-width: 300px`, T-046; the ECMWF licence notice, T-038)
 * and one was a flex child's `shrink-0` (T-046, seven region routes). No source scanner can
 * see any of them. Every time one was caught, it was caught by exactly this comparison, and
 * every time, the comparison ran because a human remembered to run it. See
 * `lib/overflow-sweep/routes.ts` for the route list and the two rules that keep it honest.
 *
 *   pnpm sweep:overflow
 *   pnpm sweep:overflow -- --base-url=http://localhost:3000
 *   pnpm sweep:overflow -- --filter=istanbul --viewport=320
 *
 * POINT IT AT A PRODUCTION SERVER when you can (`pnpm build` then `pnpm start`): the
 * prerendered pages mean the sweep is not holding the API open for the length of the run,
 * which is where the recorded `ECONNRESET` flake on a random province or country page
 * lives. A `pnpm dev` server works and is what you will usually have; it is slower and it
 * re-fetches on every navigation, so `--base-url` defaults to :3000 either way and the
 * navigation step retries once before it calls a page dead.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { routing } from "../i18n/routing.ts";
import { formatFailure, formatSummary } from "../lib/overflow-sweep/report.ts";
import {
  SWEEP_THEMES,
  SWEEP_VIEWPORTS,
  buildSweepUrls,
  uncoveredPathnames,
} from "../lib/overflow-sweep/routes.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

/** `--name=value` / `--name value` / `--flag`. */
function parseArgs(argv) {
  /** @type {Record<string, string | true>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[arg.slice(2)] = next;
      i += 1;
    } else {
      out[arg.slice(2)] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const BASE_URL = String(
  args["base-url"] ?? process.env.SWEEP_BASE_URL ?? "http://localhost:3000",
).replace(/\/$/, "");
const JSON_OUT = resolve(ROOT, String(args.json ?? ".tmp-scratch/overflow-sweep.json"));
const FILTER = typeof args.filter === "string" ? args.filter : null;
const VIEWPORT_FILTER = typeof args.viewport === "string" ? args.viewport.split(",") : null;
const THEME_FILTER = typeof args.theme === "string" ? args.theme.split(",") : null;
const CONCURRENCY = Math.max(1, Number(args.concurrency ?? 4) || 4);

const NAV_TIMEOUT = 60_000;
const SETTLE_TIMEOUT = 8_000;
/** Let a late web font or a client island finish reflowing before measuring. */
const SETTLE_MS = 350;

/**
 * Runs in the page. Returns the document's scroll geometry and, when it overflows, the
 * elements whose right edge is responsible.
 *
 * Three exclusions, each load-bearing:
 *   - `position: fixed` boxes are laid out against the viewport and cannot grow the
 *     document's scroll width however far past the edge they sit (the dev overlay, toasts);
 *   - an element with any ancestor whose `overflow-x` is not `visible` is clipped by that
 *     ancestor, so it is not what the document is scrolling for — this is what keeps the
 *     deliberately `overflow-x: auto` tables and code blocks out of the report;
 *   - zero-size boxes, which are `<script>`, `<template>` and collapsed islands.
 */
const MEASURE = () => {
  const root = document.documentElement;
  const clientWidth = root.clientWidth;
  const scrollWidth = root.scrollWidth;
  /** @type {{ clientWidth: number, scrollWidth: number, elements: unknown[] }} */
  const result = { clientWidth, scrollWidth, elements: [] };
  if (scrollWidth <= clientWidth) return result;

  // Sub-pixel rounding: a 320.4px box on a 320px viewport is a rounding artefact, not a
  // defect. `scrollWidth` above is already integral, so this tolerance never hides a
  // failing page — it only decides which elements get named inside one.
  const limit = clientWidth + 0.5;

  const isClipped = (el) => {
    for (let a = el.parentElement; a && a !== root; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== "visible") return true;
    }
    return false;
  };

  const describe = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node && node !== document.body && depth < 4; depth += 1) {
      const raw = (node.getAttribute("class") || "").trim();
      const cls = raw ? `.${raw.split(/\s+/).slice(0, 4).join(".")}` : "";
      const id = node.id ? `#${node.id}` : "";
      parts.unshift(`${node.tagName.toLowerCase()}${id}${cls}`.slice(0, 120));
      node = node.parentElement;
    }
    return parts.join(" > ");
  };

  const hintsFor = (s) => {
    const h = {};
    if (s.minWidth !== "0px" && s.minWidth !== "auto") h["min-width"] = s.minWidth;
    h.width = s.width;
    if (s.flexShrink !== "1") h["flex-shrink"] = s.flexShrink;
    if (s.flexBasis !== "auto") h["flex-basis"] = s.flexBasis;
    if (s.whiteSpace !== "normal") h["white-space"] = s.whiteSpace;
    if (s.overflowX !== "visible") h["overflow-x"] = s.overflowX;
    if (s.position !== "static") h.position = s.position;
    if (s.aspectRatio !== "auto") h["aspect-ratio"] = s.aspectRatio;
    return h;
  };

  const offenders = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= limit) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    if (s.position === "fixed") continue;
    if (isClipped(el)) continue;
    offenders.push({ el, r, s });
  }

  const elements = offenders.map(({ el, r, s }) => {
    const leaf = !offenders.some((other) => other.el !== el && el.contains(other.el));
    return {
      selector: describe(el),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      overflowPx: Math.round(r.right - clientWidth),
      leaf,
      hints: hintsFor(s),
      // Only for a leaf. A container's `textContent` is its whole subtree, which names
      // nothing — it is the innermost box whose text identifies the badge or the notice.
      text: leaf ? (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80) : "",
    };
  });

  // Same order the report uses, applied here so the 12 that survive the cap are the 12
  // worth reading rather than the first 12 in document order.
  elements.sort((a, b) =>
    a.overflowPx === b.overflowPx
      ? a.leaf === b.leaf
        ? 0
        : a.leaf
          ? -1
          : 1
      : b.overflowPx - a.overflowPx,
  );
  result.elements = elements.slice(0, 12);
  return result;
};

/**
 * Navigate, settle, and report the HTTP status. Retries once: the recorded flake on this
 * repo is a random province or country page answering `ECONNRESET` while a browser holds
 * the API open, which is precisely the condition this sweep creates.
 */
async function visit(page, url) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      const status = response ? response.status() : 0;
      if (status >= 400) {
        lastError = new Error(`HTTP ${status}`);
      } else {
        await page.waitForLoadState("networkidle", { timeout: SETTLE_TIMEOUT }).catch(() => {});
        await page.evaluate(() => document.fonts.ready).catch(() => {});
        await page.waitForTimeout(SETTLE_MS);
        return { ok: true, status, retried: attempt > 0 };
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await page.waitForTimeout(1500);
  }
  return {
    ok: false,
    error: String(lastError && lastError.message ? lastError.message : lastError),
  };
}

const allUrls = buildSweepUrls(routing.pathnames);
const urls = FILTER
  ? allUrls.filter((u) => u.url.includes(FILTER) || u.id.includes(FILTER))
  : allUrls;
const viewports = VIEWPORT_FILTER
  ? SWEEP_VIEWPORTS.filter((v) => VIEWPORT_FILTER.includes(v.name))
  : SWEEP_VIEWPORTS;
const themes = THEME_FILTER ? SWEEP_THEMES.filter((t) => THEME_FILTER.includes(t)) : SWEEP_THEMES;

if (urls.length === 0) {
  console.error(`No routes matched --filter=${FILTER}`);
  process.exit(2);
}

console.log(`overflow sweep → ${BASE_URL}`);
console.log(
  `${urls.length} URLs × ${viewports.length} viewports × ${themes.length} themes = ` +
    `${urls.length * viewports.length * themes.length} checks\n`,
);

const startedAt = Date.now();
/** @type {unknown[]} */
const records = [];
/** @type {import("../lib/overflow-sweep/report.ts").SweepFailure[]} */
const failures = [];
/** @type {{ url: string, viewport: string, theme: string, error: string }[]} */
const loadFailures = [];
let retries = 0;

/** One browser context: a viewport × theme pair, walking every URL in order. */
async function runPair(browser, viewport, theme) {
  const lines = [`── ${viewport.width}px (${viewport.name}) · ${theme}`];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    // `colorScheme` covers the `prefers-color-scheme` half (form controls, scrollbars,
    // the UA stylesheet); the localStorage value below covers the app's own half.
    // Disagreement between the two is its own bug class and not what this check is for.
    colorScheme: theme,
    // A transition caught mid-flight measures a width the page never settles at.
    reducedMotion: "reduce",
  });
  // BEFORE navigation, which is how the rest of this repo drives the theme: the
  // `next-themes` provider in `components/theme-provider.tsx` is configured with
  // `storageKey: "theme"` and reads it in a blocking inline script, so a value written
  // after the first paint would measure the wrong palette.
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage blocked — the page falls back to the system preference */
      }
    },
    ["theme", theme],
  );
  const page = await context.newPage();
  try {
    for (const entry of urls) {
      const result = await visit(page, `${BASE_URL}${entry.url}`);
      if (!result.ok) {
        loadFailures.push({ url: entry.url, viewport: viewport.name, theme, error: result.error });
        lines.push(`   LOAD ${entry.url} — ${result.error}`);
        continue;
      }
      if (result.retried) retries += 1;
      const measured = await page.evaluate(MEASURE);
      const overflow = measured.scrollWidth - measured.clientWidth;
      const record = {
        shapeId: entry.shape.id,
        url: entry.url,
        locale: entry.locale,
        viewport: viewport.name,
        theme,
        clientWidth: measured.clientWidth,
        scrollWidth: measured.scrollWidth,
        elements: measured.elements,
      };
      records.push(record);
      if (overflow > 0) {
        failures.push(record);
        lines.push(`   FAIL ${entry.url} +${overflow}px`);
      } else {
        lines.push(`   ok   ${entry.url}`);
      }
    }
  } finally {
    await context.close();
  }
  // Printed as one block when the pair finishes, so concurrent pairs do not interleave.
  console.log(lines.join("\n"));
}

/** Every viewport × theme pair, in a stable order. */
const pairs = viewports.flatMap((viewport) => themes.map((theme) => ({ viewport, theme })));

const browser = await chromium.launch();
try {
  // Pairs run concurrently: they share nothing but the server, and the wall-clock cost of
  // this check is what decides whether anyone runs it. Serial, the full sweep took 198s
  // against a production build; four at a time takes well under a minute. Four rather than
  // eight because the ceiling here is the server, not the browser — a `pnpm dev` target
  // re-renders every navigation and an over-parallel sweep is how the recorded `ECONNRESET`
  // flake gets reproduced by the check that is supposed to be measuring layout.
  let next = 0;
  const worker = async () => {
    while (next < pairs.length) {
      const pair = pairs[next];
      next += 1;
      await runPair(browser, pair.viewport, pair.theme);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, worker));
} finally {
  await browser.close();
}

const durationMs = Date.now() - startedAt;

console.log("");
for (const failure of failures) {
  console.log(formatFailure(failure));
  console.log("");
}
for (const failure of loadFailures) {
  console.log(
    `LOAD FAILURE  ${failure.url}  [${failure.viewport} · ${failure.theme}]  ${failure.error}`,
  );
}

const uncovered = uncoveredPathnames(routing.pathnames);
if (uncovered.length > 0) {
  // Informational, never fatal: the list is a set of shapes on purpose. This footer is how
  // a genuinely NEW shape — the next `(play)`-style layout escape — becomes visible.
  console.log(
    `\nnot swept, judged the same shape as a route above (${uncovered.length}): ` +
      uncovered.join(", "),
  );
}

mkdirSync(dirname(JSON_OUT), { recursive: true });
writeFileSync(
  JSON_OUT,
  `${JSON.stringify(
    {
      baseUrl: BASE_URL,
      startedAt: new Date(startedAt).toISOString(),
      durationMs,
      viewports,
      themes,
      urls: urls.map((u) => ({ id: u.id, url: u.url, why: u.shape.why })),
      records,
      failures,
      loadFailures,
      uncovered,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `\n${formatSummary({
    urls: urls.length,
    checks: records.length,
    failures: failures.length,
    retries,
    loadFailures: loadFailures.length,
  })}`,
);
console.log(`${(durationMs / 1000).toFixed(1)}s · ${JSON_OUT}`);

if (failures.length > 0 || loadFailures.length > 0) process.exit(1);
