import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATEGORIES, EXEMPT_FILES } from "./registry";

const dirOf = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

function basenamesIn(rel: string): string[] {
  return readdirSync(dirOf(rel))
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => f.replace(/\.tsx$/, ""));
}

const ON_DISK = [...basenamesIn("../ui"), ...basenamesIn("../patterns")].filter(
  (name) => !EXEMPT_FILES.includes(name),
);

const LISTED = CATEGORIES.flatMap((category) => category.components);

/**
 * The staleness tripwire.
 *
 * A design system dies by drifting: a component ships, nobody adds its specimen, and the
 * showcase slowly stops describing the code. These assertions make that a failing test
 * instead of a discovery six months later.
 *
 * What this does NOT claim: that a specimen exercises every variant. Proving that needs
 * rendering, which this suite has no jsdom for. The gap is accepted and written down here
 * rather than left implied.
 *
 * What it USED to not claim, and now does: that a listed component is actually rendered
 * anywhere. "Every component has a specimen" only reconciled the registry against the
 * FILESYSTEM — a name in the registry and a file in `components/ui` were enough to satisfy
 * it. `dropdown-menu` and `custom-select` passed every assertion here while appearing in no
 * specimen at all; the index cards counted them, so two categories advertised one more
 * component than they showed. `docs/design.md` claimed this file already caught that. It did
 * not, so the claim is now true instead of the documentation being wrong.
 */
describe("showcase coverage", () => {
  it("positive control — both directories were actually read", () => {
    expect(ON_DISK.length).toBeGreaterThan(15);
    expect(ON_DISK).toContain("button");
  });

  it("every component has a specimen", () => {
    const missing = ON_DISK.filter((name) => !LISTED.includes(name));
    expect(missing, `no showcase category lists: ${missing.join(", ")}`).toEqual([]);
  });

  // Re-enabled at the end of phase D, as planned. It was skipped while the registry listed
  // components nobody had built yet — the registry IS the worklist, so it named all fifteen
  // from the start and this assertion is what turned it into one.
  it("every listed component exists on disk", () => {
    const phantom = LISTED.filter((name) => !ON_DISK.includes(name));
    expect(phantom, `listed but no file: ${phantom.join(", ")}`).toEqual([]);
  });

  it("no component is listed in two categories", () => {
    const seen = new Set<string>();
    const duplicated = LISTED.filter((name) => {
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });
    expect(duplicated).toEqual([]);
  });

  it("category slugs are unique", () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
  });

  /**
   * The assertion the docs already promised. A registry entry is a claim that the showcase
   * SHOWS the component, and the index card turns that claim into a number the reader can
   * count against what is on screen.
   *
   * Matching on the PascalCase symbol rather than the slug is what makes it real: the slug
   * appears in the registry and in the file path, so a slug search would pass on a component
   * nobody imported. The symbol only appears where the component is actually used.
   */
  const SPECIMENS = readdirSync(fileURLToPath(new URL("./specimens/", import.meta.url)))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(fileURLToPath(new URL(`./specimens/${f}`, import.meta.url)), "utf8"))
    .join("\n");

  /**
   * Two files export something other than the PascalCase of their own name, and both are real
   * rather than sloppy: `sonner.tsx` exports the `Toaster` mount and is DEMONSTRATED by the
   * imperative `toast()` call that raises one, and `typography.tsx` is a module of several
   * small components with no single wrapper. Named here so the rule stays strict; a guess
   * dressed up as a convention would just move the blind spot.
   *
   * A needle beginning with `<` is a JSX TAG and is matched with {@link rendersJsxTag}, not with
   * `String.includes` — the same prefix collision that rule was written for, one door along.
   * `"<H1Display".includes("<H1")` is `true`, so once `typography.tsx` grew a second heading tier
   * (T-035 PR3) a specimen rendering only `<H1Display` would have satisfied the `"<H1"` needle and
   * the hub tier could have gone unrendered with this green. Not live — `duzen.tsx` renders both —
   * and closed here rather than left as a note, because the collision arrived with this branch.
   * `sonner`'s needles are call expressions rather than tags and keep plain substring matching.
   */
  const SYMBOL_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
    sonner: ["toast.success(", "toast.info(", "toast.error("],
    typography: ["<H1", "<H2", "<Lede", "<Kbd"],
  };

  const pascal = (slug: string) =>
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

  /**
   * A real JSX tag boundary, not a bare substring — review round 1's finding.
   * `SPECIMENS.includes("<Breadcrumbs")` is `true` the moment any specimen writes
   * `<BreadcrumbsNav`, because `"<BreadcrumbsNav".includes("<Breadcrumbs")` is `true`: one is a
   * text prefix of the other. That let the `"breadcrumbs"` entry pass this check while
   * `Breadcrumbs` itself was rendered nowhere — `BreadcrumbsServerSpecimen` (`components/
   * showcase/specimens/breadcrumbs-server.tsx`) now renders the real thing, so this fix is
   * belt-and-braces rather than the only fix, but the collision was real and general: any two
   * components sharing a name PREFIX (`Table`/`TableSkeleton`, `Card`/`CardHeader`, the next
   * pair nobody has written yet) hits the identical hole. A tag name is followed by whitespace,
   * `>`, or `/` (self-closing) — never another identifier character — so requiring that next
   * character closes it for every pair, not just this one.
   */
  const rendersJsxTag = (source: string, tagName: string): boolean =>
    new RegExp(`<${tagName}(?![A-Za-z0-9_])`).test(source);

  it("positive control — the specimen sources were actually read", () => {
    expect(SPECIMENS.length).toBeGreaterThan(5000);
    expect(SPECIMENS).toContain("<Specimen");
  });

  it("the tag-boundary matcher rejects a prefix collision — regression control", () => {
    // The exact shape of the bug this closes: `<BreadcrumbsNav` must NOT satisfy `Breadcrumbs`.
    expect(rendersJsxTag("<BreadcrumbsNav items={x} />", "Breadcrumbs")).toBe(false);
    // And the pair this repo actually grew: `<H1Display` must NOT satisfy the `"<H1"` override.
    // `"<H1Display".includes("<H1")` is `true`, which is why the override needles are matched with
    // this rule rather than with `String.includes`.
    expect(rendersJsxTag("<H1Display>x</H1Display>", "H1")).toBe(false);
    expect(rendersJsxTag("<H1>x</H1>", "H1")).toBe(true);
  });

  it("both typography heading tiers are rendered by a specimen, not just the prefix", () => {
    // The override list carries `"<H1"` only, and `H1Display` is a separate exported tier with its
    // own `<h1>` spelling — `components/v2/page-composition-headings.test.ts` pins both. A specimen
    // rendering neither would leave the showcase claiming to demonstrate a module it does not.
    expect(rendersJsxTag(SPECIMENS, "H1")).toBe(true);
    expect(rendersJsxTag(SPECIMENS, "H1Display")).toBe(true);
  });

  it("the tag-boundary matcher accepts every real boundary a tag can end on", () => {
    expect(rendersJsxTag("<Breadcrumbs items={x} />", "Breadcrumbs")).toBe(true);
    expect(rendersJsxTag("<Breadcrumbs>", "Breadcrumbs")).toBe(true);
    expect(rendersJsxTag("<Breadcrumbs\n  items={x}\n/>", "Breadcrumbs")).toBe(true);
  });

  it.each(LISTED.filter((name) => !EXEMPT_FILES.includes(name)))(
    "%s is rendered by a specimen, not merely listed",
    (name) => {
      const overrides = SYMBOL_OVERRIDES[name];
      const found = overrides
        ? overrides.some((needle) =>
            // A tag needle gets the boundary rule; a call-expression needle stays a substring.
            needle.startsWith("<")
              ? rendersJsxTag(SPECIMENS, needle.slice(1))
              : SPECIMENS.includes(needle),
          )
        : rendersJsxTag(SPECIMENS, pascal(name));
      expect(
        found,
        overrides
          ? `${name} is in the registry but no specimen uses ${overrides.join(" or ")}`
          : `${name} is in the registry but no specimen renders <${pascal(name)}`,
      ).toBe(true);
    },
  );
});

/* ---------------------------------------------------------------------------------------------
 * THE ROSTER IN `docs/design.md`
 * ------------------------------------------------------------------------------------------ */

/**
 * `docs/design.md` NAMES EXACTLY THE FILES UNDER `components/patterns/`.
 *
 * That roster is a hand-written list sitting beside a directory that declares the set, which is
 * the shape this repo has already paid for twice in the same paragraph: the list pointed at a
 * `map-attribution` with no product consumer at all (T-042), and it went on naming `callout`,
 * `empty-state`, `map-legend` and `theme-pair` after they were deleted or moved. A roster that
 * can be wrong without anything failing is documentation of a tree that does not exist — the
 * exact defect class `components/orphan.test.ts` and `orphan-stylesheets.test.ts` measure one
 * level down.
 *
 * Both directions, because they fail differently. A file the roster omits is a component nobody
 * reading the docs knows exists; a name with no file is a reader sent to a path that 404s.
 *
 * Located by HEADING and by the bullet's own label, never by line number: a paragraph added above
 * it must not move the check onto some other list. Everything outside the `## Components` section
 * is out of range, as is the `components/ui/` bullet beside it (CLI-managed, a different rule) and
 * the `components/showcase/` one below it (the `/design-system` route's own machinery, which is
 * where `theme-pair` legitimately lives).
 */
const DESIGN_MD = readFileSync(
  fileURLToPath(new URL("../../docs/design.md", import.meta.url)),
  "utf8",
);

const COMPONENTS_HEADING = "## Components";
const PATTERNS_BULLET = "- **`components/patterns/`**";

/**
 * The backticked names in the patterns bullet, from any markdown — a PURE function of its
 * argument, so the controls below can ask it about a document nobody wrote. A reader that can only
 * be run over the real file cannot be shown to work: every answer it gives is the answer that file
 * happens to want.
 *
 * A parenthetical names an EXPORT rather than a file (`typography` ships `Kbd`), so parenthesised
 * spans are dropped before the names are read; continuation lines are indented, so the bullet is
 * taken to the first line that is not.
 */
function rosterIn(markdown: string): string[] {
  const heading = markdown.indexOf(`\n${COMPONENTS_HEADING}\n`);
  if (heading === -1) return [];
  const rest = markdown.slice(heading + 1);
  const next = rest.search(/\n## /);
  const lines = (next === -1 ? rest : rest.slice(0, next)).split("\n");
  const at = lines.findIndex((line) => line.startsWith(PATTERNS_BULLET));
  if (at === -1) return [];
  const bullet = [lines[at]!];
  for (let i = at + 1; i < lines.length && /^\s{2,}\S/.test(lines[i]!); i += 1) {
    bullet.push(lines[i]!);
  }
  const text = bullet
    .join(" ")
    .slice(PATTERNS_BULLET.length)
    .replace(/\([^)]*\)/g, "");
  return [...text.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]!);
}

const ROSTER = rosterIn(DESIGN_MD);
const PATTERN_FILES = basenamesIn("../patterns");

/**
 * A document with the same SHAPE as `docs/design.md` and none of its content. Every structural
 * decision above is asserted against it: the `## Components` boundary (`delta` is outside it), the
 * bullet label (`theme-pair` belongs to the showcase bullet), the parenthetical rule (`Kbd`), and
 * the indented continuation (`gamma`).
 */
const SYNTHETIC_DOC = [
  "# doc",
  "",
  "## Components",
  "",
  "- **`components/ui/`** — CLI-managed: `button`.",
  "- **`components/patterns/`** — written here: `alpha` (with `Kbd`), `beta`,",
  "  `gamma`.",
  "- **`components/showcase/`** — `specimen`, `theme-pair`.",
  "",
  "## Next section",
  "",
  "- `delta` lives outside the section.",
].join("\n");

describe("docs/design.md's components/patterns/ roster", () => {
  it("positive control — the roster was located and parsed", () => {
    expect(ROSTER.length, "names read out of the patterns bullet").toBeGreaterThan(5);
    expect(ROSTER).toContain("typography");
    expect(PATTERN_FILES.length, "files under components/patterns/").toBeGreaterThan(5);
  });

  it("reads the patterns bullet and nothing around it", () => {
    expect(rosterIn(SYNTHETIC_DOC)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("a name dropped from the roster stops being read — the control", () => {
    expect(rosterIn(SYNTHETIC_DOC.replace(" `beta`,", ""))).toEqual(["alpha", "gamma"]);
  });

  it("a name with no file is still read, so it can be reported — the control", () => {
    expect(rosterIn(SYNTHETIC_DOC.replace("`gamma`.", "`gamma`, `ghost`."))).toContain("ghost");
  });

  it("names every file under components/patterns/", () => {
    const missing = PATTERN_FILES.filter((name) => !ROSTER.includes(name));
    expect(missing, `components/patterns/ file absent from docs/design.md: ${missing}`).toEqual([]);
  });

  it("names nothing that is not a file under components/patterns/", () => {
    const phantom = ROSTER.filter((name) => !PATTERN_FILES.includes(name));
    expect(phantom, `docs/design.md names a pattern with no file: ${phantom}`).toEqual([]);
  });
});

/**
 * The showcase's own page-level guarantees.
 *
 * Both are cheap and both were wrong: eight routes shared one generic `<title>`, in a tool
 * whose whole purpose is comparing things across tabs; and the `noindex` came only from the
 * parent layout, which is fragile in one specific way — T-032 PR3 removes the V2 layout's
 * blanket `noindex` and replaces it with "a route that must stay out of the index carries its
 * own `surface: noindex`". Internal tooling is not public content.
 */
describe("showcase routes", () => {
  const page = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

  const INDEX = "../../app/[locale]/design-system/page.tsx";
  const CATEGORY = "../../app/[locale]/design-system/[category]/page.tsx";

  it("positive control — both page files were read", () => {
    expect(page(INDEX)).toContain("DesignSystemIndexPage");
    expect(page(CATEGORY)).toContain("DesignSystemCategoryPage");
  });

  it.each([INDEX, CATEGORY])("%s declares its own noindex surface", (rel) => {
    expect(page(rel)).toContain('surface: "noindex"');
  });

  it("the category title is derived from the registry, not hand-maintained", () => {
    expect(page(CATEGORY)).toContain("category.title");
  });

  it("each route builds a title of its own", () => {
    for (const rel of [INDEX, CATEGORY]) {
      expect(page(rel)).toContain("generateMetadata");
      expect(page(rel)).toContain("Terra tasarım sistemi");
    }
  });

  it("the specimen heading does not skip a level below the page h1", () => {
    // The category page carries the only h1 and every specimen is its direct child.
    const specimen = readFileSync(
      fileURLToPath(new URL("./specimen.tsx", import.meta.url)),
      "utf8",
    );
    expect(specimen).toContain("<h2");
    expect(specimen).not.toMatch(/<h[3-6]\b/);
  });
});
