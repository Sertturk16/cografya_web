import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the EN work-in-progress notice (→ DEC 2026-08-04i §4).
 *
 * The component renders exactly one string, and next-intl would print
 * "Common.enWorkInProgress" rather than fail if the key went missing — on the very pages the
 * notice exists to be honest on. A dotted key path is a worse first impression than no notice.
 *
 * The key is required in BOTH catalogues even though only the English one is ever rendered.
 * `Common` is a shared namespace whose key sets are expected to match, and a tr-side hole
 * would break that invariant the moment anything else reads it.
 *
 * Structural only (`CONVENTIONS.md` §2): it does not assert what the notice says. It is a
 * `.ts` test, not `.tsx`: the repo's vitest environment is node with no jsdom, so this checks
 * the copy contract rather than the render.
 */
describe("EN work-in-progress notice", () => {
  it.each([
    ["tr", trMessages.Common],
    ["en", enMessages.Common],
  ])("resolves Common.enWorkInProgress in %s", (_locale, catalogue) => {
    const value = (catalogue as Record<string, unknown>).enWorkInProgress;
    expect(typeof value).toBe("string");
    expect((value as string).trim().length).toBeGreaterThan(0);
  });

  it("carries the same Common key set in both locales", () => {
    expect(Object.keys(enMessages.Common).sort()).toEqual(Object.keys(trMessages.Common).sort());
  });
});
