import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A FOOTER SOURCE CHIP NAMES AN INSTITUTION THE PAGE IT LINKS TO ACTUALLY CARRIES.
 *
 * ## Why this became a factual question
 *
 * The chips used to be four `Badge` spans — `TÜİK & OSM`, `Copernicus`, `ECMWF`, `AFAD` —
 * institution names styled like affiliations, pointing nowhere. Nothing about them was checkable,
 * because they claimed nothing beyond "these words are associated with this site".
 *
 * Centralising the marine licence notices changed that. Under CC BY 4.0 §3(a)(2) the hyperlink to
 * the page carrying the notice is PART of how the attribution is discharged, so each chip is now
 * an assertion: *the attribution for this provider is over there*. An assertion can be false.
 *
 * ## It was false on half of them the day they became links
 *
 * - `AFAD` pointed at the About page's data section, which does not mention AFAD. It cannot:
 *   AFAD's notice is payload-driven (`EarthquakeAttribution`, from the earthquake meta), so
 *   putting it on a static page means writing AFAD copy by hand — inventing attribution, which is
 *   the defect this repo guards hardest. It points at `/deprem` now, which renders the real one.
 * - `TÜİK & OSM` pointed at a page that carries OSM and has never mentioned TÜİK. The figures
 *   TÜİK supplies are already sourced where they are shown, beside the number. The chip now names
 *   only what the destination carries.
 *
 * Both were introduced and found in the same change. Two out of four is not a slip, it is a shape
 * — so it gets a guard rather than a correction.
 *
 * ## What this proves, and what it does not
 *
 * It walks the destination page's non-type import graph and searches those sources plus the
 * message namespaces they actually read. So it proves the institution's name is reachable from
 * what that page renders. It does NOT prove the name is rendered on screen (that needs a rendered
 * tree; vitest here is node with no jsdom), nor that the text beside it is a correct attribution.
 * It closes the specific hole that opened: a chip pointing somewhere its subject is absent.
 */

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Source with comments stripped.
 *
 * A comment that names an institution is not attribution, and the first draft of this file proved
 * it the hard way: pointing `AFAD` back at the About page kept the test GREEN, because
 * `i18n/routing.ts:264` carries `// The earthquake hub (AFAD, → DEC 2026-08-29a…)` and the
 * routing table is reachable from every page through `Link`. The assertion was passing on a
 * comment in a module that renders nothing — the same trap `locator-attribution.test.ts` and
 * `lib/map/tr-inland-water-jrc.test.ts` each document, arrived at independently a third time.
 */
const read = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");

/** Source as written, for the parts of this file that are about code rather than copy. */
const readRaw = (file: string) => readFileSync(file, "utf8");

/**
 * Routing infrastructure is reachable from every page (`Link` → `i18n/navigation` →
 * `i18n/routing`) and renders nothing. Leaving it in the closure makes every institution look
 * present on every page, which is the opposite of what this file measures.
 */
const INFRASTRUCTURE = /^i18n\//;

const FOOTER = join(repoRoot, "components/v2/v2-footer.tsx");
const MESSAGES = JSON.parse(readRaw(join(repoRoot, "messages/tr.json"))) as Record<string, unknown>;

/** `<Link href={…} className={SOURCE_BADGE}>Label</Link>`, in source order. */
const chips = [
  ...readRaw(FOOTER).matchAll(
    /<Link\s+href=\{?["']?([^"'}\s]+)["']?\}?\s+className=\{SOURCE_BADGE\}>\s*([^<]+?)\s*<\/Link>/g,
  ),
].map((match) => ({ href: match[1]!, label: match[2]!.replace(/&amp;/g, "&").trim() }));

/**
 * Where a chip's `href` lands, as a page file.
 *
 * `MARINE_SOURCES_ANCHOR` is a constant rather than a literal precisely so the fragment cannot
 * drift from the `id` it targets (`lib/marine/attribution-anchor.ts`), so it is resolved by name.
 * Everything else is a pathname and resolves structurally — route groups are not URL segments.
 */
function pageFor(href: string): string {
  const pathname = href === "MARINE_SOURCES_ANCHOR" ? "/hakkimizda" : href.split("#")[0]!;
  const segments = pathname.split("/").filter((segment) => segment !== "");
  return join(repoRoot, "app/[locale]/(site)", ...segments, "page.tsx");
}

function localImports(file: string): string[] {
  return [...readRaw(file).matchAll(/^\s*import\s+(?!type\b)[\s\S]*?from\s+"([^"]+)";/gm)]
    .map((match) => {
      const specifier = match[1]!;
      if (specifier.startsWith("@/")) return join(repoRoot, specifier.slice(2));
      if (specifier.startsWith(".")) return resolve(dirname(file), specifier);
      return null;
    })
    .flatMap((base) => (base === null ? [] : [`${base}.tsx`, `${base}.ts`]))
    .filter((candidate) => existsSync(candidate))
    .filter((candidate) => !INFRASTRUCTURE.test(candidate.slice(repoRoot.length)));
}

/** Every local module reachable from `entry` through non-type imports, `entry` included. */
function renderClosure(entry: string): string[] {
  const seen = new Set([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    for (const next of localImports(queue.pop()!)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen];
}

/** The catalogue text a closure can render: every namespace it opens, flattened. */
function reachableCopy(closure: readonly string[]): string {
  const namespaces = new Set(
    closure
      .flatMap((file) => [
        ...readRaw(file).matchAll(
          /(?:useTranslations|getTranslations)\(\s*\{?[^)]*?["']([A-Za-z]+)["']/g,
        ),
      ])
      .map((match) => match[1]!),
  );
  return [...namespaces].map((namespace) => JSON.stringify(MESSAGES[namespace] ?? {})).join(" ");
}

describe("footer source chips", () => {
  it("finds the chips and resolves every destination to a real page", () => {
    // Anti-vacuity: a regex that stopped matching would assert nothing below, and the chips are
    // the entire subject. Four today; the floor allows the set to grow or lose one.
    expect(chips.length, "source chips parsed from the footer").toBeGreaterThan(2);
    for (const chip of chips) {
      expect(existsSync(pageFor(chip.href)), `${chip.label} → ${chip.href} is not a page`).toBe(
        true,
      );
    }
  });

  it.each(chips.map((chip) => [chip.label, chip.href] as const))(
    "%s links somewhere that carries it",
    (label, href) => {
      const closure = renderClosure(pageFor(href));
      const haystack = `${closure.map(read).join(" ")} ${reachableCopy(closure)}`;
      expect(
        haystack.includes(label),
        `the footer names ${label} and links to ${href}, which renders nothing that mentions it`,
      ).toBe(true);
    },
  );

  it("can tell a destination that carries a name from one that does not", () => {
    // The positive control matters more than usual here: the assertion above is an `includes` over
    // a large haystack, which is exactly the shape that passes for free when the haystack is built
    // wrong. `TÜİK` is the real counter-example — it was on a chip, and it is on no page.
    const about = renderClosure(pageFor("MARINE_SOURCES_ANCHOR"));
    const aboutText = `${about.map(read).join(" ")} ${reachableCopy(about)}`;
    expect(aboutText.includes("OpenStreetMap"), "About should carry OpenStreetMap").toBe(true);
    expect(aboutText.includes("TÜİK"), "About has never carried TÜİK").toBe(false);
  });
});
