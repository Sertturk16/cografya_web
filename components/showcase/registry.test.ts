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

  it("positive control — the specimen sources were actually read", () => {
    expect(SPECIMENS.length).toBeGreaterThan(5000);
    expect(SPECIMENS).toContain("<Specimen");
  });

  it.each(LISTED.filter((name) => !EXEMPT_FILES.includes(name)))(
    "%s is rendered by a specimen, not merely listed",
    (name) => {
      const needles = SYMBOL_OVERRIDES[name] ?? [`<${pascal(name)}`];
      expect(
        needles.some((needle) => SPECIMENS.includes(needle)),
        `${name} is in the registry but no specimen uses ${needles.join(" or ")}`,
      ).toBe(true);
    },
  );
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

  const INDEX = "../../app/[locale]/v2/design-system/page.tsx";
  const CATEGORY = "../../app/[locale]/v2/design-system/[category]/page.tsx";

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
