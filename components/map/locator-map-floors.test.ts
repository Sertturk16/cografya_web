import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";
import { WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";
import { classConstant, renderSites } from "@/lib/test-support/converted-floor";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * THE LOCATOR FIGURE'S GEOMETRY AND PAINT, PINNED WHERE THE RETIRED STYLESHEET USED TO HOLD THEM.
 *
 * ## Why this file exists
 *
 * T-033 task 9 retired `components/map/locator-map.module.css` — the LAST CSS Module in the
 * tree — and moved its rules into hoisted class constants in `locator-map.tsx`. Two of those
 * rules were the entire remaining population of `components/css-module-fixed-widths.test.ts`:
 * the figure's `width: min(100%, 460px)` and `min(100%, 560px)` caps. That census can only read
 * CSS Modules, so both would have evaporated into `pnpm sweep:overflow` — which is not in
 * `.github/workflows/ci.yml` and therefore only runs when a human remembers. The census was
 * deleted with its subject; this is where its last two entries went.
 *
 * `lib/test-support/converted-floor.ts` carries the shared rule and the extractor;
 * `components/book/book-detail-floors.test.ts` is the worked example this file follows.
 *
 * ## HOIST FIRST, THEN PIN
 *
 * `classConstant` reads a top-level `const NAME = …;`. A value left inline on a JSX `className`
 * is not one, so it returns `null`, every assertion built on it never runs, and the suite is
 * green on nothing. Each group below therefore asserts `not.toBeNull()` first and closes with a
 * control that DE-HOISTS the real declaration and proves the extractor goes blind — built by
 * mutating this file's real subject, never an invented string.
 *
 * ## Bidirectional
 *
 * A pin that only reads a declaration stays green on a constant nothing renders any more, so
 * every group also proves the component still renders the constant it inspected.
 *
 * ## The route this is a pin FOR
 *
 * Measured 2026-09-19, not taken from the plan: `LocatorMap` has ONE call site,
 * `app/[locale]/(site)/dunya/[slug]/page.tsx`, with `kind="country"`. `/turkiye/istanbul` — the
 * route the plan named for this task — renders `V2ProvinceLocatorMap` and contains no
 * `figure[data-kind]` at all. So the `country` half below is pinned against a route that renders
 * it, and the `province` half is pinned against source alone, which is stated here rather than
 * implied: it is reachable code that no route renders.
 */

const SOURCE = stripComments(
  readFileSync(new URL("./locator-map.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n"),
);

const PAGE = stripComments(
  readFileSync(new URL("../../app/[locale]/(site)/dunya/[slug]/page.tsx", import.meta.url), "utf8"),
);

/** The declaration, with `not.toBeNull()` already discharged. */
function required(name: string): string {
  const declaration = classConstant(SOURCE, name);
  expect(declaration, `locator-map.tsx has no top-level ${name} constant`).not.toBeNull();
  return declaration!;
}

/**
 * Does a declaration carry this EXACT utility, as a whole token?
 *
 * `toContain` is the wrong instrument for a Tailwind class and it fails in the one direction
 * that matters: `"…p-1 …".includes("p-1")` is also true of `p-1.5`, which is how a pin on a 4px
 * padding stayed green at 6px (→ task 8). Both boundaries are load-bearing, and the LEADING one
 * is the less obvious: `"gap-1.5"` contains `"p-1"` at index 2. The characters excluded on each
 * side are exactly those that can continue a Tailwind token — word characters, `.`, `-`, `:`
 * and `[`.
 */
function carries(declaration: string, utility: string): boolean {
  const escaped = utility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.:\\-\\[])${escaped}(?![\\w.\\-\\[])`).test(declaration);
}

/** The two rows of a `{ province, country }` class record, in source order. */
function rows(name: string): { province: string; country: string } {
  const declaration = required(name);
  const found = [...declaration.matchAll(/(province|country):\s*\n?\s*"([^"]*)"/g)];
  expect(
    found.map((m) => m[1]),
    `${name} does not declare both kinds`,
  ).toEqual(["province", "country"]);
  return { province: found[0]![2] as string, country: found[1]![2] as string };
}

/**
 * De-hoist a `{ province, country }` record: delete the declaration and inline the object
 * literal at its one render site. The floors are still in the file; the extractor is not.
 */
function deHoistedRecord(name: string): string {
  const declaration = required(name);
  const literal = declaration
    .replace(new RegExp(`^const ${name} =\\s*`), "")
    .replace(/\s*as const;$/, "");
  return SOURCE.replace(declaration, "")
    .split(`className={${name}[kind]}`)
    .join(`className={(${literal})[kind]}`);
}

/** De-hoist a plain string constant: delete the declaration and inline its value. */
function deHoistedString(name: string): string {
  const declaration = required(name);
  const value = [...declaration.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join("");
  return SOURCE.replace(declaration, "").split(`className={${name}}`).join(`className="${value}"`);
}

const RECORDS = ["FIGURE", "FRAME"] as const;
const STRINGS = ["BASE", "OVERLAY", "HIGHLIGHT", "RING", "CREDIT"] as const;

describe("the locator figure hoisted every rule the retired stylesheet carried", () => {
  it("declares all seven", () => {
    // Anti-vacuity for every group below: if the component stopped hoisting, `required` would
    // throw here first and name the constant rather than letting the rest pass on null.
    for (const name of [...RECORDS, ...STRINGS]) expect(required(name)).toContain(name);
  });

  it("renders every constant it declares", () => {
    for (const name of STRINGS) {
      expect(renderSites(SOURCE, name), `${name} is declared but never rendered`).toBe(1);
    }
    // The two records reach the DOM through a `[kind]` lookup rather than a bare `className={X}`,
    // so `renderSites` — which matches the literal spelling — correctly reports zero for them.
    // Asserting the real spelling instead of widening the shared helper, exactly as its own
    // docblock asks: a non-literal site owes a fresh reading.
    for (const name of RECORDS) {
      expect(renderSites(SOURCE, name)).toBe(0);
      expect(SOURCE, `${name} is declared but never rendered`).toContain(
        `className={${name}[kind]}`,
      );
    }
  });

  it("still reads no CSS Module — the point of the task", () => {
    expect(SOURCE).not.toContain("locator-map.module.css");
    expect(SOURCE).not.toContain(".module.css");
    expect(SOURCE).not.toMatch(/\bstyles\./);
  });

  it("POSITIVE CONTROL — `carries` reds on the drifts `toContain` passes", () => {
    // The instrument, proved against the real declarations rather than invented strings.
    const credit = required("CREDIT");
    const highlight = required("HIGHLIGHT");
    const drifts: ReadonlyArray<readonly [string, string, string]> = [
      [credit, "mt-1.5", "mt-1.5rem"], // 6px → a different token entirely
      [credit, "text-muted-foreground", "text-muted-foreground-strong"],
      [highlight, "fill-primary-dark", "fill-primary-darker"],
    ];
    for (const [declaration, utility, drift] of drifts) {
      const drifted = declaration.split(utility).join(drift);
      expect(drifted, `${utility} is not in the declaration to drift`).not.toBe(declaration);
      // What the old spelling did: green on the drift.
      expect(drifted).toContain(utility);
      // What this file does now.
      expect(carries(declaration, utility), `${utility} is not carried`).toBe(true);
      expect(carries(drifted, utility), `${drift} still satisfies a pin on ${utility}`).toBe(false);
    }
  });

  it("…and the ONE drift it does not catch is closed by hand rather than left silent", () => {
    // MEASURED LIMIT of the shared spelling, kept identical to `book-detail-floors.test.ts`'s so
    // two readers of one notation cannot drift: `/` is not in the trailing exclusion set, so an
    // alpha modifier — `text-muted-foreground/50`, a different colour — still satisfies a pin on
    // the bare token. Widening the matcher HERE would be the drift. What closes the hole instead
    // is an assertion that no declaration in this file carries one at all, so the day one arrives
    // it arrives as a red rather than through a pin that quietly stopped discriminating.
    expect(carries("text-muted-foreground/50", "text-muted-foreground")).toBe(true);
    for (const name of [...RECORDS, ...STRINGS]) {
      expect(required(name), `${name} carries an alpha modifier this file cannot pin`).not.toMatch(
        /\b(bg|text|border|ring|fill|stroke)-[a-z-]+\/\d/,
      );
    }
  });
});

describe("the figure keeps the two width caps the retired census was still pinning", () => {
  const CAPS = { province: "w-[min(100%,460px)]", country: "w-[min(100%,560px)]" } as const;

  it("FIGURE still carries both", () => {
    // THE TWO DECLARATIONS `components/css-module-fixed-widths.test.ts` HELD when it was deleted:
    // `width: min(100%, 460px)` and `width: min(100%, 560px)`. 460/560 are the widths the
    // readability measurements in plan §4.2/§5.1 were taken at; the base map is a shared file, so
    // a wider figure buys no detail. Neither cap binds at a swept viewport — measured on
    // `/dunya/almanya`, the country column is 238px at 320 and 438px at 1440 — so this is a
    // ceiling on a wider container, which is precisely why nothing else would notice it going.
    const figure = rows("FIGURE");
    expect(carries(figure.province, CAPS.province)).toBe(true);
    expect(carries(figure.country, CAPS.country)).toBe(true);
  });

  it("…as `min(…, 100%)` and not as a bare cap", () => {
    // A bare `w-[460px]` is a WIDTH, not a ceiling: it keeps its value inside a 288px content box
    // at a 320px viewport and pushes the document sideways. That is the exact defect the retired
    // census was built for, and mutation-checked here so the bare spelling cannot satisfy the pin.
    const figure = rows("FIGURE");
    for (const kind of ["province", "country"] as const) {
      const bare = figure[kind].split(CAPS[kind]).join(`w-[${kind === "province" ? 460 : 560}px]`);
      expect(bare).not.toBe(figure[kind]);
      expect(carries(bare, CAPS[kind])).toBe(false);
    }
  });

  it("…and the `m-0` that keeps the UA figure margin off both kinds", () => {
    // A `<figure>`'s UA margin is `1em 40px`. Without `m-0` the figure indents 40px on each side
    // inside its column and the caps stop describing what renders. The stylesheet wrote
    // `margin: 0`; spelling the zero out is what makes this a translation rather than a bet on
    // preflight.
    const figure = rows("FIGURE");
    expect(carries(figure.province, "m-0")).toBe(true);
    expect(carries(figure.country, "m-0")).toBe(true);
  });

  it("POSITIVE CONTROL — de-hoisting FIGURE makes the extractor return null", () => {
    const inlined = deHoistedRecord("FIGURE");
    expect(inlined).toContain(CAPS.country); // the cap is still on the page…
    expect(classConstant(inlined, "FIGURE")).toBeNull(); // …and the pin sees nothing.
    expect(inlined).not.toContain("className={FIGURE[kind]}");
  });
});

describe("the frame reserves exactly the artifact's own box", () => {
  it("takes its ratio from the generated viewBox rather than from a remembered number", () => {
    // CLS = 0 depends on the reserved box matching the file that arrives. Derived from the two
    // generated artifacts, so retuning either one reds here instead of shipping a jump.
    const [, , trW, trH] = MAP_VIEWBOX.split(" ");
    const [, , worldW, worldH] = WORLD_MAP_VIEWBOX.split(" ");
    const frame = rows("FRAME");
    expect(carries(frame.province, `aspect-[${trW}/${trH}]`)).toBe(true);
    expect(carries(frame.country, `aspect-[${worldW}/${worldH}]`)).toBe(true);
  });

  it("differs between the two kinds in the ratio and in NOTHING else", () => {
    // An equality across the pair, in the shape `bench.structure.test.ts` used for the 560px cap.
    // Only ONE kind renders on any route, so a hairline, a radius or a ground that drifted on the
    // other would be invisible to every screenshot and every sweep.
    const frame = rows("FRAME");
    const strip = (value: string) => value.replace(/aspect-\[[^\]]*\]/, "").trim();
    expect(strip(frame.province)).toBe(strip(frame.country));
    expect(strip(frame.country).length).toBeGreaterThan(40);
  });

  it("keeps the overlay stacked on the base, which is what co-registration rests on", () => {
    const overlay = required("OVERLAY");
    const base = required("BASE");
    const frame = rows("FRAME");
    expect(carries(frame.country, "relative")).toBe(true);
    expect(carries(overlay, "absolute")).toBe(true);
    expect(carries(overlay, "inset-0")).toBe(true);
    // Both children size from the same rule, so the UA cannot scale one against the other.
    for (const declaration of [base, overlay]) {
      expect(carries(declaration, "block")).toBe(true);
      expect(carries(declaration, "w-full")).toBe(true);
      expect(carries(declaration, "h-auto")).toBe(true);
    }
    // Measured 2026-09-19 on `/dunya/almanya`: base and overlay land on 306.000 × 159.422 at a
    // 390px viewport and 436.000 × 227.141 at 1440, horizontal offset 0.0000px, scale difference
    // 0.0000%. `overflow-hidden` is what clips the ~1px of image below the reserved box.
    expect(carries(frame.country, "overflow-hidden")).toBe(true);
  });

  it("POSITIVE CONTROL — de-hoisting FRAME makes the extractor return null", () => {
    const inlined = deHoistedRecord("FRAME");
    expect(inlined).toContain("aspect-[1000/521]");
    expect(classConstant(inlined, "FRAME")).toBeNull();
    expect(inlined).not.toContain("className={FRAME[kind]}");
  });
});

describe("colour splits between the frozen artifact and the themed page, and is measured", () => {
  /**
   * Every figure from `lib/theme/contrast.ts`, each named with the backdrop it was measured
   * against and read back out of the rendered DOM rather than assumed:
   *
   *   FROZEN — the overlay, on the artifact's own paint, identical in both themes:
   *     `fill-primary-dark` / `stroke-primary-dark` on white land (`--province-fill`)  8.36
   *     the same, on the world file's painted sea (`--map-sea`)                        6.61
   *   THEMED — the page chrome, on the `--card` this figure sits on:
   *     `text-muted-foreground` on `--card`                       7.92 light / 7.79 dark
   *     the retired `--color-slate` on that same `--card`         7.92 light / 2.15 dark
   *   THEMED — the frame hairline, a decorative boundary (WCAG 1.4.11 does not apply):
   *     `border-border` on `--background`                         1.37 light / 1.68 dark
   *     the retired `--color-border` on dark `--background`                    12.85
   *
   * The last row is why the hairline moved: frozen at its light value it was a 12.85:1 bright
   * line drawn around a figure on a night page — the "light box on a night page" shape at its
   * smallest size.
   */
  it("binds the page chrome through a bridge token", () => {
    for (const name of [...RECORDS, ...STRINGS]) {
      const declaration = required(name);
      expect(declaration).not.toMatch(/var\(--color-/);
      expect(declaration).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(declaration).not.toMatch(/\bdark:/);
      expect(declaration).not.toMatch(
        /\b(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|amber|emerald|sky|teal|rose|red|green|blue|orange|yellow|indigo|violet|purple|pink|cyan|lime)-\d{2,3}\b/,
      );
      expect(declaration).not.toMatch(/\b(bg|text|border|ring|fill|stroke)-(white|black)\b/);
    }
    expect(carries(required("CREDIT"), "text-muted-foreground")).toBe(true);
    expect(carries(rows("FRAME").country, "border-border")).toBe(true);
  });

  it("keeps the overlay's ink FROZEN, because the artifact under it is", () => {
    // The base map is an isolated `<img>` document that cannot see this page's CSS, so its land
    // and sea are literal hex in `lib/map/base-map-svg.ts` and identical in both themes. A
    // theme-aware token on top of it fails in whichever theme it was not chosen for — measured in
    // dark: a lifted primary reads 2.08 on that white land and 1.64 on that sea, against the
    // frozen terracotta's 8.36 and 6.61. A dark-adapted ARTIFACT is the fix and it is T-031d's,
    // with the other map surfaces `components/ui/token-binding.test.ts` exempts.
    const highlight = required("HIGHLIGHT");
    const ring = required("RING");
    expect(carries(highlight, "fill-primary-dark")).toBe(true);
    expect(carries(highlight, "stroke-primary-dark")).toBe(true);
    expect(carries(ring, "stroke-primary-dark")).toBe(true);
    expect(carries(ring, "fill-none")).toBe(true);
    // The theme-aware neighbours, spelled out so "make it consistent with the rest of T-033" is
    // a red rather than a silent 2.08:1.
    for (const declaration of [highlight, ring]) {
      for (const themed of ["primary", "primary-strong", "foreground", "muted-foreground"]) {
        expect(carries(declaration, `fill-${themed}`), `${themed} fill would follow the page`).toBe(
          false,
        );
        expect(carries(declaration, `stroke-${themed}`)).toBe(false);
      }
    }
    // The ground under the artifact is frozen to the same token the world file paints itself, so
    // the rounded corners are sea rather than a strip of another palette while the image loads.
    expect(rows("FRAME").country).toContain("bg-[var(--map-sea)]");
  });

  it("keeps BOTH signals on the highlight, so colour is not carrying it alone", () => {
    // WCAG 1.4.1: the heavier stroke is the second signal. `non-scaling-stroke` is what keeps it
    // at a constant device width, so a small country's outline does not thin away to nothing —
    // and the ring, which marks the small ones, depends on it entirely.
    const highlight = required("HIGHLIGHT");
    expect(highlight).toContain("[stroke-width:2px]");
    expect(highlight).toContain("[vector-effect:non-scaling-stroke]");
    expect(highlight).toContain("[stroke-linejoin:round]");
    const ring = required("RING");
    expect(ring).toContain("[stroke-width:1.5px]");
    expect(ring).toContain("[vector-effect:non-scaling-stroke]");
  });

  it("sizes the credit in rem, not in a named Tailwind step", () => {
    // A named size carries a line-height the stylesheet never set. Measured on `/dunya/almanya`:
    // the caption renders 12px/16.8px, where the named step would make it 12px/16px and reflow
    // the caption on every country page.
    const credit = required("CREDIT");
    expect(carries(credit, "text-[0.75rem]")).toBe(true);
    expect(carries(credit, "leading-[1.4]")).toBe(true);
    expect(credit).not.toMatch(/\btext-(xs|sm|base|lg|xl)\b/);
    // 6px, the stylesheet's own `margin-top`, and not the 8px step beside it.
    expect(carries(credit, "mt-1.5")).toBe(true);
  });

  it("POSITIVE CONTROL — de-hoisting CREDIT makes the extractor return null", () => {
    const inlined = deHoistedString("CREDIT");
    expect(inlined).toContain("text-muted-foreground");
    expect(classConstant(inlined, "CREDIT")).toBeNull();
    expect(renderSites(inlined, "CREDIT")).toBe(0);
  });
});

describe("the route this figure is pinned against still mounts it", () => {
  it("the country page is the one call site, with kind=country", () => {
    // Step 1's rule, executed rather than remembered: a pin built on a route where the component
    // does not render is a pin on nothing. If this moves, every measured figure above owes a
    // re-reading on whatever renders it instead.
    expect(PAGE).toContain("<LocatorMap");
    expect(PAGE).toContain('kind="country"');
    expect(PAGE).toContain('from "@/components/map/locator-map"');
  });

  it("…and the province half is reachable code that no route renders", () => {
    // Measured 2026-09-19 on the running dev server: `/turkiye/istanbul` contains no
    // `figure[data-kind]`. The province detail page draws its own inline SVG instead. The branch
    // is converted faithfully rather than deleted, because deleting it changes the `kind`
    // contract; T-054 owns what happens to it.
    const provincePage = stripComments(
      readFileSync(
        new URL("../../app/[locale]/(site)/turkiye/[slug]/page.tsx", import.meta.url),
        "utf8",
      ),
    );
    expect(provincePage).not.toContain("<LocatorMap");
    expect(provincePage).toContain("<V2ProvinceLocatorMap");
  });
});
