/**
 * Assert that a production build actually prerendered its data pages.
 *
 * ## The failure this catches
 *
 * Measured 2026-09-19: with the API unreachable, `next build` exits **0** and writes **124**
 * prerendered routes instead of **980**. Every `generateStaticParams` returns zero rows,
 * because the 16 `*Resilient`/`*Safe` wrappers swallow fetch failures to `[]` while
 * `NEXT_PHASE` says production build. Nothing downstream noticed, including CI.
 *
 * ## Why named subsets and not one total
 *
 * A single total is satisfiable while a whole category is missing. The counts below are
 * therefore per route family, and the structural ones are pinned EXACTLY: Türkiye has 81
 * provinces and 7 regions, and the showcase has 7 categories, so those numbers moving is
 * news either way. Country and book counts are floors, because seeds are added over time.
 *
 * All figures measured from `.next/prerender-manifest.json` on 2026-09-19.
 */
import { readFileSync } from "node:fs";

/** @typedef {{ label: string, kind: "exact" | "floor", expected: number, pattern: RegExp }} Rule */

/** @type {readonly Rule[]} */
const RULES = [
  { label: "total", kind: "floor", expected: 980, pattern: /^\// },
  {
    label: "provinces",
    kind: "exact",
    expected: 162,
    pattern: /^\/(tr|en)\/turkiye\/(?!bolge)[^/]+$/,
  },
  { label: "regions", kind: "exact", expected: 14, pattern: /^\/(tr|en)\/turkiye\/bolge\/[^/]+$/ },
  {
    label: "countries",
    kind: "floor",
    expected: 398,
    pattern: /^\/(tr|en)\/(dunya|world)\/(?!kita|continent)[^/]+$/,
  },
  {
    label: "continents",
    kind: "exact",
    expected: 28,
    pattern: /^\/(tr|en)\/(dunya\/kita|world\/continent)\/[^/]+$/,
  },
  { label: "books", kind: "floor", expected: 2, pattern: /^\/(tr|en)\/(kitaplar|books)\/[^/]+$/ },
  {
    label: "design-system",
    kind: "exact",
    expected: 14,
    pattern: /^\/(tr|en)\/design-system\/[^/]+$/,
  },
];

/**
 * @param {unknown} manifest
 * @returns {{ label: string, kind: "exact" | "floor", expected: number, actual: number }[]}
 */
export function readPrerenderFloors(manifest) {
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    !("routes" in manifest) ||
    typeof manifest.routes !== "object" ||
    manifest.routes === null
  ) {
    throw new Error("Not a prerender manifest: no `routes` object");
  }
  const paths = Object.keys(manifest.routes);
  return RULES.map((rule) => ({
    label: rule.label,
    kind: rule.kind,
    expected: rule.expected,
    actual: paths.filter((p) => rule.pattern.test(p)).length,
  }));
}

function main() {
  const path = ".next/prerender-manifest.json";
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    console.error(`prerender floor: cannot read ${path} — did next build run?`);
    console.error(String(cause));
    process.exit(1);
  }

  let rows;
  try {
    rows = readPrerenderFloors(manifest);
  } catch (cause) {
    console.error(`prerender floor: ${path} parsed but is not shaped like a prerender manifest.`);
    console.error(String(cause));
    process.exit(1);
  }

  const failed = rows.filter((r) =>
    r.kind === "exact" ? r.actual !== r.expected : r.actual < r.expected,
  );

  for (const r of rows) {
    const ok = r.kind === "exact" ? r.actual === r.expected : r.actual >= r.expected;
    const sign = r.kind === "exact" ? "=" : ">=";
    console.log(`${ok ? "ok  " : "FAIL"} ${r.label.padEnd(14)} ${r.actual} ${sign} ${r.expected}`);
  }

  if (failed.length > 0) {
    console.error(
      `\nprerender floor: ${failed.length} route famil${failed.length === 1 ? "y" : "ies"} short. ` +
        `An API-less build looks exactly like this. Check API_BASE_URL and that the API is ` +
        `reachable from wherever this build ran.`,
    );
    process.exit(1);
  }
}

// Only run the CLI half when invoked directly, so the test can import the counting half.
if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/^.*[/\\]/, ""))
) {
  main();
}
