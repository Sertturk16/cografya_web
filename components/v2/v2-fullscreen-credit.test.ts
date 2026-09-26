import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  jsxElementsOf,
  label,
  readSource,
  walk,
  type ScannedElement,
} from "@/lib/test-support/composition-scan";

/**
 * Fullscreen takes the credit with it (T-117).
 *
 * Once the Fullscreen API engages, only the target element's subtree is on screen. A map that goes
 * fullscreen without its credit publishes OSM and JRC geometry with no attribution, which is the
 * licence gap `MapAttribution` exists to close. So on every surface that calls `useLandscapeMode`,
 * the credit must sit inside the element holding the ref passed to it, and must be told when it is
 * fullscreen so it can shrink to its ⓘ instead of taking a strip under the map.
 *
 * The surface list is DERIVED from `useLandscapeMode(` calls, for the reason
 * `v2-map-credit-placement.test.ts` derives its own: the next map that gains a fullscreen button
 * (T-118, T-119) joins this check without anyone remembering to add it.
 */
const surfaces = ["components", "app"]
  .flatMap((dir) => walk(fileURLToPath(new URL(`../../${dir}/`, import.meta.url))))
  .map((file) => ({ file, name: label(file), source: readSource(file) }))
  .filter(({ source }) => /\buseLandscapeMode\(\s*\w+\s*\)/.test(source));

const ancestorsOf = (elements: readonly ScannedElement[], index: number): number[] => {
  const chain: number[] = [];
  for (let at = elements[index]?.parent ?? null; at !== null; at = elements[at]?.parent ?? null) {
    chain.push(at);
  }
  return chain;
};

describe("the fullscreen target holds the map credit", () => {
  it("finds the surfaces to check", () => {
    expect(surfaces.map((s) => s.name)).toEqual(
      expect.arrayContaining([
        "components/v2/v2-game-screen.tsx",
        "components/v2/v2-tool-workbench.tsx",
        "components/v2/v2-world-map-explorer.tsx",
        "components/v2/v2-turkey-map-explorer.tsx",
        "components/v2/v2-earthquake-explorer.tsx",
        "components/v2/v2-marine-map-explorer.tsx",
      ]),
    );
  });

  it.each(["v2-earthquake-explorer.tsx", "v2-marine-map-explorer.tsx"])(
    "%s credits the data it draws in fullscreen (T-119)",
    (file) => {
      const path = fileURLToPath(new URL(`./${file}`, import.meta.url));
      const credit = jsxElementsOf(path).find((el) => el.tag === "MapAttribution");
      expect(credit?.attributes.has("dataCredit"), `${file}: no dataCredit`).toBe(true);
    },
  );

  it("gets the AFAD line from the /deprem page, each notice marked Turkish (T-119)", () => {
    // The explorer only forwards what the page hands it; without this the line could drop out
    // with every check above still green. `app/` is read as source: vitest runs nothing there.
    const page = readSource(
      fileURLToPath(new URL("../../app/[locale]/(site)/deprem/page.tsx", import.meta.url)),
    );
    expect(page).toMatch(
      /<V2EarthquakeExplorer[\s\S]*?dataCredit=\{[\s\S]*?<EarthquakeMapCredit attributions=\{earthquakeMeta\.attributions\}/,
    );
    const credit = readSource(
      fileURLToPath(new URL("../earthquake/earthquake-attribution.tsx", import.meta.url)),
    );
    const mapCredit = credit.slice(credit.indexOf("export function EarthquakeMapCredit"));
    expect(mapCredit).toMatch(/<span lang="tr">\s*\{attribution\.requiredNoticeTr\}/);
  });

  it.each(surfaces)(
    "$name renders MapAttribution inside its fullscreen target",
    ({ file, source }) => {
      const call = source.match(/const (\w+) = useLandscapeMode\(\s*(\w+)\s*\)/);
      expect(
        call,
        `${label(file)}: useLandscapeMode result is not bound to a const`,
      ).not.toBeNull();
      const [, mode, ref] = call as RegExpMatchArray;

      const elements = jsxElementsOf(file);
      const targets = elements.flatMap((el, i) => (el.attributes.get("ref") === ref ? [i] : []));
      expect(targets, `${label(file)}: no element carries ref={${ref}}`).toHaveLength(1);
      const target = targets[0] as number;

      const credits = elements.flatMap((el, i) => (el.tag === "MapAttribution" ? [i] : []));
      expect(credits.length, `${label(file)}: no <MapAttribution>`).toBeGreaterThan(0);

      for (const credit of credits) {
        expect(
          ancestorsOf(elements, credit),
          `${label(file)}: the credit is outside the fullscreen target`,
        ).toContain(target);
        // A bare `{…}` hides nothing: the credit is conditional only if it sits under an expression.
        expect(elements[credit]?.inExpression, `${label(file)}: the credit is conditional`).toBe(
          false,
        );
        expect(elements[credit]?.attributes.get("fullscreen")).toBe(`${mode}.active`);
      }
    },
  );
});
