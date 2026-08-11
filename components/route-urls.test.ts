import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { baseMapResponse } from "@/lib/map/base-map-svg";

/**
 * Every URL these components hard-code must have a route behind it.
 *
 * Five new handlers serve five URL literals held in two component files, and nothing bound
 * either side to the other. Next's route URLs are derived from directory names and carry no
 * type — the `as const satisfies` on `BASE_MAP` types the record's SHAPE, not the existence of
 * a handler behind each string — so `tsc`, eslint, `next build` and every other test file stay
 * green while the two sides drift apart. The rendered result is an empty locator frame on 280
 * pages, or a broken flag on 199.
 *
 * The realistic trigger is not a typo. `app/maps/world-countries.en.svg/` has a dot in its
 * directory name ON PURPOSE: `proxy.ts`'s matcher skips any path containing a dot, and that is
 * what stops next-intl rewriting these URLs into a locale prefix. It reads like an accident,
 * which makes it exactly the kind of thing a later tidy-up "fixes".
 *
 * Derivation, not duplication: the expected directory is computed from the URL the component
 * actually ships, so this cannot pass by having been updated in step with a rename.
 */

function tsxCode(url: URL): string {
  return readFileSync(url, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const locator = tsxCode(new URL("./map/locator-map.tsx", import.meta.url));
const flagCard = tsxCode(new URL("./country/country-flag.tsx", import.meta.url));
const flagRouteUrl = new URL("../app/flags/[flag]/route.ts", import.meta.url);
const flagAdapterUrl = new URL("../lib/geo/flag-route.server.ts", import.meta.url);
const countriesUrl = new URL("../lib/api/countries.ts", import.meta.url);
const flagRouteSource = readFileSync(flagRouteUrl, "utf8");
const flagAdapterSource = readFileSync(flagAdapterUrl, "utf8");
const flagRoute = tsxCode(flagRouteUrl);
const flagAdapter = tsxCode(flagAdapterUrl);
const countries = tsxCode(countriesUrl);

function parse(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function descendants<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

function exportedFunction(source: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const declaration = source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (declaration === undefined) throw new Error(`Missing function ${name}`);
  return declaration;
}

/** Every `/maps/...svg` literal the locator component ships. */
const mapUrls = [...locator.matchAll(/"(\/maps\/[^"]+\.svg)"/g)].map((m) => m[1]!);

describe("map route URLs", () => {
  it("ships exactly the four base-map URLs (two maps × two locales)", () => {
    expect(new Set(mapUrls).size).toBe(4);
  });

  it.each([
    ["/maps/tr-provinces.svg"],
    ["/maps/tr-provinces.en.svg"],
    ["/maps/world-countries.svg"],
    ["/maps/world-countries.en.svg"],
  ])("still ships %s", (url) => {
    expect(mapUrls).toContain(url);
  });

  it("has a route handler behind every URL it ships", () => {
    for (const url of mapUrls) {
      const route = new URL(`../app${url}/route.ts`, import.meta.url);
      expect(existsSync(route), `${url} -> app${url}/route.ts`).toBe(true);
    }
  });

  it("keeps the dot in the EN directory names, which is what skips the locale rewrite", () => {
    // Not cosmetic: proxy.ts's matcher excludes any path containing a dot. Rename these to
    // `world-countries-en` and next-intl rewrites the URL into a locale prefix.
    for (const url of mapUrls.filter((u) => u.includes(".en."))) {
      expect(url).toMatch(/\.en\.svg$/);
    }
  });

  it.each([
    ["/maps/tr-provinces.svg", 'buildTrBaseMapSvg("tr")'],
    ["/maps/tr-provinces.en.svg", 'buildTrBaseMapSvg("en")'],
    ["/maps/world-countries.svg", 'buildWorldBaseMapSvg("tr")'],
    ["/maps/world-countries.en.svg", 'buildWorldBaseMapSvg("en")'],
  ])("maps %s to the intended builder kind and locale", (url, call) => {
    const route = readFileSync(new URL(`../app${url}/route.ts`, import.meta.url), "utf8");
    expect(route).toContain(call);
  });
});

describe("flag route URL", () => {
  it("builds its src from the /flags/{ISO}.svg template the route serves", () => {
    // The route's param carries the extension (see its docblock), and the handler's runtime
    // corpus gate consumes this normalized value — so the case and suffix are load-bearing.
    expect(flagCard).toMatch(/src=\{`\/flags\/\$\{isoCode\.trim\(\)\.toUpperCase\(\)\}\.svg`\}/);
  });

  it("has the dynamic route directory behind it", () => {
    expect(existsSync(new URL("../app/flags/[flag]/route.ts", import.meta.url))).toBe(true);
  });

  it("keeps the public handler mechanically bound to the complete gated response", () => {
    expect(flagRoute).toMatch(/export const dynamicParams = true/);
    expect(flagRoute).not.toMatch(/\breadFlagSvg\b|\breadFileSync\b/);

    const source = parse(flagRouteSource, "route.ts");
    const handler = exportedFunction(source, "GET");
    const returns = descendants(handler, ts.isReturnStatement);
    expect(returns).toHaveLength(1);
    expect(returns[0]?.expression?.getText(source)).toBe("flagResponseForRequest(flag)");
    expect(descendants(handler, ts.isCallExpression)).toHaveLength(1);
  });

  it("injects the sole byte reader only into the collectible gate", () => {
    expect(flagAdapter).not.toMatch(/\breadFileSync\b/);
    const source = parse(flagAdapterSource, "flag-route.server.ts");
    const decision = exportedFunction(source, "flagResponseForRequest");
    const topLevelFunctions = source.statements.filter(ts.isFunctionDeclaration);
    expect(topLevelFunctions.map((declaration) => declaration.name?.text)).toEqual([
      "flagResponseForRequest",
    ]);

    const gateCalls = descendants(
      decision,
      (node): node is ts.CallExpression =>
        ts.isCallExpression(node) && node.expression.getText(source) === "loadFlagSvgForRequest",
    );
    expect(gateCalls).toHaveLength(1);

    const gateResults = descendants(
      decision,
      (node): node is ts.VariableDeclaration =>
        ts.isVariableDeclaration(node) && node.name.getText(source) === "svg",
    );
    expect(gateResults).toHaveLength(1);
    expect(gateResults[0]?.initializer?.getText(source)).toBe(
      `await ${gateCalls[0]?.getText(source)}`,
    );

    const injectedReaders = descendants(
      gateCalls[0]!,
      (node): node is ts.PropertyAssignment =>
        ts.isPropertyAssignment(node) && node.name.getText(source) === "readSvg",
    );
    expect(injectedReaders).toHaveLength(1);
    expect(injectedReaders[0]?.initializer.getText(source)).toBe("readFlagSvg");

    // Module-wide: exactly the import identifier plus the one gated injection. A sibling
    // helper cannot gain a second reader reference while this assertion stays green.
    const readerReferences = descendants(
      source,
      (node): node is ts.Identifier => ts.isIdentifier(node) && node.text === "readFlagSvg",
    );
    expect(readerReferences).toHaveLength(2);
  });

  it("derives every SVG response body from the collectible gate result", () => {
    const source = parse(flagAdapterSource, "flag-route.server.ts");
    const decision = exportedFunction(source, "flagResponseForRequest");
    // Module-wide: a sibling helper cannot construct an extra response outside the decision
    // subtree. The decision itself may return only its two locally constructed responses.
    const responses = descendants(
      source,
      (node): node is ts.NewExpression =>
        ts.isNewExpression(node) && node.expression.getText(source) === "Response",
    );
    const bodies = responses.map((response) => response.arguments?.[0]?.getText(source));
    expect(bodies).toEqual(['"Not found"', "svg"]);

    const returns = descendants(decision, ts.isReturnStatement);
    expect(returns).toHaveLength(2);
    for (const statement of returns) {
      const expression = statement.expression;
      if (expression === undefined || !ts.isNewExpression(expression)) {
        throw new Error("flagResponseForRequest may return only a locally constructed Response");
      }
      expect(expression.expression.getText(source)).toBe("Response");
    }
  });

  it("keeps the no-link flag SVG on the stricter bare sandbox", () => {
    expect(flagAdapter).toContain("default-src 'none'; style-src 'unsafe-inline'; sandbox");
    expect(flagAdapter).not.toContain("allow-popups");
  });

  it("binds pre-seed Data Cache recovery and origin 404 recovery to the same 60 seconds", () => {
    // Both accessors use the identical request key. The flag-specific call's shorter
    // revalidate therefore evaluates a list cached by the ordinary accessor before a seed.
    expect(countries.match(/apiGet<CountryListItem\[]>\("\/api\/countries"/g)).toHaveLength(2);
    expect(countries).toMatch(
      /getCountriesForFlagAuthorization[\s\S]*?apiGet<CountryListItem\[]>\("\/api\/countries",\s*\{\s*revalidate: 60/,
    );
    expect(flagRoute).toMatch(/export const revalidate = 60/);
    expect(flagAdapter).toContain("getCountriesForFlagAuthorization()");
    expect(flagRoute).toContain("flagResponseForRequest(flag)");
  });
});

describe("baseMapResponse headers", () => {
  // The only thing the four map routes add on top of the tested builders, and untested until
  // now. A dropped Content-Type means browsers refuse the SVG inside `<img>` and every locator
  // map on 280 pages goes blank with CI green; the other three are the caching and containment
  // decisions this range made deliberately.
  const response = baseMapResponse("<svg/>");

  it.each([
    ["Content-Type", "image/svg+xml; charset=utf-8"],
    ["Cache-Control", "public, max-age=604800"],
    ["X-Content-Type-Options", "nosniff"],
  ])("sets %s", (header, value) => {
    expect(response.headers.get(header)).toBe(value);
  });

  it("sandboxes the SVG it serves", () => {
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });
});
