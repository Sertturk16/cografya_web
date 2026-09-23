import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MARINE_SOURCES_FRAGMENT } from "@/lib/marine/attribution-anchor";

/**
 * BINDING GUARD: every page that publishes a CMEMS/ECMWF-derived value carries the notice, and
 * the licence text it links to exists in exactly one place.
 *
 * ## The failure this exists to prevent
 *
 * The attribution has to reach the reader of a derived value, and
 * `components/marine/marine-attribution.tsx` records what that takes. The component existed and
 * was correct. What kept failing was the LIST of pages it was rendered on, because that list
 * lived in people's heads:
 *
 *  - The V2 rewrite gave eight map components their own inline SVGs and the map credit did not
 *    come with them; `lib/map/tr-inland-water-jrc.test.ts` had guarded exactly that rule
 *    against a HAND-WRITTEN list of four V1 files, so it never fired. It now derives its
 *    surface list from the `INLAND_WATER_SHAPES` import instead.
 *  - The same defect then recurred on the marine side, invisibly to that test because these
 *    surfaces draw no water layer: the four sea-basin pages and the home page published
 *    `sst` / `waveHeight` / `windSpeed10m` — the basin pages under a heading naming
 *    "CMEMS & ECMWF Açık Deniz Modelleri" — with no attribution block on any of them. The
 *    sources card's `cmems` and `ecmwf-marine` entries deliberately carried no `legalQuote`, so
 *    ECMWF's required notice was rendered NOWHERE IN THE PRODUCT for those values.
 *
 * So this test hand-writes no list of pages either. It DERIVES the publishers — any `.tsx`
 * that reads a marine value field — walks each page's import graph to find which pages render
 * one, and requires the notice on exactly those. A ninth marine surface cannot be written
 * without this test seeing it.
 *
 * ## What changed, and what did not
 *
 * The rule is the same rule; it changed SHAPE when the owner centralized the licence notices.
 * ECMWF Open Data is CC BY 4.0, and §3(a)(2) permits the required information to be carried by
 * "a URI or hyperlink to a resource that includes" it. So the obligation now has two halves and
 * this file asserts both:
 *
 *  1. Every value-publishing page renders `<MarineDataNotice>` — the SAFETY DISCLAIMER, which
 *     is not a licence notice and could not be centralized (a reader looking at a sea
 *     temperature has to see it beside the number), plus the hyperlink that discharges the
 *     licence.
 *  2. The FULL licence text — `<MarineAttribution>` — is reachable from exactly ONE page, and
 *     that page is the one the hyperlink points at. Two copies of a verbatim licence string is
 *     a breach waiting for the day someone edits one of them; ZERO copies is the breach
 *     outright, and a link to a page that stopped rendering the notice is the quiet way to get
 *     there. The fragment is asserted from the shared constant, not spelled out here.
 *
 * Structural only (`CONVENTIONS.md` §2): imports and element names, never copy.
 *
 * ## The one exception, and why it is pinned rather than silent
 *
 * `V2LiveTicker` publishes SST and wave height in site chrome that appears on 33 pages. Every
 * available fix — a notice under the ticker on all 33, a compact in-line credit, or the ticker
 * ceasing to publish values — changes what those 33 pages show, which is the owner's call and
 * not a repair. It is therefore excluded from the graph below AND pinned by its own assertion,
 * so the exception cannot quietly outlive the question: the day the ticker stops publishing
 * values, or starts carrying the notice, that assertion goes red and whoever made the change
 * deletes the exception instead of inheriting it.
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

/** The full licence block, and the compact notice that links to it. */
const licenceBlock = join(componentsDir, "marine", "marine-attribution.tsx");
const compactNotice = join(componentsDir, "marine", "marine-data-notice.tsx");

/** The one page the hyperlink resolves to. `/en/about` is the same file. */
const centralPage = join(appDir, "[locale]", "(site)", "hakkimizda", "page.tsx");

const publishers = [...walkTsx(appDir), ...walkTsx(componentsDir)].filter(
  (file) => file !== licenceBlock && file !== compactNotice && MARINE_VALUE_FIELDS.test(read(file)),
);

const pages = walkTsx(appDir).filter((file) => file.endsWith("page.tsx"));

const owing = pages
  .map((page) => ({ page, closure: renderClosure(page) }))
  .filter(({ closure }) => publishers.some((publisher) => closure.has(publisher)))
  .map(({ page }) => page);

/** Pages that render the FULL licence text, by import graph rather than by spelling. */
const carryingLicence = pages.filter((page) => renderClosure(page).has(licenceBlock));

const rel = (file: string) => file.slice(repoRoot.length);

describe("the marine notice travels with the values", () => {
  it("derives a non-empty publisher and page set", () => {
    // Anti-vacuity. A regex that stopped matching, or a walk that found nothing, would satisfy
    // every loop below for free — and finding these surfaces is the entire point of deriving
    // them. The floors are well under today's counts so a genuine removal is not a failure.
    expect(publishers.length, "components reading a marine value field").toBeGreaterThan(3);
    expect(owing.length, "pages rendering a marine value").toBeGreaterThan(4);
  });

  it("renders the compact notice on every page that publishes a marine value", () => {
    for (const page of owing) {
      expect(
        read(page),
        `${rel(page)} publishes a CMEMS/ECMWF-derived value without <MarineDataNotice>`,
      ).toContain("<MarineDataNotice");
    }
  });

  it("renders it on no page that publishes none", () => {
    // The other direction, and it is not symmetry for its own sake: a page crediting a source
    // it does not use makes a false statement.
    for (const page of pages) {
      if (owing.includes(page)) continue;
      expect(read(page), `${rel(page)} credits CMEMS/ECMWF but publishes neither`).not.toContain(
        "<MarineDataNotice",
      );
    }
  });
});

describe("the licence text has exactly one home, and the link reaches it", () => {
  it("renders the full licence block on exactly one page", () => {
    // ONE, not "at least one". Two copies of a verbatim licence string is the breach this
    // repository has been organised around avoiding since W2b, and centralizing the notice did
    // not retire that risk — it moved it, from "seven render sites of one component" to "one
    // render site nobody re-adds a second time".
    expect(carryingLicence.map(rel), "pages whose import graph reaches MarineAttribution").toEqual([
      rel(centralPage),
    ]);
  });

  it("keeps the full licence block off every value-publishing page", () => {
    // The complement of the assertion above, stated where a reader of the OLD rule will look
    // for it. Re-adding the block beside the values is not itself a licence defect; shipping a
    // SECOND copy of the strings would be, and this is the cheapest place to catch the first
    // step towards one.
    for (const page of owing) {
      expect(
        read(page),
        `${rel(page)} renders the licence block as well as the notice`,
      ).not.toContain("<MarineAttribution");
    }
  });

  it("lands the notice's hyperlink on an anchor the central page actually renders", () => {
    // The hyperlink IS the attribution under CC BY 4.0 §3(a)(2), so a renamed `id` on
    // `/hakkimizda` is a licence defect and not a broken-link nit. Both ends read the same
    // exported constant; this asserts the page end still SPENDS it — on the `id`, not merely
    // in an import line, which is what an earlier `toContain("MARINE_SOURCES_FRAGMENT")`
    // would have kept green while the anchor was hand-spelled beside it.
    expect(read(centralPage), "the central page dropped the anchor the notice links to").toContain(
      "id={MARINE_SOURCES_FRAGMENT}",
    );
    expect(MARINE_SOURCES_FRAGMENT.length, "the shared fragment is empty").toBeGreaterThan(0);

    // And that the compact notice is what points there, rather than each call site spelling a
    // URL of its own.
    expect(read(compactNotice)).toContain("href={MARINE_SOURCES_ANCHOR}");
  });

  it("keeps the safety disclaimer in the compact notice, not only in the central block", () => {
    // The half of the old block that did NOT centralize. If this ever reads false, every
    // value surface is one click away from a sentence that says the numbers must not be used
    // for navigation — which is exactly the arrangement the owner decision rejected.
    //
    // Asserted as the RENDER CALL, not as the key. The component's docblock names the key while
    // explaining why it may not move, so `toContain("disclaimer.educationalOnly")` stays green
    // on a file that has stopped rendering it and only still talks about it.
    expect(
      read(compactNotice),
      "the compact notice stopped rendering the safety disclaimer",
    ).toContain('{t("disclaimer.educationalOnly")}');
  });

  it("keeps the ticker's uncredited values a PINNED open question, not a silent exemption", () => {
    const ticker = read(TICKER);
    // Still publishing — so the exception above is still describing something real.
    expect(ticker, "the ticker no longer publishes marine values").toMatch(MARINE_VALUE_FIELDS);
    // Still uncredited. When someone gives it the notice, this goes red and the exclusion in
    // `renderClosure` must be deleted in the same change.
    expect(ticker, "the ticker now carries the notice — drop the TICKER exclusion").not.toContain(
      "<MarineDataNotice",
    );
    expect(
      ticker,
      "the ticker now carries the licence block — drop the TICKER exclusion",
    ).not.toContain("<MarineAttribution");
  });
});
