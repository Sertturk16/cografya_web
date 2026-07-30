import { describe, expect, it } from "vitest";
import { provinceUrl, SLUG_PLACEHOLDER } from "./province-url";

/**
 * Structural guards for the end-of-round province links.
 *
 * Every "bilemediklerin" link the game produces is this one substitution: the server
 * resolves the localized path ONCE through `getPathname` and the island only drops a slug
 * into it. If the substitution breaks, every missed-province link in both locales points
 * somewhere wrong — and nothing else in the pipeline is testable without a DOM.
 *
 * Every template and slug below is synthetic: what is under test is the SUBSTITUTION RULE,
 * never a real province slug or a real localized path (`CONVENTIONS.md` §2).
 */

describe("SLUG_PLACEHOLDER", () => {
  it("is lowercase ASCII, so `getPathname` and URL encoding both leave it alone", () => {
    expect(SLUG_PLACEHOLDER).toMatch(/^[a-z_]+$/);
    expect(encodeURIComponent(SLUG_PLACEHOLDER)).toBe(SLUG_PLACEHOLDER);
  });

  it("cannot collide with a real slug (a slug never contains an underscore, §B4 4.3)", () => {
    expect(SLUG_PLACEHOLDER).toContain("_");
  });
});

describe("provinceUrl", () => {
  it("substitutes the slug into the template it is handed", () => {
    expect(provinceUrl(`/hub/${SLUG_PLACEHOLDER}`, "fixture-one")).toBe("/hub/fixture-one");
  });

  it("keeps whatever locale prefix the server resolved — it builds no path of its own", () => {
    expect(provinceUrl(`/xx/hub/${SLUG_PLACEHOLDER}`, "fixture-two")).toBe("/xx/hub/fixture-two");
  });

  it("percent-encodes a slug carrying reserved characters, so it cannot escape its segment", () => {
    expect(provinceUrl(`/hub/${SLUG_PLACEHOLDER}`, "a/b?c#d e")).toBe("/hub/a%2Fb%3Fc%23d%20e");
  });

  it("cannot let a slug inject a replacement pattern ($& and friends are encoded away)", () => {
    expect(provinceUrl(`/hub/${SLUG_PLACEHOLDER}`, "$&")).toBe("/hub/%24%26");
  });

  it("leaves a template with no placeholder untouched rather than guessing where to put it", () => {
    expect(provinceUrl("/hub", "fixture-three")).toBe("/hub");
  });

  it("is stable for a slug that looks like the placeholder itself", () => {
    expect(provinceUrl(`/hub/${SLUG_PLACEHOLDER}`, SLUG_PLACEHOLDER)).toBe(
      `/hub/${SLUG_PLACEHOLDER}`,
    );
  });
});
