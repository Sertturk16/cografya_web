import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

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
    // Hearing "18,2 °C" with no idea what it measures is being told nothing; the visual
    // hierarchy is carried by type size, not by source order.
    // The JSX render, not the `Omit<MetricValueProps, …>` in the props type above it.
    expect(source.indexOf("{label}")).toBeLessThan(source.indexOf("<MetricValue {...metric}"));
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
    expect(source).toContain("text-[1.9rem]");
    expect(source).not.toContain("text-3xl");
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
    // heading sets solid and wraps into itself at 320px.
    expect(source).toMatch(/text-\[1\.9rem\][^"]*leading-tight/);
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
