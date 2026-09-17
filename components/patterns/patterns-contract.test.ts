import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Comments stripped — a docblock explaining why something is NOT `role="alert"` contains it. */
const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}.tsx`, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

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

  it("binds through the -strong members, since its fills are tints", () => {
    expect(source).toContain("text-info-strong");
    expect(source).toContain("text-warning-strong");
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
    expect(source).toContain("clamp(1.9rem,1.2rem+2.6vw,2.6rem)");
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
