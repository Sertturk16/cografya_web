import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";
import { monthName } from "./month";

/**
 * `monthName` is byte-relocated from the W1 chart, but now ALSO feeds the climate JSON-LD
 * `hottestMonth`/`coldestMonth` `PropertyValue`s (machine-readable structured data), so a
 * locale-resolution or 1-based/0-based regression would silently corrupt structured data
 * across every province page, not just a visual caption. `createFormatter` builds a real
 * `Intl`-backed formatter in plain Node (no jsdom); `timeZone: "UTC"` matches the mid-month
 * Date.UTC() the helper uses and silences next-intl's environment fallback.
 */
const tr = createFormatter({ locale: "tr", timeZone: "UTC" });
const en = createFormatter({ locale: "en", timeZone: "UTC" });

describe("monthName", () => {
  it("resolves localized long month names (1-based)", () => {
    expect(monthName(tr, 1, "long")).toBe("Ocak");
    expect(monthName(tr, 8, "long")).toBe("Ağustos");
    expect(monthName(tr, 12, "long")).toBe("Aralık");
    expect(monthName(en, 1, "long")).toBe("January");
    expect(monthName(en, 7, "long")).toBe("July");
  });

  it("resolves short month names too", () => {
    expect(monthName(en, 1, "short")).toBe("Jan");
    expect(monthName(en, 12, "short")).toBe("Dec");
  });

  it("treats month as 1-based, not a JS 0-based index", () => {
    // month=3 must be March, not April — guards the `month - 1` convention.
    expect(monthName(en, 3, "long")).toBe("March");
  });
});
