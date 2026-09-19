import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments, stripCssComments } from "@/lib/test-support/strip-comments";

/**
 * DANGLING-TOKEN TRIPWIRE for sticky-header anchor offsets.
 *
 * Every fragment target in this repo offsets itself below the sticky header with
 * `scroll-margin-top: calc(var(--some-header-token) + 1rem)`, and the measurement lives in
 * the global token layer rather than in the component (PR #44 review CR-I2). That indirection
 * has one failure mode, and it is silent: `var(--undefined-token)` makes the whole `calc()`
 * invalid at computed-value time, so the declaration is dropped and the offset becomes ZERO —
 * the jump target lands underneath the header again. Nothing errors, nothing warns, and a
 * screenshot of the page before the jump looks identical.
 *
 * This is not hypothetical here: `--header-height-wrapped` was retired when the mobile nav
 * moved into a disclosure panel, and its one consumer had to move to `--header-height` in the
 * same commit. This test is what makes the next such retirement fail loudly instead.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts that every custom property an anchor
 * offset READS is DECLARED unconditionally in the token layer, never what its value is. It
 * therefore cannot catch a token whose VALUE has gone out of date — that class is caught by
 * measurement at the sample gate and recorded in `DESIGN.md` §4. A test that asserts a
 * constant equals itself would protect nothing.
 */

const GLOBALS = new URL("../app/globals.css", import.meta.url);

/**
 * BOTH stylesheet roots, and every `.css` in them — not just `components/**\/*.module.css`
 * (review TA56-M2). Four route stylesheets (`turkiye`, `country-detail`, `province-detail`,
 * `game`) live under `app/` and were invisible to this guard. No live gap existed the day it
 * was written — none of them declares an offset — but a guard that only asserts "at least one
 * offset exists" cannot notice the file it never opened, and the letter-jump anchors this
 * test was written for live on `/turkiye`.
 */
const ROOTS = [
  { label: "components", url: new URL("../components/", import.meta.url) },
  { label: "app", url: new URL("../app/", import.meta.url) },
] as const;

const globals = stripCssComments(readFileSync(GLOBALS, "utf8"));

/**
 * Only the UNCONDITIONAL `:root` block counts as a definition (review TA56-M3). A token
 * declared inside an at-rule is undefined outside it, which is precisely the shape this
 * commit deleted: `--header-height-wrapped` was declared in `:root` AND redeclared under
 * `@media (min-width: 64rem)`. Accepting a match anywhere in the file would let someone
 * reintroduce a media-only offset token, pass this tripwire, and leave `calc()` invalid — and
 * the offset silently zero — on every viewport outside that query.
 */
const rootBlock = (() => {
  // Matches `:root {` and also a SELECTOR LIST that starts with it, e.g. `:root, .light {`
  // (T-034: `.light` was joined to the light token block so a subtree can be forced back to
  // the light palette, which `.dark` alone cannot do — see
  // `components/showcase/theme-pair.tsx`). The `[^{}@]` class is what keeps the guarantee
  // this block is about: the match cannot span a `{`, a `}` or an at-rule, so a `:root`
  // nested inside `@media` still does not qualify.
  const match = /:root[^{}@]*\{/.exec(globals);
  if (match === null) return "";
  const start = match.index;
  const end = globals.indexOf("}", start);
  return end === -1 ? "" : globals.slice(start, end);
})();

const cssFiles = ROOTS.flatMap(({ label: rootLabel, url: root }) =>
  readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".css") && !name.includes("node_modules"))
    .map((name) => ({
      file: fileURLToPath(new URL(name, root)),
      label: `${rootLabel}/${name}`,
      css: readFileSync(new URL(name, root), "utf8"),
    })),
).sort((a, b) => a.file.localeCompare(b.file));

/**
 * EVERY COMPONENT SOURCE IN BOTH ROOTS, and the reason this guard had to learn to read them.
 *
 * T-033 retired the CSS Modules. The two anchor offsets this test was written for —
 * `#video-12` and `#video-12-etiket-3` on the book page — were declarations in
 * `book-detail.module.css` until task 8 moved them into Tailwind arbitrary values on the page's
 * own hoisted class constants. Nothing about the failure mode changed: `var()` against an
 * undefined property still invalidates the whole `calc()`, the declaration is still dropped and
 * the offset still becomes ZERO in silence. What changed is WHERE the reader lives, and a
 * stylesheet-only scan reported **zero readers** for `--header-height` the moment the last
 * module went — i.e. the widening below is what keeps this tripwire from going green by having
 * nothing left to look at.
 *
 * `stripComments`, not `stripCssComments`: the docblocks that explain these offsets quote the
 * class they explain, and a scanner that could not tell prose from code would count a comment as
 * a reader — the same trap `components/ui/token-binding.test.ts` records.
 */
const tsxFiles = ROOTS.flatMap(({ label: rootLabel, url: root }) =>
  readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter(
      (name) => name.endsWith(".tsx") && !name.includes(".test.") && !name.includes("node_modules"),
    )
    .map((name) => ({
      file: fileURLToPath(new URL(name, root)),
      label: `${rootLabel}/${name}`,
      css: stripComments(readFileSync(new URL(name, root), "utf8")),
    })),
).sort((a, b) => a.file.localeCompare(b.file));

/** Every custom-property read inside a `calc()` in either stylesheet root. */
const cssCalculatedReferences = cssFiles.flatMap(({ css, label }) =>
  [...stripCssComments(css).matchAll(/calc\(([^;{}]+)\)/g)].flatMap((calculation) =>
    [...(calculation[1] ?? "").matchAll(/var\(\s*(--[a-z0-9-]+)(?:\s*,[^)]*)?\)/gi)].map(
      (reference) => ({
        css: stripCssComments(css),
        label,
        token: reference[1] ?? "",
      }),
    ),
  ),
);

/**
 * The same read, spelled as a Tailwind arbitrary value: `scroll-mt-[calc(var(--x)+1rem)]`.
 *
 * Anchored on `-[calc(` and closed on `)]` rather than reusing the stylesheet pattern above,
 * which excludes `;{}` — characters a `.tsx` file is full of, so that pattern would run past the
 * end of the class string and report tokens from whatever followed.
 */
const classCalculatedReferences = tsxFiles.flatMap(({ css, label }) =>
  [...css.matchAll(/-\[calc\(([^\]]+)\)\]/g)].flatMap((calculation) =>
    [...(calculation[1] ?? "").matchAll(/var\(\s*(--[a-z0-9-]+)(?:\s*,[^)]*)?\)/gi)].map(
      (reference) => ({ css, label, token: reference[1] ?? "" }),
    ),
  ),
);

const calculatedReferences = [...cssCalculatedReferences, ...classCalculatedReferences];

/**
 * The tokens an anchor offset may read, which MUST therefore be declared unconditionally.
 *
 * Both are measurements of something opaque that a followed fragment has to land below, and
 * both are consumed from more than one place, which is why they live in the token layer rather
 * than in the module that reads them. Other `calc()` tokens may legitimately be selector- or
 * at-rule-scoped, so the filter is a list rather than "everything inside a calc()" — this test
 * must not mistake a declaration elsewhere in the same file for a global definition.
 *
 * · `--header-height` — the sticky site header. Its readers include the book page's two anchor
 *   offsets, the game's viewport math and the nav panel's height cap.
 *
 * `--deneme-summary-height` USED TO BE THE SECOND ENTRY and is retired with the accordion it
 * measured (bench PR, `KITAP-D1`): the row it offset sat inside a collapsed panel under a sticky
 * `<summary>`, and neither the panel nor the sticky row exists any more. Its absence is asserted
 * below rather than merely un-listed — a list this test no longer mentions is a list that cannot
 * fail, and the point of the retired-token case is that a reintroduced reference would be reading
 * a property nothing declares.
 */
const GLOBAL_OFFSET_TOKENS = ["--header-height"] as const;

/** Tokens that were retired and must not come back as a dangling `var()`. `var()` against an
 *  undefined property invalidates the entire `calc()`, so the offset silently becomes zero and
 *  nothing errors — which is why absence is worth a test at all. */
const RETIRED_TOKENS = ["--header-height-wrapped", "--deneme-summary-height"] as const;

const offsetTokenReaders = calculatedReferences.filter(({ token }) =>
  (GLOBAL_OFFSET_TOKENS as readonly string[]).includes(token),
);

describe("sticky-header anchor offsets", () => {
  it("finds sticky-header token readers to guard", () => {
    expect(offsetTokenReaders.length).toBeGreaterThan(0);
  });

  it.each(GLOBAL_OFFSET_TOKENS)("%s is declared in the unconditional :root block", (token) => {
    // Asserted for every token in the list, not merely for those a reader happens to use
    // today: a token that loses its last reader still has to keep its declaration honest, and
    // one that gains a reader must not depend on this test being edited to notice.
    expect(new RegExp(`${token}\\s*:`).test(rootBlock)).toBe(true);
  });

  it("guards at least one reader of each offset token", () => {
    // The other direction, and the reason it is separate: the assertion above passes happily
    // for a token nothing reads, which is how a guard quietly stops guarding.
    for (const token of GLOBAL_OFFSET_TOKENS) {
      expect(offsetTokenReaders.some((reader) => reader.token === token)).toBe(true);
    }
  });

  it("scans both stylesheet roots", () => {
    // Guards the widening itself: a move of either root would otherwise shrink the scanned
    // set in silence, which is the failure mode of the version this replaced.
    expect(cssFiles.some(({ file }) => file.includes("/app/"))).toBe(true);
    expect(cssFiles.some(({ file }) => file.includes("/components/"))).toBe(true);
  });

  it("scans component sources in both roots too, with comments stripped", () => {
    // The second half of the same guard, and it is not decorative: with the CSS Modules retired,
    // every remaining reader of `--header-height` inside a `calc()` is a Tailwind arbitrary value
    // in a `.tsx` file. A scan that lost this root would report zero readers and take the
    // "guards at least one reader of each offset token" case down with it — which is the honest
    // failure, but only because the case exists.
    expect(tsxFiles.some(({ file }) => file.includes("/app/"))).toBe(true);
    expect(tsxFiles.some(({ file }) => file.includes("/components/"))).toBe(true);
    expect(classCalculatedReferences.length).toBeGreaterThan(0);
    // The comment-stripping half, proved on a real subject: the book page's own docblocks quote
    // `scroll-mt-[calc(var(--header-height)+1rem)]` in prose while explaining it.
    const page = tsxFiles.find(({ file }) => file.endsWith("kitaplar/[slug]/page.tsx"));
    expect(page, "the book page is no longer scanned").toBeDefined();
    expect(page?.css).not.toContain("HOIST FIRST");
  });

  it("finds the unconditional :root block in globals.css", () => {
    // Anchor for the definition side: an empty slice would make every offset below pass or
    // fail for the wrong reason.
    expect(rootBlock).toContain("--header-height");
  });

  it.each(offsetTokenReaders)("$label resolves $token used inside calc()", ({ token }) => {
    expect(new RegExp(`${token}\\s*:`).test(rootBlock)).toBe(true);
  });

  /**
   * "Keeps the mobile header on one row below the nav-collapse breakpoint" measured
   * `components/site-header.module.css`: `.inner { flex-wrap: nowrap }` had to appear before the
   * first `@media (min-width:` so the header could not wrap to two rows and silently invalidate
   * the `--header-height` the offsets are calculated from.
   *
   * T-032 PR4 deleted that stylesheet with the V1 chrome. `V2Header` is Tailwind and sets its own
   * row behaviour in class names, so there is no stylesheet block to slice and no first media
   * query to slice at — the rule was about a mechanism, not a measurement that moved.
   *
   * The OFFSET rules above are the durable half and are unchanged: every token a stylesheet reads
   * inside `calc()` must be declared in the unconditional `:root` block, and the retired tokens
   * must stay retired on both sides. Those are what actually break a followed fragment.
   */

  it.each(RETIRED_TOKENS)("no longer references the retired %s anywhere", (token) => {
    // `--header-height-wrapped` described a header that cannot occur any more (the nav moved
    // into a disclosure and `.inner` is `nowrap` below the nav-collapse breakpoint); `--deneme-summary-height`
    // measured an accordion row the bench removed. In both cases a reintroduced reference would
    // be reading a property nothing declares — and the declaration side has to stay gone too,
    // or the next reader finds a token with no owner and assumes it means something.
    for (const { css } of cssFiles) {
      expect(stripCssComments(css)).not.toContain(token);
    }
    // …and the component sources, for the same reason they are scanned above: after T-033 a
    // reintroduced reference is far likelier to arrive as a Tailwind arbitrary value than as a
    // stylesheet declaration.
    for (const { css } of tsxFiles) {
      expect(css).not.toContain(token);
    }
  });
});
