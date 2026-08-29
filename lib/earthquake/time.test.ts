import { describe, expect, it } from "vitest";
import { formatEarthquakeOccurredAt } from "./time";

/**
 * `formatEarthquakeOccurredAt` locks the UTC→Türkiye-time conversion the module's own docblock
 * names the stakes of: "reading the field as anything other than UTC-then-converted-once
 * publishes every earthquake three hours wrong." It is the single function both the map marker
 * (`earthquake-map.tsx:74`) and the list's time column (`earthquake-list.tsx`) call for every
 * rendered event, and had no test before this file (review TEST104-I2).
 *
 * Türkiye has held a fixed, non-DST UTC+3 offset since 2016, so a plain instant→wall-clock
 * comparison is sufficient — no timezone-transition edge case exists for this contract to hit.
 */
describe("formatEarthquakeOccurredAt — UTC → Europe/Istanbul, exactly once", () => {
  it("shifts a UTC instant forward by exactly three hours, in Turkish", () => {
    // 2026-08-29T21:15:00.000Z + 3h = 2026-08-30 00:15 Türkiye time — crosses midnight on
    // purpose, so a DATE-only bug (not just a time-only one) would fail this.
    const result = formatEarthquakeOccurredAt("2026-08-29T21:15:00.000Z", "tr");
    expect(result).toContain("2026");
    expect(result).toContain("00:15");
    expect(result).toMatch(/30/);
  });

  it("shifts the same instant forward by exactly three hours, in English", () => {
    const result = formatEarthquakeOccurredAt("2026-08-29T21:15:00.000Z", "en");
    expect(result).toContain("2026");
    expect(result).toContain("12:15");
    expect(result).toMatch(/AM/i);
    expect(result).toMatch(/30/);
  });

  it("never renders the instant's OWN UTC hour — the exact three-hours-wrong trap", () => {
    // Negative control: if the timezone conversion were ever dropped (reading the field as
    // already-local), the rendered clock would show "21:15"/"9:15 PM" instead. Asserting the
    // wrong hour is ABSENT is what would actually catch that regression; the positive
    // assertions above alone could pass on a coincidence for a different broken zone.
    const trResult = formatEarthquakeOccurredAt("2026-08-29T21:15:00.000Z", "tr");
    expect(trResult).not.toContain("21:15");
  });
});
