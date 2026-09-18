import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { StatGrid, type StatGridProps } from "./stat-grid";

/** Comments stripped — a docblock explaining why something is NOT `role="alert"` contains it. */
const read = (name: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(`./${name}.tsx`, import.meta.url)), "utf8"));

describe("MetricValue makes T-024's defect impossible", () => {
  const source = read("metric-value");

  /**
   * T-024 shipped a page promising live hourly telemetry over data that was not there. The
   * fix was per-page copy conditioning, which works exactly until the next page forgets.
   * These assertions are what move the guarantee into the type instead.
   */
  it("requires the absent state — no optional marker, no default", () => {
    expect(source).toMatch(/readonly absent:\s*\{/);
    expect(source).not.toMatch(/absent\?:/);
    expect(source).not.toMatch(/absent\s*=\s*\{/);
  });

  it("renders words for an absent reading, never a zero or a dash", () => {
    expect(source).toContain("absent.label");
    // A dash sits in the same slot a number would and reads as a measurement at a glance.
    expect(source).not.toMatch(/["'`]\s*[-–—]\s*["'`]/);
  });

  it("treats null, undefined and NaN alike", () => {
    expect(source).toContain("value === null");
    expect(source).toContain("value === undefined");
    expect(source).toContain("Number.isNaN(value)");
  });

  it("formats through Intl, because Turkish uses a comma", () => {
    expect(source).toContain("Intl.NumberFormat");
  });

  it("lines numbers up in a column", () => {
    expect(source).toContain("tabular-nums");
  });
});

describe("StatTile inherits that guarantee rather than reimplementing it", () => {
  const source = read("stat-tile");

  it("composes MetricValue", () => {
    expect(source).toContain('from "./metric-value"');
    expect(source).toContain("<MetricValue");
  });

  it("does not format numbers itself", () => {
    // If it did, the required `absent` prop would stop reaching every stat on the site.
    expect(source).not.toContain("Intl.NumberFormat");
  });

  it("puts the label before the number in the DOM", () => {
    // Hearing "18,2 °C" with no idea what it measures is being told nothing.
    //
    // A REAL TAG BOUNDARY, not a substring: `"<MetricValueProps".startsWith("<MetricValue")` is
    // true, so a bare `indexOf("<MetricValue")` finds the `Omit<MetricValueProps, …>` in the
    // props type — which sits ABOVE the render and made this assertion fail on correct source.
    // Same prefix collision `components/showcase/registry.test.ts` documents for `<H1`.
    const render = /<MetricValue[\s/>]/.exec(source);
    expect(render, "stat-tile.tsx no longer renders <MetricValue>").not.toBeNull();
    expect(source.indexOf("{label}")).toBeLessThan(render!.index);
  });

  /**
   * The other half of that, and it needs its own assertion because the two pull opposite ways.
   *
   * 13 metric strips and the book facts sheet render the VALUE on top. Source order is the
   * reading order and must stay label-first; screen order is set with `order-*` instead. Without
   * this, the obvious way to restore the site's look is to move the JSX — which satisfies the
   * eye, passes every visual check, and silently deletes the guarantee above.
   */
  it("flips the two visually with order utilities, never by reordering the DOM", () => {
    expect(source).toMatch(/order-1/);
    expect(source).toMatch(/order-2/);
    // The label carries the LATER order, the value the earlier one — the flip, not just a pair
    // of utilities sitting in the file.
    const labelBlock = source.slice(source.indexOf("order-2"), source.indexOf("{label}"));
    expect(labelBlock).not.toContain("<MetricValue");
  });

  /**
   * RULING — why `fact` is not a hole in T-024's guarantee.
   *
   * The strips hold `"WGS84"`, `"Haversine"`, `"M 1.0 - 7.0+"`. The alternative to a second
   * channel was widening `MetricValue.value` to `string`, which would have let any page print
   * `"—"` or `"0"` through the component built to make exactly that impossible. So: `absent`
   * stays required on the branch that renders a number, and the literal branch cannot reach
   * `MetricValue` at all.
   */
  it("keeps the measurement branch's absent prop required, and gives the literal branch none", () => {
    expect(source).toMatch(/interface StatTileMeasurement[^}]*extends[^{]*Omit<MetricValueProps/);
    expect(source).toMatch(/readonly absent\?: never/);
    expect(source).not.toMatch(/absent\?:\s*\{/);
    // The two branches are mutually exclusive in the type, not merely by convention.
    expect(source).toMatch(/readonly fact\?: never/);
    expect(source).toMatch(/readonly value\?: never/);
  });

  it("colours the value through a closed tone union, never a raw class", () => {
    // Five strips carried `text-teal-600`/`text-cyan-600`/`text-red-600`/`text-blue-600`/
    // `text-emerald-600`, none with a dark counterpart. `components/ui/token-binding.test.ts`
    // forbids those here; this pins the thing that replaced them.
    for (const tone of ["foreground", "primary", "secondary", "accent", "destructive"]) {
      expect(source).toMatch(new RegExp(`\\b${tone}: "text-${tone}"`));
    }
    expect(source).toContain("TONE[tone]");
  });

  it("wears the site's card spelling, shadow included", () => {
    // The strips write `rounded-2xl bg-card border border-border shadow-2xs`. The component was
    // that minus the shadow, so adopting it anywhere would have flattened 52 tiles.
    expect(source).toContain("rounded-2xl");
    expect(source).toContain("border border-border");
    expect(source).toContain("bg-card");
    expect(source).toContain("shadow-2xs");
  });
});

describe("StatGrid is the shell and nothing else", () => {
  const source = read("stat-grid");

  it("offers no className escape hatch", () => {
    // PageContainer's reason: the divergence this collapses grew because every page could write
    // its own spelling, and a passthrough lets it straight back in — invisibly, because the
    // counters in components/v2/page-composition.test.ts read source spellings.
    expect(source).toMatch(/className\?: never/);
  });

  /**
   * RULING BB. THE RENDERED CLASS STRING, NOT THE SOURCE THAT IS SUPPOSED TO PRODUCE IT.
   *
   * This assertion used to be `toContain('cn("grid"')` plus a `/grid-cols-2 sm:grid-cols-4/`
   * match on the file's text, and `components/v2/page-composition.test.ts` leaned on it: the tag
   * `<StatGrid>` counts as a grid shell for `STAT_GRIDS_TOTAL`, "so the shell cannot quietly stop
   * being one". Review demonstrated that it can. Replacing the render with
   *
   *     const unused = cn("grid", COLUMNS[columns]);
   *     void unused;
   *     return <div className={cn("flex flex-col", GAP[gap], GUTTER[gutter])}>{children}</div>;
   *
   * satisfies BOTH substrings from a dead reference while collapsing thirteen live metric strips
   * to a single column at every viewport — with 217 files / 4800 tests green. A source substring
   * is evidence that a string exists in a file, never that an element wears it.
   *
   * So: render it. `StatGrid` is a pure function of props and `renderToStaticMarkup` needs no
   * jsdom (`docs/conventions.md` — this suite has none), which is the same instrument
   * `components/ui/card-variants.test.tsx` uses one directory over for the same reason. Asserted
   * as the WHOLE string in emission order, not "contains the right tokens", because a re-theme
   * that kept `grid` and changed the breakpoints would pass the weaker form.
   *
   * THE RENDERED PIN IS BETTER IN BOTH DIRECTIONS, NOT MERELY STRICTER — worth stating, because
   * "assert the output" usually reads as "assert more". Re-review built the component's `grid`
   * token at runtime (`["g","r","i","d"].join("")`): this pin stays GREEN, correctly, because the
   * element still wears exactly `grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4` and the component
   * is right. The source-substring pin it replaced would have gone RED on that same correct
   * component. So the swap removes a false negative AND a false positive.
   *
   * MUTATION-CHECKED at these values, reverted after each:
   *
   *   - the exact `flex flex-col` + `void unused` rewrite above — RED on every `columns` row,
   *     `expected 'flex flex-col gap-3 sm:gap-4' to be 'grid grid-cols-2 sm:grid-cols-4 gap-3
   *     sm:gap-4'`, which is the mutation the old pin could not see;
   *   - `"2-4"` re-spelled `grid-cols-2 md:grid-cols-4` — RED on that row alone;
   *   - `gutter="hero"` changed from `mt-8` to `mt-6` — RED on the gutter row.
   *
   * Re-review added three more, all RED on 4 assertions: the same `flex flex-col` + `void unused`
   * rewrite, a conditional rendering `grid` only when `gutter === "hero"` (the `it.each` rows run
   * at the default gutter), and the grid moved into a CHILD element with the root keeping only the
   * gutter — caught because `gridClass` reads the ROOT element's class.
   */
  /**
   * Render once, read the class off the element.
   *
   * `children` goes in the props bag rather than as `createElement`'s third argument because
   * `StatGridProps.children` is REQUIRED, and the third-argument form leaves it missing from the
   * props type and fails `tsc`. `react/no-children-prop` is a rule about JSX authoring ergonomics
   * and this file is `.ts` with no JSX in it, so the disable is scoped to this one line with its
   * reason rather than repeated at four call sites.
   */
  const gridClass = (props: Omit<StatGridProps, "children"> = {}) => {
    // eslint-disable-next-line react/no-children-prop
    const markup = renderToStaticMarkup(createElement(StatGrid, { ...props, children: "x" }));
    return /class="([^"]*)"/.exec(markup)?.[1] ?? "(no class attribute rendered)";
  };

  it.each([
    ["2-4", "grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"],
    ["2", "grid grid-cols-2 gap-3 sm:gap-4"],
  ] as const)("renders columns=%s as exactly its measured spelling", (columns, expected) => {
    expect(gridClass({ columns })).toBe(expected);
  });

  it("renders the hero gutter, and nothing for none", () => {
    expect(gridClass({ gutter: "hero" })).toBe(
      "grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8",
    );
    expect(gridClass({ gutter: "none" })).toBe("grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4");
  });

  it("the rendered element really is what the scanner reads as a grid shell", () => {
    // The bridge between this file and the counter, stated once: the class string above must
    // satisfy the `grid` + `grid-cols-*` rule `isGridShell` falls back on. Without this the two
    // files could drift apart while each stayed internally green.
    const tokens = gridClass().split(" ");
    expect(tokens).toContain("grid");
    expect(tokens.some((token) => token.startsWith("grid-cols-"))).toBe(true);
  });

  it("every union member has a product consumer — T-036's rule, applied to itself", () => {
    // Six members shipped with zero product consumers in the first round (`2-3-6`, `2-lg-4`,
    // `2-md-4`, `gutter` body/section, `gap` wide), two of them justified by a showcase specimen
    // added in the same commit. A member justified by its own demo is not a member with a
    // consumer. The measured spellings survive as prose in the docblock; the API does not.
    expect(source).toMatch(/"2-4": "grid-cols-2 sm:grid-cols-4"/);
    expect(source).toMatch(/"2": "grid-cols-2"/);
    // Asserted on the KEYS, not on class substrings: `wide: "gap-4"` and the surviving
    // `strip: "gap-3 sm:gap-4"` share the token `gap-4`, so a class-level ban fires on the member
    // that is supposed to be here. The member is the key.
    for (const cut of [`"2-3-6"`, `"2-lg-4"`, `"2-md-4"`, "body", "section", "wide", "tight"]) {
      expect(source, `${cut} is back as a union member with no product consumer`).not.toMatch(
        new RegExp(`^\\s*${cut.replace(/["-]/g, "\\$&")}:\\s`, "m"),
      );
    }
  });

  it("carries no tile styling of its own", () => {
    // It is the shell. A surface token here would mean two components drawing one card.
    expect(source).not.toContain("bg-card");
    expect(source).not.toContain("rounded-2xl");
  });
});

describe("Callout is an editorial aside, not a system alert", () => {
  const source = read("callout");

  /**
   * The boundary this asserts is the whole reason the component exists separately from
   * `Alert`. Typesetting a pedagogical note as an Alert gives it alert/status semantics, so
   * assistive technology interrupts the reader for something that is not an event — and the
   * visual language of "something broke" gets attached to ordinary teaching material.
   */
  it("carries no role at all", () => {
    expect(source).not.toMatch(/role=/);
  });

  it("uses a paragraph for its heading, not an h-level", () => {
    // A callout sits inside a section that already has a heading; a real heading here would
    // put a rung in the document outline the page structure does not have.
    expect(source).not.toMatch(/<h[1-6]\b/);
  });

  it("offers the four editorial kinds", () => {
    for (const variant of ["note", "tip", "caution", "source"]) {
      expect(source).toContain(`${variant}:`);
    }
  });

  it("binds through the -strong members for its icon tones", () => {
    expect(source).toContain("text-info-strong");
    expect(source).toContain("text-warning-strong");
  });

  /**
   * THE STRUCTURAL LINE between Callout and Alert, asserted rather than left to taste.
   *
   * Two earlier attempts distinguished them by ADDING something to Callout — a side-tab, then
   * a hairline plus a tint. The second landed the two components 2px of radius and 2 points of
   * tint apart, which measured side by side is the same component twice. The rule now runs the
   * other way: Alert is a state object and HAS a box; Callout is typeset prose and has none.
   *
   * These assertions are what stop the next well-meaning round from re-adding a fill.
   */
  it("has no fill of its own — the box belongs to Alert", () => {
    expect(source).not.toMatch(/\bbg-(?:info|success|warning|muted|card)\b/);
    expect(source).not.toMatch(/\bbg-[a-z-]+\/\d+/);
  });

  it("is separated by a rule above, never a tab down one side", () => {
    // `border-l-4` was rejected once as the most template-looking version of this component;
    // a 1px left rule is its neighbour and reopens the same argument.
    expect(source).toContain("border-t");
    expect(source).not.toMatch(/\bborder-l/);
  });

  it("gives its body the text colour, not a tinted one", () => {
    expect(source).toContain("leading-relaxed text-foreground");
  });

  it("colours the icon on the icon, not through a selector that matches nothing", () => {
    // The previous version wrote `[&>svg]:text-info-strong` on the root while the icon sat
    // three elements deep, so the child combinator matched nothing and the variant's colour
    // was never applied at all.
    expect(source).toContain("ICON_TONE");
    expect(source).not.toMatch(/\[&>svg\]:text-/);
  });
});

describe("Alert is the one with a box", () => {
  const source = stripComments(
    readFileSync(fileURLToPath(new URL("../ui/alert.tsx", import.meta.url)), "utf8"),
  );

  it("tints the whole box including the body text", () => {
    for (const variant of ["success", "warning", "destructive", "info"]) {
      expect(source).toContain(`bg-${variant}/10 text-${variant}-strong`);
    }
  });

  it("gives the hueless variant a surface that is not the card it sits on", () => {
    // bg-card measured 1.06:1 against the surface an alert normally sits on — no box at all.
    expect(source).toContain('default: "bg-muted');
  });
});

describe("EmptyState", () => {
  const source = read("empty-state");

  it("requires a title and not a description", () => {
    // A title alone is a complete empty state; a description alone is not.
    expect(source).toMatch(/readonly title: string/);
    expect(source).toMatch(/description\?:/);
  });

  it("does not announce itself", () => {
    // It is the page's ordinary content for the current filter, present on first paint.
    expect(source).not.toMatch(/role="status"/);
    expect(source).not.toMatch(/aria-live/);
  });
});

describe("Typography reproduces the documented scale", () => {
  const source = read("typography");

  /**
   * ONE exported declaration's own source, sliced out of the module.
   *
   * `typography.tsx` holds two `<h1>`-bearing components since T-035 PR3, and a whole-file
   * `toContain` cannot say WHICH of them carries the floor. Review round 1 proved that is not
   * theoretical: lowering `H1` to `text-[1.5rem]` and parking an inert
   * `text-[1.9rem] … leading-tight` on `H1Display` — where `text-4xl` overrides it and it
   * renders nothing — left both floor assertions GREEN. An assertion whose NAME claims a
   * guarantee it does not check is the exact failure this PR exists to stop, so the floor is
   * now read off `H1`'s own region.
   *
   * A region runs from its `export function` to the next one, which is all the precision this
   * file needs; `components/v2/page-composition.test.ts`'s `declarationRegions` is the general
   * version, and it lives there because that scanner walks arbitrary modules. This one walks
   * exactly one file whose shape it also asserts.
   */
  function declarationOf(name: string): string {
    const start = source.indexOf(`export function ${name}(`);
    expect(start, `${name} is not declared in typography.tsx`).toBeGreaterThan(-1);
    const next = source.indexOf("\nexport function ", start + 1);
    return next === -1 ? source.slice(start) : source.slice(start, next);
  }

  it("positive control — the slicer returns one declaration, not the module", () => {
    // Without this, every assertion below would also pass on a slicer that silently returned
    // the whole file, which is the very thing they exist to stop doing.
    const h1 = declarationOf("H1");
    expect(h1).toContain("<h1");
    expect(h1).not.toContain("H1Display");
    expect(h1).not.toContain("<h2");
    expect(h1.length).toBeLessThan(source.length);
    expect(declarationOf("H1Display")).toContain("text-4xl sm:text-6xl font-extrabold");
  });

  it("keeps the h1 floor docs/design.md pins at 1.9rem", () => {
    // app/globals.css records that a fix round once lowered this to solve a 320px wrap, and
    // that the lowering was itself the defect the next review caught.
    //
    // The CLAMP is gone and the FLOOR is not. T-035 PR3 retuned `H1` to the hub tier the other
    // 14 heroes on the site already write, which differs from the clamp in everything a reader
    // can perceive — brand colour, weight, tracking, and 48px against 41.6px at desktop. The
    // one place it is sub-perceptual is the mobile size: the pages write `text-3xl` (1.875rem),
    // 0.4px under the floor, so the component writes `text-[1.9rem]` instead. That is what this
    // assertion now holds, and it is the same rule, not a weaker one.
    //
    // Read off `H1`'s region, so `text-3xl` is forbidden HERE rather than across the module.
    // The file-wide ban this replaces would have fired the first time an `H3` or a `Kbd`
    // legitimately wanted that size — a rule about one component has no business binding six.
    const h1 = declarationOf("H1");
    expect(h1).toContain("text-[1.9rem]");
    expect(h1).not.toContain("text-3xl");
  });

  it("ships the two heading tiers and no third", () => {
    // 14 hub heroes and 3 detail heroes, measured. A third spelling is a defect, not a variant.
    expect(source).toContain("export function H1(");
    expect(source).toContain("export function H1Display(");
    expect(source).toContain("text-4xl sm:text-6xl font-extrabold");
    expect((source.match(/<h1/g) ?? []).length).toBe(2);
  });

  it("gives the arbitrary-value h1 a line-height, because the size no longer carries one", () => {
    // `text-3xl` ships a paired line-height; `text-[1.9rem]` does not. Without this the hub
    // heading sets solid and wraps into itself at 320px. Region-bound for the same reason as
    // the floor above: the decoy that defeated this satisfied it from the OTHER component.
    expect(declarationOf("H1")).toMatch(/text-\[1\.9rem\][^"]*leading-tight/);
  });

  it("keeps the h2 clamp too", () => {
    expect(source).toContain("clamp(1.4rem,1rem+1.4vw,1.8rem)");
  });

  it("exports Kbd as a real kbd element", () => {
    expect(source).toContain("<kbd");
  });

  it("constrains the lede's measure", () => {
    expect(source).toContain("max-w-prose");
  });
});
