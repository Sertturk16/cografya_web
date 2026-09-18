import { describe, expect, it } from "vitest";
import {
  type OverflowElement,
  type SweepFailure,
  formatFailure,
  formatSummary,
} from "@/lib/overflow-sweep/report";

/**
 * A FAILURE LINE HAS TO NAME THE ELEMENT.
 *
 * T-046's `.chartFrame` defect was reported as "`/turkiye/istanbul` scrolls sideways at 320"
 * and took a human a long time to locate from that. The sweep's whole claim over a
 * screenshot round is that it hands over the route, the viewport, the theme, the pixel count
 * AND the offending declaration, so those five things are what this suite pins.
 *
 * The ordering assertion is the substantive one. An overflowing element drags every
 * unclipped ancestor of it into the report, and the reader's eye goes to the first line —
 * which therefore has to be the box whose right edge equals `scrollWidth`, not the deepest
 * descendant that happens to be narrower.
 */

const element = (over: Partial<OverflowElement> & { selector: string }): OverflowElement => ({
  left: 41,
  right: 341,
  width: 300,
  overflowPx: 21,
  leaf: false,
  hints: {},
  ...over,
});

const failure: SweepFailure = {
  shapeId: "province",
  url: "/turkiye/istanbul",
  locale: "tr",
  viewport: "320",
  theme: "light",
  clientWidth: 320,
  scrollWidth: 341,
  elements: [
    element({
      selector: "div.chartLayout > svg.svg",
      left: 46,
      right: 336,
      width: 290,
      overflowPx: 16,
      leaf: true,
      text: "İstanbul — aylık ortalama sıcaklık",
      hints: { width: "290px" },
    }),
    element({
      selector: "div.chartLayout > div.chartFrame",
      hints: { "min-width": "300px", width: "300px" },
    }),
  ],
};

describe("formatFailure", () => {
  const output = formatFailure(failure);

  it("names route, viewport, theme and the overflow in pixels", () => {
    expect(output).toContain("/turkiye/istanbul");
    expect(output).toContain("320 · light");
    expect(output).toContain("overflow 21px");
    expect(output).toContain("scrollWidth 341 > clientWidth 320");
  });

  it("names the offending element and the declaration behind it", () => {
    expect(output).toContain("div.chartFrame");
    expect(output).toContain("min-width: 300px");
  });

  it("puts the widest overflow first, not the deepest element", () => {
    const lines = output.split("\n");
    const frame = lines.findIndex((line) => line.includes("div.chartFrame"));
    const svg = lines.findIndex((line) => line.includes("svg.svg"));
    expect(frame).toBeGreaterThan(-1);
    expect(frame).toBeLessThan(svg);
  });

  it("marks the leaf so a reader can tell a container from a culprit", () => {
    const svgLine = output.split("\n").find((line) => line.includes("svg.svg")) ?? "";
    expect(svgLine.trimStart().startsWith("→")).toBe(true);
  });

  it("prints a leaf's text, which is how a badge or a notice gets identified", () => {
    expect(output).toContain("İstanbul — aylık ortalama sıcaklık");
  });

  it("says so when the document overflows but no element reaches past the edge", () => {
    const output = formatFailure({ ...failure, elements: [] });
    expect(output).toContain("no element reaches past the viewport");
  });
});

describe("formatSummary", () => {
  it("is a verdict, not a count", () => {
    expect(formatSummary({ urls: 21, checks: 168, failures: 0, retries: 0 })).toContain("PASS");
    expect(formatSummary({ urls: 21, checks: 168, failures: 3, retries: 0 })).toContain(
      "FAIL  3 overflowing combinations",
    );
  });

  it("does not read PASS when pages never loaded", () => {
    const summary = formatSummary({
      urls: 22,
      checks: 14,
      failures: 0,
      retries: 0,
      loadFailures: 8,
    });
    expect(summary).not.toContain("PASS");
    expect(summary).toContain("8 pages never loaded");
  });

  it("surfaces navigation retries, so a flaky run cannot read as a clean one", () => {
    expect(formatSummary({ urls: 21, checks: 168, failures: 0, retries: 2 })).toContain(
      "2 navigation retries",
    );
    expect(formatSummary({ urls: 21, checks: 168, failures: 0, retries: 0 })).not.toContain(
      "retries",
    );
  });
});
