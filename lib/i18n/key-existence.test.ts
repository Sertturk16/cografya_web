import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

/**
 * EVERY MESSAGE KEY THE CODE ASKS FOR EXISTS IN BOTH CATALOGUES.
 *
 * ## Why this is a repo-wide scan and not one more per-namespace test
 *
 * next-intl does not throw on a missing key. It logs `MISSING_MESSAGE` to the server console and
 * renders the dotted key string into the markup — so `Game.mode3PickerMetaDescription` ships as
 * visible page text, or as a `<title>`, with typecheck, lint and the whole suite green.
 *
 * Several namespaces already have a dedicated messages test (`lib/tools`, `components/book`,
 * `lib/marine`, …) and those are worth keeping: they check totality in the other direction too,
 * and they know which keys carry placeholders. But a namespace with no such test has no guard at
 * all, and T-032 PR3 found two live examples when `pnpm build` prerendered routes that had never
 * been prerendered before:
 *
 *  - `Game.mode3PickerMetaTitle` / `Game.mode3PickerMetaDescription` — invented by the V2 rewrite
 *    for `/oyun/bolge-bolge-il`, never added to either file. The page's `<title>` and meta
 *    description were the literal key strings.
 *  - `ProvinceDetail.introFallback` — a near-miss for `introFallbackRegion` in the province
 *    page's last-resort intro branch. No seeded province reaches that branch today, so it would
 *    have waited for the first province with no intro, no population and no area.
 *
 * A build is too late and too expensive to be the first thing that notices. This runs in
 * milliseconds against source text.
 *
 * ## What it can and cannot see
 *
 * It resolves `const t = useTranslations("NS")` / `getTranslations("NS")` (and the
 * `{ locale, namespace: "NS" }` form) to a binding, then checks every literal key passed to that
 * binding. A computed key — `t(someVariable)` or a template literal — is invisible to it, by
 * design: those are the cases the per-namespace tests and `selectProvinceMetaDescription`-style
 * key builders exist to cover, and guessing at them here would produce false failures.
 */

const SOURCE_ROOTS = ["app", "components", "lib", "tools"] as const;

const walk = (dir: string): string[] => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
};

/** `true` when `dotted` resolves to a string in `catalogue`. */
const resolves = (catalogue: unknown, dotted: string): boolean => {
  let node: unknown = catalogue;
  for (const part of dotted.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
};

interface Request {
  file: string;
  key: string;
}

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const requests: Request[] = SOURCE_ROOTS.flatMap((root) => walk(join(repoRoot, root))).flatMap(
  (file) => {
    const source = readFileSync(file, "utf8");

    // `const t = useTranslations("NS")`, `const t = await getTranslations("NS")`,
    // `const t = await getTranslations({ locale, namespace: "NS" })`.
    const bindings = new Map<string, string>();
    const bindingPattern =
      /const\s+(\w+)\s*=\s*(?:await\s+)?(?:get|use)Translations\(\s*(?:\{[^}]*namespace:\s*)?"([^"]+)"/g;
    for (const match of source.matchAll(bindingPattern)) {
      bindings.set(match[1]!, match[2]!);
    }

    return [...bindings].flatMap(([binding, namespace]) =>
      [...source.matchAll(new RegExp(String.raw`\b${binding}\(\s*"([A-Za-z0-9_.]+)"`, "g"))].map(
        (call) => ({
          file: file.slice(repoRoot.length),
          key: `${namespace}.${call[1]!}`,
        }),
      ),
    );
  },
);

describe("every literal message key the code asks for", () => {
  it("scans a realistic number of call sites", () => {
    // Anti-vacuity, and the load-bearing assertion of this file: a regex that stopped matching
    // — a new translator-binding idiom, a moved directory — would report a clean sweep over
    // nothing at all, which is the one outcome a guard like this must never produce.
    expect(requests.length, "resolved t(...) call sites").toBeGreaterThan(400);
    expect(new Set(requests.map((r) => r.file)).size, "files with a binding").toBeGreaterThan(40);
  });

  it("resolves in tr.json", () => {
    const missing = requests.filter((r) => !resolves(tr, r.key));
    expect(missing.map((r) => `${r.file}: ${r.key}`)).toEqual([]);
  });

  it("resolves in en.json", () => {
    // Separately from TR: a key added to one file only ships the dotted string on one locale,
    // which is exactly how `Game.mode3PickerMetaDescription` surfaced — on `/en` first.
    const missing = requests.filter((r) => !resolves(en, r.key));
    expect(missing.map((r) => `${r.file}: ${r.key}`)).toEqual([]);
  });
});
