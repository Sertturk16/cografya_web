import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * BINDING GUARD: every page that publishes a CMEMS/ECMWF-derived value renders the notice.
 *
 * ## The failure this exists to prevent
 *
 * CC BY 4.0 and ECMWF's "shall be attached" wording make the attribution travel WITH the
 * derived material, and `components/marine/marine-attribution.tsx` records the conservative
 * reading of "prominently": VISIBLE WITHOUT A CLICK, on the page that carries the value. The
 * component existed and was correct. What kept failing was the LIST of pages it was rendered
 * on, because that list lived in people's heads:
 *
 *  - The V2 rewrite gave eight map components their own inline SVGs and the map credit did not
 *    come with them; `lib/map/tr-inland-water-jrc.test.ts` had guarded exactly that rule
 *    against a HAND-WRITTEN list of four V1 files, so it never fired. It now derives its
 *    surface list from the `INLAND_WATER_SHAPES` import instead.
 *  - The same defect then recurred on the marine side, invisibly to that test because these
 *    surfaces draw no water layer: the four sea-basin pages and the home page published
 *    `sst` / `waveHeight` / `windSpeed10m` — the basin pages under a heading naming
 *    "CMEMS & ECMWF Açık Deniz Modelleri" — with no attribution block on any of them. The
 *    bibliography's `cmems` and `ecmwf-marine` cards deliberately carry no `legalQuote`
 *    ("the licence lives in the attribution block"), so ECMWF's required notice was rendered
 *    NOWHERE IN THE PRODUCT for those values.
 *
 * So this test hand-writes no list of pages either. It DERIVES the publishers — any `.tsx`
 * that reads a marine value field — walks each page's import graph to find which pages render
 * one, and requires `MarineAttribution` on exactly those. A ninth marine surface cannot be
 * written without this test seeing it.
 *
 * Structural only (`CONVENTIONS.md` §2): imports and element names, never copy.
 *
 * ## The one exception, and why it is pinned rather than silent
 *
 * `V2LiveTicker` publishes SST and wave height in site chrome that appears on 33 pages. Every
 * available fix — a licence block under the ticker on all 33, a compact in-line credit, or the
 * ticker ceasing to publish values — changes what those 33 pages show, which is the owner's
 * call and not a repair. It is therefore excluded from the graph below AND pinned by its own
 * assertion, so the exception cannot quietly outlive the question: the day the ticker stops
 * publishing values, or starts carrying the notice, that assertion goes red and whoever made
 * the change deletes the exception instead of inheriting it.
 */

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const appDir = join(repoRoot, "app");
const componentsDir = join(repoRoot, "components");

/**
 * The fields that ARE the derived material. `sst` alone is too short a token to match on
 * safely, and every surface that renders it also renders one of these two.
 */
const MARINE_VALUE_FIELDS = /\b(seaSurfaceTemperature|waveHeight)\b/;

/** See the docblock: an owner-facing product question, not a defect this test may hide. */
const TICKER = join(componentsDir, "v2", "v2-live-ticker.tsx");

const walkTsx = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkTsx(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });

const sourceOf = new Map<string, string>();
const read = (file: string): string => {
  const cached = sourceOf.get(file);
  if (cached !== undefined) return cached;
  const source = readFileSync(file, "utf8");
  sourceOf.set(file, source);
  return source;
};

/**
 * Local `.tsx` modules a file renders. `import type` lines are skipped: a page that imports a
 * component's PROP TYPE does not render that component, and counting it would credit sources
 * on pages that show none — the over-citation half of the same rule.
 */
function localImports(file: string): string[] {
  const source = read(file);
  const specifiers = [...source.matchAll(/^\s*import\s+(?!type\b)[\s\S]*?from\s+"([^"]+)";/gm)].map(
    (match) => match[1]!,
  );
  return specifiers
    .map((specifier) => {
      if (specifier.startsWith("@/")) return join(repoRoot, specifier.slice(2));
      if (specifier.startsWith(".")) return resolve(dirname(file), specifier);
      return null;
    })
    .map((base) => (base === null ? null : `${base}.tsx`))
    .filter((candidate): candidate is string => candidate !== null && existsSync(candidate));
}

/** Every `.tsx` reachable from `entry` through non-type local imports, `entry` included. */
function renderClosure(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const next of localImports(current)) {
      if (next === TICKER || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

const attributionComponent = join(repoRoot, "components", "marine", "marine-attribution.tsx");

const publishers = [...walkTsx(appDir), ...walkTsx(componentsDir)].filter(
  (file) => file !== attributionComponent && MARINE_VALUE_FIELDS.test(read(file)),
);

const pages = walkTsx(appDir).filter((file) => file.endsWith("page.tsx"));

const owing = pages
  .map((page) => ({ page, closure: renderClosure(page) }))
  .filter(({ closure }) => publishers.some((publisher) => closure.has(publisher)))
  .map(({ page }) => page);

const rel = (file: string) => file.slice(repoRoot.length);

describe("MarineAttribution travels with the values", () => {
  it("derives a non-empty publisher and page set", () => {
    // Anti-vacuity. A regex that stopped matching, or a walk that found nothing, would satisfy
    // every loop below for free — and finding these surfaces is the entire point of deriving
    // them. The floors are well under today's counts so a genuine removal is not a failure.
    expect(publishers.length, "components reading a marine value field").toBeGreaterThan(3);
    expect(owing.length, "pages rendering a marine value").toBeGreaterThan(4);
  });

  it("renders the notice on every page that publishes a marine value", () => {
    for (const page of owing) {
      expect(
        read(page),
        `${rel(page)} publishes a CMEMS/ECMWF-derived value without <MarineAttribution>`,
      ).toContain("<MarineAttribution");
    }
  });

  it("renders it on no page that publishes none", () => {
    // The other direction, and it is not symmetry for its own sake: a page crediting a source
    // it does not use makes a false statement, which is the defect the bibliography's
    // `include`/`omit` props exist for (`components/v2/v2-sources-conditional.test.ts`).
    for (const page of pages) {
      if (owing.includes(page)) continue;
      expect(read(page), `${rel(page)} credits CMEMS/ECMWF but publishes neither`).not.toContain(
        "<MarineAttribution",
      );
    }
  });

  it("keeps the ticker's uncredited values a PINNED open question, not a silent exemption", () => {
    const ticker = read(TICKER);
    // Still publishing — so the exception above is still describing something real.
    expect(ticker, "the ticker no longer publishes marine values").toMatch(MARINE_VALUE_FIELDS);
    // Still uncredited. When someone gives it the notice, this goes red and the exclusion in
    // `renderClosure` must be deleted in the same change.
    expect(ticker, "the ticker now carries the notice — drop the TICKER exclusion").not.toContain(
      "<MarineAttribution",
    );
  });
});
