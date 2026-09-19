import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * `../showcase/specimens` is scanned for the same reason the other two are. It was left out
 * originally as "just demo code", and a `text-white` promptly landed there — reproducing, in
 * the one place meant to demonstrate correct usage, the exact defect `button.tsx` had.
 */
const DIRS = ["../ui", "../patterns", "../showcase/specimens"] as const;

/**
 * Comments and docblocks are stripped before scanning.
 *
 * Not a convenience: the comment on `components/ui/alert.tsx` explains the defect by quoting
 * `dark:text-[var(--color-success,#496f35)]`, and a scanner that could not tell prose from
 * code would flag the very explanation of why the code is now correct. The same trap caught
 * `lib/theme/bridge-tokens.test.ts`, whose parser found `@theme inline` inside a comment
 * before finding the real block.
 */
const FILES = DIRS.flatMap((rel) => {
  const dir = fileURLToPath(new URL(rel, import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => [join(rel, f), stripComments(readFileSync(join(dir, f), "utf8"))] as const);
});

const RAW_PALETTE =
  /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|amber|emerald|sky|teal|rose|red|green|blue|orange|yellow|indigo|violet|purple|pink|cyan|lime)-\d{2,3}\b/;

/**
 * `white` and `black` take no numeric suffix, so `RAW_PALETTE` never matched them — and they
 * are the two most tempting literals of the lot. `button.tsx` carried `text-white` on the
 * destructive variant from the day it was written; it read correctly in light mode and
 * measured 2.89:1 once `.dark` lifted the fill. Nothing failed, because nothing was looking.
 *
 * Two scrims are exempt, listed by file and exact utility like the `dark:` exemptions below:
 * a modal scrim is not a themed surface. It is the same black veil over whatever the page is
 * showing in both themes, and a token that resolved lighter in dark mode would make the
 * dialog behind it harder to separate, not easier.
 */
const RAW_ACHROMATIC = /\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black)\b/;

const ACHROMATIC_EXEMPTIONS: ReadonlyArray<readonly [string, string, string]> = [
  ["dialog.tsx", "bg-black/50", "The modal scrim. Identical in both themes by design."],
  ["sheet.tsx", "bg-black/50", "The modal scrim. Identical in both themes by design."],
  // A third row covered `switch.tsx`'s `bg-white` thumb. T-036 deleted that primitive — the
  // two places in the product that want a toggle want switch SEMANTICS, not a rail and a
  // thumb, and both already write `role="switch"` by hand — so the exemption went with the
  // file it exempted rather than outliving it.
];

const BRAND_HEX = /#(b0522e|7e3a1e|4f6d30|276b70|496f35|c9860f|b23b2e|ede3d5|2b2622|211c19)/i;

/**
 * Colour in a component comes from a bridge token. Three things are forbidden, and each has
 * already cost this repo something (T-034 spec §3):
 *
 *   - `var(--color-x, #hex)` escapes read a Terra token the `.dark` block never redefines,
 *     so the component is frozen at its light value in dark mode. There were 44 of them
 *     across six files, which is why no dark palette could have reached Badge, Alert,
 *     Button, Tabs, Dialog or Sheet.
 *   - raw Tailwind palette classes are off-brand and theme-blind.
 *   - hand-written `dark:` classes mean the component is bound to the wrong token.
 *     `docs/design.md` says so outright: override tokens in `.dark`, do not sprinkle `dark:`
 *     per component. Alert carried four such pairs that resolved to the same colour as their
 *     light counterparts and had never done anything at all.
 */
describe("components bind colour through the token bridge", () => {
  it("positive control — files were actually read and comments actually stripped", () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES.some(([path]) => path.endsWith("button.tsx"))).toBe(true);
    const alert = FILES.find(([path]) => path.endsWith("alert.tsx"));
    expect(alert?.[1]).toContain("alertVariants");
    // The docblock quoting an escape is gone, so the scan below is meaningful.
    expect(alert?.[1]).not.toContain("never did anything");
  });

  it.each(FILES)("%s has no var(--color-*, #hex) escape", (_path, source) => {
    expect(source).not.toMatch(/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/);
  });

  it.each(FILES)("%s has no raw Tailwind palette class", (_path, source) => {
    expect(source).not.toMatch(RAW_PALETTE);
  });

  it.each(FILES)("%s has no brand hex literal", (_path, source) => {
    expect(source).not.toMatch(BRAND_HEX);
  });

  it.each(FILES)("%s uses no bare white/black utility", (path, source) => {
    let scanned = source;
    for (const [file, utility] of ACHROMATIC_EXEMPTIONS) {
      if (path.endsWith(file)) scanned = scanned.split(utility).join(" ");
    }
    expect(scanned).not.toMatch(RAW_ACHROMATIC);
  });

  it("every achromatic exemption is still present", () => {
    // A stale exemption hides a real regression just as effectively as a missing rule.
    for (const [file, utility] of ACHROMATIC_EXEMPTIONS) {
      const entry = FILES.find(([p]) => p.endsWith(file));
      expect(entry, `${file} is no longer scanned`).toBeDefined();
      expect(entry?.[1], `${file} no longer contains ${utility}; drop the exemption`).toContain(
        utility,
      );
    }
  });

  /**
   * The `dark:` rule now runs with NO exemptions at all, which is the strongest form it has
   * had — and it got there by deletion, not by loosening.
   *
   * Two utilities used to be exempt, each because it expressed something a colour token
   * cannot: `avatar.tsx`'s `dark:after:mix-blend-lighten` (a blend MODE — no custom property
   * carries `mix-blend-mode`) and `dropdown-menu.tsx`'s
   * `dark:data-[variant=destructive]:focus:bg-destructive/20` (an ALPHA — the same token at
   * 10% on light and 20% on dark). T-036 deleted both primitives for having no product call
   * site, so both exemptions went with the files they exempted.
   *
   * A third was never exempted: `custom-select.tsx` had `bg-white dark:bg-card`, which is a
   * hard-coded colour with a theme patch bolted on. It now reads `bg-popover`, which is what
   * the bridge has a token for.
   *
   * If a real blend-mode or alpha case comes back, restore the list-by-file-and-exact-utility
   * shape above — an exemption nobody wrote down is how a tripwire quietly stops tripping.
   */
  it.each(FILES)("%s writes no hand-rolled dark: class", (_path, source) => {
    // `components/showcase/theme-pair.tsx` carries the bare class names `dark` and `light`
    // on a wrapper, which is a different thing from a `dark:` variant and passes this.
    expect(source).not.toMatch(/\bdark:/);
  });

  it("the dark: pattern fires on source that does carry one — positive control", () => {
    // With no exemption rows left there is nothing else proving the regex still works; an
    // absence-only rule with a broken pattern is green and worthless.
    expect("dark:bg-card").toMatch(/\bdark:/);
  });
});

/**
 * The same escape rule, extended to the V2 surface.
 *
 * Phase A2 fixed 44 escapes in `components/ui` and scoped its audit there. That scoping was
 * a gap: `components/v2` and the V2 pages carried 103 more of the same defect, so the
 * night-sea palette reached the primitives but not most of the pages built on them. 87 were
 * swept in phase D; the rest are exempt below.
 *
 * ONLY the escape rule is checked here. Raw palette classes (749) and hand-written `dark:`
 * (203) across this surface are the categorical accent system, which the T-034 spec scoped
 * out explicitly and T-031c owns. Asserting them now would fail on work nobody has started.
 */
describe("the V2 surface binds chrome colour through the bridge too", () => {
  const V2_DIRS = [
    fileURLToPath(new URL("../v2", import.meta.url)),
    fileURLToPath(new URL("../../app/[locale]", import.meta.url)),
  ];

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
    });
  }

  /**
   * Map surfaces, and they stay escaped on purpose.
   *
   * Every one is an SVG `fill` or `stroke` drawn onto a map, where the contrast was measured
   * against surfaces that do NOT follow the theme — white land and the seven Okabe-Ito region
   * tints. `--color-ink-dark` in particular is documented in `app/globals.css` as the single
   * neutral clearing WCAG 1.4.11's 3:1 floor over every one of those tints. Binding these to
   * a bridge token would move a line whose whole justification is a measurement against a
   * fixed backdrop. Dark maps are T-031d, and re-measuring that table is its first task.
   */
  const MAP_SURFACE_FILES = [
    "v2-continent-locator-map.tsx",
    "v2-region-locator-map.tsx",
    "v2-tool-workbench.tsx",
    join("bolge", "[slug]", "page.tsx"),
  ] as const;

  const FILES_V2 = V2_DIRS.flatMap(walk).filter(
    (path) => !MAP_SURFACE_FILES.some((exempt) => path.endsWith(exempt)),
  );

  it("positive control — the V2 surface was actually walked", () => {
    expect(FILES_V2.length).toBeGreaterThan(60);
  });

  it.each(FILES_V2.map((f) => [f.split("/").slice(-2).join("/"), f] as const))(
    "%s has no var(--color-*, #hex) escape",
    (_label, path) => {
      const source = stripComments(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/);
    },
  );

  it("every exempt file still contains what it is exempt for", () => {
    for (const exempt of MAP_SURFACE_FILES) {
      const match = V2_DIRS.flatMap(walk).find((p) => p.endsWith(exempt));
      expect(match, `${exempt} no longer exists; drop the exemption`).toBeDefined();
      expect(
        stripComments(readFileSync(match!, "utf8")),
        `${exempt} no longer escapes; drop the exemption`,
      ).toMatch(/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/);
    }
  });
});

/**
 * A `var(--token, #hex)` fallback still equals its token.
 *
 * ## The exposure this closes, and why it is not the escape rule above
 *
 * The rule above forbids `var(--color-*, #hex)` on the `ui`/`patterns`/`specimens` surface. It
 * is a NARROWER thing than it looks: it matches `--color-*` and nothing else. Ten live
 * occurrences in the product tree name `--map-sea`, so that rule never sees them — they were
 * described once as "already governed by token-binding", and they were governed by nothing.
 *
 * Nothing is miscoloured today: `--map-sea` is real (`app/globals.css`) and every fallback
 * equals it. The exposure is DRIFT — the stylesheet moving while a hex copied into a component
 * does not — and drift is silent by construction, because the fallback only paints where the
 * token is missing, which is the one case nobody looks at.
 *
 * This is the same defect as the seven `var(--region-*, #hex)` map fills, and it takes the same
 * fix: pin the fallback to the declaration, in both directions. Widening the escape rule instead
 * would need its own exemption list beside the one it already has, and double-governing a shape
 * under two rules with different exemptions is how an exemption goes stale unnoticed.
 *
 * COMMENTS ARE STRIPPED, which is load-bearing here for the same reason it is above:
 * `alert.tsx`'s docblock quotes `var(--color-success,#496f35)` while describing a class that no
 * longer exists. Pinning prose would force a historical note to be rewritten every time a token
 * moves.
 */
describe("every var() fallback in the product tree still equals its token", () => {
  const ROOTS = ["../../components", "../../app", "../../lib"] as const;

  function walkAll(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walkAll(full);
      const source = entry.name.endsWith(".ts") || entry.name.endsWith(".tsx");
      return source && !entry.name.includes(".test.") ? [full] : [];
    });
  }

  /** Every `--token: #hex` declared with a LITERAL hex in app/globals.css. */
  const declared = new Map<string, string[]>();
  {
    const css = stripComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    for (const m of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      declared.set(m[1]!, [...(declared.get(m[1]!) ?? []), m[2]!.toLowerCase()]);
    }
  }

  /** Every live `var(--token, #hex)` in the product tree, comments stripped. */
  const fallbacks = ROOTS.flatMap((rel) =>
    walkAll(fileURLToPath(new URL(rel, import.meta.url))).flatMap((path) => {
      const source = stripComments(readFileSync(path, "utf8"));
      return [...source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g)].map(
        (m) => ({ path, token: m[1]!, hex: m[2]!.toLowerCase() }),
      );
    }),
  );

  it("found the fallbacks and the declarations — positive control", () => {
    // Neither half may be empty: a pin over nothing is green and means nothing, which is the
    // hollow-pass shape this repo keeps paying for.
    expect(fallbacks.length).toBeGreaterThan(20);
    expect(declared.size).toBeGreaterThan(20);
    // The ten this guard was written for are really in the population.
    expect(fallbacks.filter((f) => f.token === "--map-sea")).toHaveLength(10);
  });

  it.each([...new Set(fallbacks.map((f) => `${f.token} ${f.hex}`))])(
    "%s — the token is declared with exactly that value",
    (pair) => {
      const [token, hex] = pair.split(" ") as [string, string];
      const values = declared.get(token);
      expect(
        values,
        `${token} is not declared with a literal hex in app/globals.css`,
      ).toBeDefined();
      // Exactly one literal declaration, so "which one did it mean" can never be the answer.
      expect(values, `${token} is declared with a literal hex more than once`).toHaveLength(1);
      expect(
        values![0],
        `${token}'s fallback says ${hex}, app/globals.css says ${values![0]}`,
      ).toBe(hex);
    },
  );

  it("names every file carrying one, so a new one cannot arrive unnoticed", () => {
    // The other direction of the pin. Above asserts each fallback matches its token; this
    // asserts the POPULATION is the one that was reviewed, so a fallback added to a token that
    // happens to match today still has to be looked at.
    const byToken = new Map<string, number>();
    for (const f of fallbacks) byToken.set(f.token, (byToken.get(f.token) ?? 0) + 1);
    expect(Object.fromEntries([...byToken].sort())).toEqual({
      "--color-ink-dark": 7,
      "--color-primary": 4,
      "--color-primary-dark": 4,
      "--map-sea": 10,
      "--region-akdeniz": 1,
      "--region-dogu-anadolu": 1,
      "--region-ege": 1,
      "--region-guneydogu-anadolu": 1,
      "--region-ic-anadolu": 1,
      "--region-karadeniz": 1,
      "--region-marmara": 1,
      // The SST ramp's three. `lib/theme/sst-band.ts` paints the map's station pins through an
      // SVG `fill` ATTRIBUTE, which Tailwind never sees, so the band value has to be a raw CSS
      // value and carries a literal fallback — the same shape `--region-*`'s `fillValue` has.
      "--sst-band-cool": 1,
      "--sst-band-hot": 1,
      "--sst-band-warm": 1,
    });
  });
});

/**
 * A CLASS-SHAPED STRING IN A COMMENT IS STILL A CLASS, and an invalid one breaks every page.
 *
 * Tailwind v4 scans source TEXT for candidate class names. It does not parse the file, so it
 * cannot tell a rendered `className` from prose inside a `/* … *\/` block — which means a
 * comment that documents a family of tokens by wrapping the family name in a background
 * utility's bracket produces a real rule whose declaration reads that family name verbatim,
 * wildcard and all.
 *
 * A wildcard is not part of a custom property name, so PostCSS fails on the delimiter,
 * and the failure is not local: `app/globals.css` is imported by `app/[locale]/layout.tsx`, so
 * the whole stylesheet fails to compile and EVERY route returns 500.
 *
 * This is written down because it actually happened, in T-031c Task 6, in a doc comment in
 * `raw-palette-count.test.ts` describing the legend fix.
 *
 * WHAT WAS AND WAS NOT MISSING, stated precisely, because the first telling of this overstated
 * it. `pnpm typecheck`, `pnpm lint` and 5456 tests were all green while no page would load —
 * true, and none of those three compiles the stylesheet. But CI is not only those three:
 * `.github/workflows/ci.yml` has a `build` job running `pnpm build`, which DOES compile it and
 * WOULD have failed. So this was never "invisible to CI". What is missing is a **local and
 * pre-push** signal: `deploy.yml` runs only lint and test before handing off to the image
 * build, so the first report of the breakage would have come from a pipeline rather than from
 * the machine that wrote the comment.
 *
 * THIS GUARD IS AN INTERIM. It catches ONE shape. **T-056** is the real fix — running
 * `app/globals.css` through the project's own PostCSS/Tailwind pipeline against the real source
 * set, in seconds, which catches the whole class of stylesheet-breaking source text rather than
 * this one spelling. **When T-056 lands, this block becomes redundant and should be deleted**
 * rather than left to accumulate shapes one incident at a time.
 *
 * The PATTERN is deliberately narrow: a `var()` inside a bracketed arbitrary value whose token
 * name contains `*`. A `*` elsewhere in a bracket is legitimate (`w-[calc(100%*2)]`), and a
 * wildcard in prose is fine as long as it is not wrapped in the class shape — write
 * `--sst-band-*` on its own, or describe the utility without spelling it.
 *
 * The WALK is deliberately wide, and must stay that way. **It has to match Tailwind's own source
 * detection, not a hand-picked subset of it.** `app/globals.css` declares no `@source`, so
 * Tailwind auto-detects: it walks the whole project from the root, skips `node_modules` and
 * `.git`, and honours `.gitignore`. Anything narrower is a guard that is green because it did
 * not look. The first version of this block walked only `components`, `app` and `lib` — which
 * left `i18n/`, `proxy.ts`, `next.config.ts`, `vitest.config.ts`, `scripts/`, `docs/` and every
 * future top-level directory able to break the stylesheet without reddening anything. The walk
 * below therefore derives its exclusions from `git check-ignore` rather than from a list
 * somebody has to remember to update.
 */
describe("no source comment can compile into an invalid Tailwind utility", () => {
  const ROOT = fileURLToPath(new URL("../..", import.meta.url));

  /** The text extensions Tailwind will read a class candidate out of. */
  const SCANNABLE = /\.(?:[cm]?[jt]sx?|mdx?|html?|json)$/;

  /**
   * Only the two directories Tailwind itself never descends into. Everything else that should
   * be skipped is skipped because `.gitignore` says so, not because this list says so.
   */
  const NEVER_WALKED = new Set(["node_modules", ".git"]);

  function walkAll(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return NEVER_WALKED.has(entry.name) ? [] : walkAll(full);
      return SCANNABLE.test(entry.name) ? [full] : [];
    });
  }

  const candidates = walkAll(ROOT).map((f) => relative(ROOT, f));
  /**
   * `git check-ignore` IS the rule Tailwind applies, so it is the rule used here. It exits 1
   * when nothing in its input is ignored, which is a normal outcome and not an error.
   */
  const ignored = new Set(
    (() => {
      try {
        return execFileSync("git", ["check-ignore", "--stdin"], {
          cwd: ROOT,
          input: candidates.join("\n"),
          encoding: "utf8",
        }).split("\n");
      } catch {
        return [];
      }
    })().filter(Boolean),
  );
  const files = candidates.filter((f) => !ignored.has(f)).map((f) => join(ROOT, f));
  const WILDCARD_TOKEN_UTILITY = /-\[[^\]]*var\(\s*--[a-z0-9-]*\*/g;

  it("walked the whole scanned project, not a hand-picked subset — positive control", () => {
    expect(files.length).toBeGreaterThan(400);
    const seen = new Set(files.map((f) => relative(ROOT, f).split("/")[0]!));
    // The four the narrow walk missed, named individually so a regression to `components`/
    // `app`/`lib` fails here with the reason rather than merely counting lower.
    for (const entry of ["i18n", "proxy.ts", "next.config.ts", "vitest.config.ts"]) {
      expect(seen.has(entry), `${entry} is not being scanned, but Tailwind scans it`).toBe(true);
    }
    // And the exclusions really excluded: a guard that walked node_modules would be useless
    // rather than merely slow, and one that walked gitignored output would red on stale files.
    expect([...seen].some((d) => d === "node_modules" || d === ".next")).toBe(false);
  });

  it("spells no bracketed utility around a wildcard token name", () => {
    const offenders: string[] = [];
    for (const path of files) {
      for (const m of readFileSync(path, "utf8").matchAll(WILDCARD_TOKEN_UTILITY)) {
        offenders.push(`${path}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      `these compile to a CSS declaration with a '*' in the property name, which fails the ` +
        `whole stylesheet and 500s every route:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("recognises the shape that actually broke the build — positive control", () => {
    // The offending string is ASSEMBLED rather than written out, because this file is itself
    // scanned by Tailwind and by the assertion above: spelling the defect here would BE the
    // defect. That is not a workaround, it is the guard proving its own premise — the first
    // run of this test failed on its own doc comment.
    const star = String.fromCharCode(42);
    const offender = `now \`bg-[var(--sst-band-${star})]\`. That legend`;
    expect(offender).toMatch(WILDCARD_TOKEN_UTILITY);
    // And the safe spellings this repo uses all around it stay legal.
    for (const safe of [
      "bg-[var(--sst-band-cool)]",
      "fill-[var(--region-marmara)]/80",
      "bg-[var(--map-sea,#dbe7e8)]",
      "w-[calc(100%*2)]",
      `the --sst-band-${String.fromCharCode(42)} family`,
    ]) {
      expect(safe, `${safe} must stay legal`).not.toMatch(WILDCARD_TOKEN_UTILITY);
    }
  });
});
