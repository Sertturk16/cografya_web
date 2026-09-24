import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOLS_SURFACE } from "@/lib/tools/tool-registry";
import { AUTH_SURFACE } from "@/lib/auth/auth-metadata";
import { stripComments } from "@/lib/test-support/strip-comments";
import {
  declarationRegions,
  importBindingsOf,
  jsxElementsOf,
  maskedSource,
  readSource,
  resolvesTo,
  withInjectedSource,
} from "@/lib/test-support/composition-scan";

/**
 * A PAGE IN THE SITEMAP IS NOT `noindex`, AND IT CARRIES THE SURFACE ITS ROW WAS BUILT WITH.
 *
 * ## The rule
 *
 * `app/sitemap.ts` and each page's `generateMetadata` both take a `ContentSurface`. `lib/seo/
 * sitemap-entries.ts` guarantees the head and the sitemap agree — but only about a surface, and
 * only for the value each is handed. Hand one side a different value and the guarantee is intact
 * while the output is contradictory: a URL advertised in `sitemap.xml` whose page says
 * `noindex`, which SEO-POLICY §B6 6.8 calls a BLOCKER.
 *
 * ## Why it was not caught before
 *
 * Nothing compared the two arguments. T-032 PR3 made that expensive: the V2 pages inlined
 * `surface: "noindex"` — correct while they lived under `/v2`, whose layout de-indexed the whole
 * tree — and PR3 moved them onto the canonical URLs `app/sitemap.ts` had been publishing all
 * along. Twelve routes came out of that move advertised and de-indexed at the same time,
 * including the home page, `/turkiye`, `/dunya`, `/deniz`, `/deprem` and the four tool pages.
 *
 * ## Scope
 *
 * Static rows only — the ones written as `sitemapEntriesFor(() => "/path", …)` literals. The
 * dynamic tiers (provinces, countries, books, continents) build their rows in helper functions
 * from api data, so there is no page-file-per-row to compare against; their surfaces are pinned
 * by the tier tests that already exist (`lib/tools/tool-sitemap.test.ts` for the tool tier).
 *
 * A run against a live server is the complete check — every `<loc>` fetched, status and robots
 * meta read — and PR3 did that once by hand across all 307 URLs. This is the part of it that
 * fits in a unit test and runs on every commit.
 */

const repoRoot = new URL("../../", import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, repoRoot)), "utf8");

const SITEMAP = read("app/sitemap.ts");

/** The surface `app/sitemap.ts` passes for each statically-listed pathname. */
const rows = [
  ...SITEMAP.matchAll(/sitemapEntriesFor\(\(\) => "([^"]+)",\s*now,\s*[\d.]+(?:,\s*"([^"]+)")?\)/g),
].map((match) => ({ pathname: match[1]!, surface: match[2] ?? "localized" }));

/**
 * Where each statically-listed pathname's page file lives. Written out rather than derived,
 * because the route-group directories (`(site)`) are not part of the URL — the mapping is
 * exactly the thing a reader cannot infer from the path.
 */
const PAGE_FOR: Record<string, string> = {
  "/": "app/[locale]/(site)/page.tsx",
  "/turkiye": "app/[locale]/(site)/turkiye/page.tsx",
  "/dunya": "app/[locale]/(site)/dunya/page.tsx",
  "/oyun": "app/[locale]/(site)/oyun/page.tsx",
  "/deniz": "app/[locale]/(site)/deniz/page.tsx",
  "/araclar": "app/[locale]/(site)/araclar/page.tsx",
  "/araclar/mesafe-olcme": "app/[locale]/(site)/araclar/mesafe-olcme/page.tsx",
  "/araclar/koordinat-bulma": "app/[locale]/(site)/araclar/koordinat-bulma/page.tsx",
  "/araclar/alan-hesaplama": "app/[locale]/(site)/araclar/alan-hesaplama/page.tsx",
  "/deprem": "app/[locale]/(site)/deprem/page.tsx",
  "/dunya/kita": "app/[locale]/(site)/dunya/kita/page.tsx",
  "/hakkimizda": "app/[locale]/(site)/hakkimizda/page.tsx",
  "/kullanim-sartlari": "app/[locale]/(site)/kullanim-sartlari/page.tsx",
  "/gizlilik": "app/[locale]/(site)/gizlilik/page.tsx",
  "/turkiye/bolge": "app/[locale]/(site)/turkiye/bolge/page.tsx",
  "/deniz/marmara": "app/[locale]/(site)/deniz/marmara/page.tsx",
  "/deniz/ege": "app/[locale]/(site)/deniz/ege/page.tsx",
  "/deniz/akdeniz": "app/[locale]/(site)/deniz/akdeniz/page.tsx",
  "/deniz/karadeniz": "app/[locale]/(site)/deniz/karadeniz/page.tsx",
  "/deniz/kiyi-tipleri": "app/[locale]/(site)/deniz/kiyi-tipleri/page.tsx",
  "/deprem/fay-hatlari": "app/[locale]/(site)/deprem/fay-hatlari/page.tsx",
  "/deprem/hazirlik": "app/[locale]/(site)/deprem/hazirlik/page.tsx",
};

/** Every `ContentSurface` the tree writes — one list, used by the spread pin and the resolver. */
const KNOWN_SURFACES = ["localized", "noindex", "trNarrative", "trOnly"] as const;

/**
 * The surface a page file declares: the literal in its `buildMetadata` call, the tool tier's
 * shared constant, or — when it passes none — `buildMetadata`'s own default.
 *
 * COMMENTS ARE STRIPPED FIRST (`docs/conventions.md`). A docblock explaining why a page is
 * `surface: "noindex"` is prose that satisfies the pattern, and this function's answer feeds the
 * pair check below, where a wrong answer reads as agreement rather than as a parse failure.
 *
 * THE `"localized"` FALLBACK IS LOAD-BEARING AND POINTS THE SILENT WAY. It is `buildMetadata`'s
 * own default, so it is the right answer for a page that calls `buildMetadata` and passes no
 * `surface` — and it is also what a page with NO metadata call at all would get, and what a
 * regression in either pattern above would give every page. In the breadcrumb half that reads as
 * AGREEMENT wherever the trail also says `"localized"`. Two things keep it honest: the spread pin
 * ("classifies the surfaces it finds, rather than defaulting everything") fails if every page
 * collapses onto one value, and the control below asserts that all 34 `(site)` pages really do
 * call `buildMetadata`/`buildAuthMetadata`, so the fallback can only ever mean "defaulted", never
 * "not declared".
 */
const declaredSurface = (raw: string): string => {
  const source = stripComments(raw);
  const literal = /surface: "([^"]+)"/.exec(source);
  if (literal !== null) return literal[1]!;
  if (/surface: TOOLS_SURFACE/.test(source)) return TOOLS_SURFACE;
  // The seven auth shells never call `buildMetadata` directly — `lib/auth/auth-metadata.ts`
  // gate G1 pins that — so they carry no `surface:` literal of their own and would otherwise
  // read as the default `"localized"`, i.e. as nine indexable pages missing from the sitemap.
  if (/buildAuthMetadata\(/.test(source)) return AUTH_SURFACE;
  return "localized";
};

/**
 * THE OTHER DIRECTION: a page that is indexable and NOT in the sitemap.
 *
 * Everything above walks sitemap-row → page. That direction cannot see a page which is
 * crawlable, in the hreflang set, linked from the nav — and simply never advertised. Nine were:
 * `/turkiye/bolge` and its seven regions, the four sea basins, `/deniz/kiyi-tipleri`,
 * `/deprem/fay-hatlari` and `/deprem/hazirlik`, each declaring `"trOnly"` in its own
 * `generateMetadata` while `app/sitemap.ts` listed none of them.
 *
 * What made it invisible rather than merely wrong: `PAGE_FOR` is the test's whole notion of
 * which pages exist, and it held twelve of the tree's thirty-nine. A page absent from BOTH the
 * sitemap and `PAGE_FOR` was absent from the test. So this half does not consult `PAGE_FOR` at
 * all — it walks the route tree.
 */
const ROUTE_ROOT = fileURLToPath(new URL("app/[locale]/", repoRoot));

const walkPages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });

/** `app/[locale]/(site)/deniz/ege/page.tsx` → `/deniz/ege`; route groups are not URL segments. */
const pathnameOf = (file: string): string => {
  const segments = file
    .slice(ROUTE_ROOT.length)
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((segment) => segment !== "" && !segment.startsWith("("));
  return `/${segments.join("/")}`;
};

const pages = walkPages(ROUTE_ROOT).map((file) => ({
  file: file.slice(fileURLToPath(repoRoot).length),
  pathname: pathnameOf(file),
  surface: declaredSurface(readFileSync(file, "utf8")),
}));

/**
 * Indexable pathnames that legitimately have no STATIC sitemap row, each with the tier that
 * builds its rows instead. Exact in both directions: a new dynamic route must be named here, and
 * a route that stops being dynamic must be removed.
 */
const DYNAMIC_TIERS: Record<string, string> = {
  "/turkiye/[slug]": "provinceEntries()",
  "/dunya/[slug]": "countryEntries()",
  "/kitaplar/[slug]": "bookSitemapEntries()",
  "/dunya/kita/[slug]": "continentEntries()",
  "/turkiye/bolge/[slug]": "regionEntries()",
  "/kitaplar": "bookSitemapEntries() — the hub row ships with its tier",
};

describe("the static sitemap rows and the pages they point at", () => {
  it("finds every row and knows where its page lives", () => {
    // Anti-vacuity in both directions: a regex that stopped matching would check nothing, and a
    // row added to the sitemap without an entry here would be skipped silently.
    expect(rows.length, "static sitemapEntriesFor rows").toBeGreaterThan(10);
    for (const row of rows) {
      expect(
        PAGE_FOR[row.pathname],
        `no page mapped for sitemap row ${row.pathname}`,
      ).toBeDefined();
    }
    expect(Object.keys(PAGE_FOR).sort(), "PAGE_FOR has an entry with no sitemap row").toEqual(
      rows.map((row) => row.pathname).sort(),
    );
  });

  it("never advertises a page that de-indexes itself", () => {
    for (const row of rows) {
      expect(row.surface, `${row.pathname} is published as noindex`).not.toBe("noindex");
      expect(
        declaredSurface(read(PAGE_FOR[row.pathname]!)),
        `${row.pathname} is in the sitemap but its page declares noindex`,
      ).not.toBe("noindex");
    }
  });

  it("hands the page and the row the SAME surface", () => {
    for (const row of rows) {
      expect(
        declaredSurface(read(PAGE_FOR[row.pathname]!)),
        `${row.pathname}: page and sitemap row disagree`,
      ).toBe(row.surface);
    }
  });
});

describe("every indexable page is advertised somewhere", () => {
  it("walks the whole route tree, not a hand-kept subset", () => {
    // Anti-vacuity, and the specific failure this half exists for: `PAGE_FOR` held twelve of
    // thirty-nine pages, so a page missing from both it and the sitemap was outside the test.
    expect(pages.length, "page.tsx files under app/[locale]").toBeGreaterThan(35);
    expect(pages.length).toBeGreaterThan(Object.keys(PAGE_FOR).length);
    expect(pages.map((page) => page.pathname)).toContain("/turkiye/bolge");
  });

  it("classifies the surfaces it finds, rather than defaulting everything", () => {
    // If `declaredSurface` silently stopped matching, every page would read `"localized"` and
    // the assertion below would demand a sitemap row for all thirty-nine — loud, but for the
    // wrong reason. Pinning the spread keeps the parser honest.
    const bySurface = new Set(pages.map((page) => page.surface));
    expect([...bySurface].sort()).toEqual([...KNOWN_SURFACES].sort());
  });

  it("has a sitemap row, a dynamic tier, or a noindex surface — never nothing", () => {
    const advertised = new Set(rows.map((row) => row.pathname));
    const unadvertised = pages
      .filter((page) => page.surface !== "noindex")
      .filter((page) => !advertised.has(page.pathname))
      .filter((page) => !(page.pathname in DYNAMIC_TIERS))
      .map((page) => `${page.pathname} (${page.surface}) — ${page.file}`);
    expect(unadvertised, "indexable, linked, and in no sitemap").toEqual([]);
  });

  it("names no dynamic tier that has stopped being a route", () => {
    // The ratchet's other direction: a tier entry that no longer matches a real page would let
    // a future route inherit the exemption by sharing its pathname.
    const real = new Set(pages.map((page) => page.pathname));
    const phantom = Object.keys(DYNAMIC_TIERS).filter((pathname) => !real.has(pathname));
    expect(phantom, "DYNAMIC_TIERS names a route that does not exist").toEqual([]);
  });
});

/* -------------------------------------------------------------------------------------------
 * THE SECOND PLACE A PAGE TYPES ITS SURFACE
 * ---------------------------------------------------------------------------------------- */

/**
 * A PAGE'S `buildMetadata` SURFACE AND ITS BREADCRUMB SURFACE ARE THE SAME SURFACE.
 *
 * ## What was unguarded
 *
 * Everything above reads `surface: "…"` — the object property. The same value is typed a SECOND
 * time on the same page as a JSX prop, `<Breadcrumbs … surface="…">`, and nothing compared the
 * two. `components/patterns/breadcrumbs.tsx` said so in its own docblock and offered the only
 * assurance available at the time: the pairs "were checked by hand at review time". A hand check
 * is a measurement, not a guarantee — it says nothing about the next page.
 *
 * The consequence of a disagreement is not cosmetic. `Breadcrumbs` computes `isIndexable` from
 * the surface it is handed, so a page whose metadata says `noindex` and whose breadcrumb says
 * `trOnly` emits BreadcrumbList JSON-LD for a URL it has asked crawlers to drop — structured
 * data advertising a page that de-indexes itself, the same contradiction the sitemap half of
 * this file exists to catch, one argument over.
 *
 * ## Derived, not listed
 *
 * The population is every `page.tsx` under `app/[locale]/(site)`. A page with no `<Breadcrumbs>`
 * has no pair and drops out by derivation: the three `(play)` game screens live outside the
 * walk (their trail is rendered by `V2GameScreen`, which takes no surface), and `(site)/page.tsx`
 * is inside it and simply renders no trail. Neither is written down as an exemption, so neither
 * can quietly cover a page that grows one.
 *
 * ## The constant is resolved, not compared as text
 *
 * `araclar/**` writes `TOOLS_SURFACE` on both sides and the seven auth pages write `AUTH_SURFACE`
 * on the JSX side against a `buildAuthMetadata()` call with no literal at all on the other. A
 * text comparison would read those as disagreements and the cheapest green would be to stop
 * checking them — so an identifier is resolved through `composition-scan.ts`'s binding resolver
 * (import clause → declaration region → the string it initialises) and the RESOLVED values are
 * compared. {@link surfaceOfToken} refuses to invent one: a token that resolves to nothing outside
 * {@link KNOWN_SURFACES} fails the suite rather than comparing equal to itself.
 */
const SITE_ROOT = join(ROUTE_ROOT, "(site)");

/** The one module a `<Breadcrumbs>` tag must resolve to. */
const BREADCRUMBS_MODULE = fileURLToPath(new URL("components/patterns/breadcrumbs.tsx", repoRoot));

const sitePages = walkPages(SITE_ROOT).sort();

const relative = (file: string) => file.slice(fileURLToPath(repoRoot).length);

/**
 * An identifier resolved to the string it names, or the token itself when it names nothing.
 *
 * Both hops are `composition-scan.ts`'s, so this is the same resolver the composition counters
 * walk imports with — not a second one written here, which is the shape T-045 exists to prevent.
 */
const surfaceOfToken = (file: string, token: string): string => {
  const binding = importBindingsOf(file).get(token);
  const target = binding?.name != null ? binding : { file, name: token };
  const region = declarationRegions(target.file).get(target.name!);
  if (region === undefined) return token;
  const initialiser = /=\s*"([^"]*)"/.exec(readSource(target.file).slice(region[0], region[1]));
  return initialiser === null ? token : initialiser[1]!;
};

type SurfacePair = { readonly file: string; readonly jsx: string; readonly metadata: string };

/**
 * Every place a `(site)` page writes a breadcrumb surface beside a metadata surface.
 *
 * TWO SPELLINGS, because the tree has two. Most pages render `<Breadcrumbs surface={…}>`; the four
 * `deniz/{akdeniz,ege,karadeniz,marmara}` pages cannot — their view is a Client Component — and
 * call `breadcrumbListSchema(items, locale, …)` instead, which takes the identical surface as its
 * third POSITIONAL argument. Reading only the JSX prop would leave those four unguarded while this
 * docblock claimed otherwise.
 *
 * Read through `readSource`/`jsxElementsOf` rather than `readFileSync` so the injection harness
 * can put a disagreeing page in front of it — see the control below.
 */
/**
 * The surface argument of a `breadcrumbListSchema(…)` call — THE LAST ONE, by the closing paren,
 * not the third by position. `\)` anchors the capture to the end of the argument list, so the
 * pattern does not have to know how many arguments precede it and does not silently read the
 * wrong one if a fourth is ever added; it would stop matching instead, which the pinned
 * {@link SCHEMA_SURFACE_PAIRS} count turns into a failure.
 *
 * RUN OVER {@link maskedSource} to decide WHERE a call is, then read the argument out of the RAW
 * source over the same span (`maskLiterals` preserves length, so the two are index-identical).
 * Masking is what stops a string literal that merely CONTAINS the call text — a docblock is
 * already stripped, but a `const USAGE = 'breadcrumbListSchema(items, locale, "noindex")'` would
 * not be — from contributing a pair. The raw read-back is necessary because all four live call
 * sites pass a string LITERAL (`"trOnly"`), whose contents masking blanks to spaces; a capture
 * taken from the masked text would come back as six spaces. Two patterns rather than one with the
 * `d` flag, which this repo's compile target predates.
 */
const SCHEMA_CALL = /breadcrumbListSchema\([^()]*,\s*(?:[A-Za-z0-9_$]+|"[^"]*")\s*\)/g;

/** The same last argument, re-read from the raw text of one matched call. */
const SCHEMA_LAST_ARG = /,\s*([A-Za-z0-9_$]+|"[^"]*")\s*\)$/;

const pairsIn = (file: string): SurfacePair[] => {
  const source = readSource(file);
  const metadata = declaredSurface(source);
  const jsxProps = jsxElementsOf(file)
    .filter((element) => element.tag === "Breadcrumbs")
    .map((element) => element.attributes.get("surface"));
  const schemaArgs = [...maskedSource(file).matchAll(SCHEMA_CALL)].map((match) => {
    const raw = source.slice(match.index, match.index + match[0].length);
    const argument = SCHEMA_LAST_ARG.exec(raw);
    // Never dropped silently: an unreadable call becomes a token no surface classifier knows, so
    // "never reads a surface it cannot classify" fails on it instead of the pair vanishing.
    return argument === null ? "(unreadable schema argument)" : argument[1]!.replace(/"/g, "");
  });
  return [...jsxProps, ...schemaArgs].map((token) => ({
    file,
    jsx: token === undefined ? "(no surface prop)" : surfaceOfToken(file, token),
    metadata,
  }));
};

const pairs = sitePages.flatMap(pairsIn);

/**
 * MEASURED, not predicted — 29 `<Breadcrumbs>` props plus 4 `breadcrumbListSchema` arguments over
 * the 34 `(site)` pages, leaving `(site)/page.tsx` as the only one declaring no breadcrumb surface.
 *
 * The plan said 33 and `breadcrumbs.tsx` said 37. 37 was the page COUNT (it still is, and three of
 * those are `(play)`); 33 subtracted the three `(play)` screens and the home page from it and
 * assumed every remaining page renders `<Breadcrumbs>`. Four do not — the `deniz` basin pages go
 * through `breadcrumbListSchema` — so the JSX-prop figure is 29 and the total is 33 only because
 * the four come back in through the other spelling.
 *
 * T-073: 29 → **30**, and 34 `(site)` pages → 35. `/kullanim-sartlari` renders `<Breadcrumbs>`
 * the way `/hakkimizda` does, with the same surface its `buildMetadata` declares (`trOnly`).
 */
// 30 → 31 in T-101: `/gizlilik`.
const BREADCRUMB_SURFACE_PAIRS = 31;
const SCHEMA_SURFACE_PAIRS = 4;

describe("the page's metadata surface and its breadcrumb surface", () => {
  it("found both spellings on a derived page list, and nothing else", () => {
    expect(sitePages.length, "page.tsx files under app/[locale]/(site)").toBeGreaterThan(30);
    const jsx = sitePages.flatMap((file) =>
      jsxElementsOf(file).filter((element) => element.tag === "Breadcrumbs"),
    );
    expect(jsx.length, "<Breadcrumbs> elements").toBe(BREADCRUMB_SURFACE_PAIRS);
    expect(pairs.length - jsx.length, "breadcrumbListSchema call sites").toBe(SCHEMA_SURFACE_PAIRS);
  });

  it("leaves exactly one (site) page declaring no breadcrumb surface", () => {
    // The derivation, stated as the identity it is: every reading page carries a trail, so a page
    // with no pair is news. `(play)` is not listed as an exemption — it is outside the walk.
    const silent = sitePages.filter((file) => pairsIn(file).length === 0).map(relative);
    expect(silent, "a (site) page that declares no breadcrumb surface").toEqual([
      "app/[locale]/(site)/page.tsx",
    ]);
  });

  it("the tag name really is the shared Breadcrumbs — resolved, not matched as text", () => {
    // The JSX side is collected by `element.tag === "Breadcrumbs"`, a TEXT match, while the
    // constant side is resolved through the binding resolver. Left unguarded, that asymmetry is
    // wrong in both directions: a page-local component named `Breadcrumbs` would be counted as
    // the shared one, and `import { Breadcrumbs as Crumbs }` would drop a real trail out of the
    // population with the pinned count falling by one and nothing saying why. Both are closed
    // here rather than in the matcher, so the matcher stays the cheap thing it is.
    const notTheRealOne = sitePages
      .filter((file) => jsxElementsOf(file).some((element) => element.tag === "Breadcrumbs"))
      .filter((file) => {
        const binding = importBindingsOf(file).get("Breadcrumbs");
        return binding === undefined || !resolvesTo(binding, BREADCRUMBS_MODULE, "Breadcrumbs");
      })
      .map(relative);
    expect(notTheRealOne, "a <Breadcrumbs> tag that is not the shared component").toEqual([]);

    const aliased = sitePages.flatMap((file) =>
      [...importBindingsOf(file)]
        .filter(
          ([name, binding]) =>
            name !== "Breadcrumbs" && resolvesTo(binding, BREADCRUMBS_MODULE, "Breadcrumbs"),
        )
        .map(([name]) => `${relative(file)}: ${name}`),
    );
    expect(
      aliased,
      "the shared Breadcrumbs imported under another name — invisible to the tag match",
    ).toEqual([]);
  });

  it("every (site) page declares metadata, so the surface default never means 'absent'", () => {
    // What makes `declaredSurface`'s `"localized"` fallback safe to read as agreement: it can
    // only ever mean "called buildMetadata and passed no surface", never "declared nothing".
    const silent = sitePages
      .filter((file) => !/build(?:Auth)?Metadata\(/.test(readSource(file)))
      .map(relative);
    expect(silent, "a (site) page with no metadata call at all").toEqual([]);
  });

  it("never reads a surface it cannot classify", () => {
    // Anti-vacuity. An unresolved identifier would compare equal to itself on both sides of a
    // pair and pass forever; here it fails on the token.
    const known: readonly string[] = KNOWN_SURFACES;
    const unknown = pairs
      .filter((pair) => !known.includes(pair.jsx))
      .map((pair) => `${relative(pair.file)}: ${pair.jsx}`);
    expect(unknown, "breadcrumb surface that is not a ContentSurface").toEqual([]);
  });

  it("hands the head and the trail the SAME surface", () => {
    const disagreeing = pairs
      .filter((pair) => pair.jsx !== pair.metadata)
      .map((pair) => `${relative(pair.file)}: breadcrumb ${pair.jsx} vs metadata ${pair.metadata}`);
    expect(disagreeing, "a page whose breadcrumb and metadata surfaces disagree").toEqual([]);
  });

  it("resolves a constant instead of comparing its name — the mixed-spelling control", () => {
    // The live mixed case, and the reason text comparison is not an option: the auth pages write
    // an identifier on one side and nothing at all on the other, and they agree.
    const auth = join(SITE_ROOT, "giris/page.tsx");
    const crumb = jsxElementsOf(auth).find((element) => element.tag === "Breadcrumbs");
    expect(crumb?.attributes.get("surface")).toBe("AUTH_SURFACE");
    expect(surfaceOfToken(auth, "AUTH_SURFACE")).toBe(AUTH_SURFACE);
    expect(surfaceOfToken(join(SITE_ROOT, "araclar/page.tsx"), "TOOLS_SURFACE")).toBe(
      TOOLS_SURFACE,
    );
    // A bare literal is not an identifier that names anything, and comes back untouched.
    expect(surfaceOfToken(auth, "trOnly")).toBe("trOnly");
  });

  it("goes RED when the two sides disagree — the liveness control", () => {
    // Derived victim, not a named one: the first page in the walk, mutated on its JSX side only
    // so the metadata side still says what it said. `docs/conventions.md`: an assertion that has
    // never failed has not been shown to work.
    const victim = sitePages.find((file) =>
      jsxElementsOf(file).some((element) => element.tag === "Breadcrumbs"),
    )!;
    const before = pairsIn(victim)[0]!;
    const replacement = before.metadata === "noindex" ? "localized" : "noindex";
    // The element's own span, not a regex over the tag: a `<Home …/>` icon written inside the
    // `items` prop is a `<` between `<Breadcrumbs` and `surface=`, which is enough to defeat one.
    const element = jsxElementsOf(victim).find((item) => item.tag === "Breadcrumbs")!;
    const token = element.attributes.get("surface")!;
    const source = readSource(victim);
    const tag = source.slice(element.start, element.end);
    const written = tag.includes(`surface={${token}}`)
      ? `surface={${token}}`
      : `surface="${token}"`;
    expect(tag, "the surface attribute must be found before it can be mutated").toContain(written);
    const mutated =
      source.slice(0, element.start) +
      tag.replace(written, `surface="${replacement}"`) +
      source.slice(element.end);
    expect(mutated, "the mutation must actually change the page").not.toBe(source);
    const after = withInjectedSource([[victim, mutated]], () => pairsIn(victim));
    expect(after[0]!.jsx).toBe(replacement);
    expect(after.filter((pair) => pair.jsx !== pair.metadata)).not.toEqual([]);
  });
});
