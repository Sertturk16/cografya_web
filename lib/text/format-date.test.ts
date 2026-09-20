import { describe, expect, it } from "vitest";
import { SITE_TIME_ZONE, formatDay, formatDayTime } from "./format-date";

/**
 * The regression this file exists for (T-064).
 *
 * `/hesabim/ayarlar` threw React #418 — "the server rendered text didn't match the client" — on
 * every load, for months, silently. Measured on production rather than reasoned about: the
 * server's HTML said `19 Eylül 2026` and the browser's DOM said `20 Eylül 2026` for the same
 * account. The container runs UTC; the reader's browser runs Europe/Istanbul. The card formatted
 * `createdAt` with no `timeZone`, so each runtime used its OWN, and an account created after
 * 21:00 UTC is already the next day in Istanbul.
 *
 * The pair of instants below is the bug: 20:59:59Z and 21:00:00Z are the same calendar day in
 * UTC and different calendar days in Istanbul. A formatter that does not pin the zone answers
 * "19 / 19" on a UTC machine — which is what CI is — so removing the pin turns these red rather
 * than merely making them machine-dependent.
 */
describe("dates are formatted in ONE time zone, not the runtime's", () => {
  const BEFORE_MIDNIGHT = "2026-09-19T20:59:59.000Z"; // 23:59:59 in Istanbul, still the 19th
  const AFTER_MIDNIGHT = "2026-09-19T21:00:00.000Z"; // 00:00:00 in Istanbul, already the 20th

  it("is pinned to the site's own zone", () => {
    expect(SITE_TIME_ZONE).toBe("Europe/Istanbul");
  });

  describe("formatDay", () => {
    it("reads an instant as the reader in Türkiye reads it, not as UTC", () => {
      expect(formatDay(BEFORE_MIDNIGHT, "tr")).toBe("19 Eylül 2026");
      expect(formatDay(AFTER_MIDNIGHT, "tr")).toBe("20 Eylül 2026");
    });

    it("says the same thing in English, in the same zone", () => {
      expect(formatDay(BEFORE_MIDNIGHT, "en")).toBe("19 September 2026");
      expect(formatDay(AFTER_MIDNIGHT, "en")).toBe("20 September 2026");
    });

    it("accepts a Date as readily as an ISO string — call sites hold both", () => {
      expect(formatDay(new Date(AFTER_MIDNIGHT), "tr")).toBe("20 Eylül 2026");
    });

    it("takes the short form the compact lists use", () => {
      expect(formatDay(AFTER_MIDNIGHT, "tr", "short")).toBe("20 Eyl 2026");
    });

    it("drops the year for the leaderboard column that never showed one", () => {
      expect(formatDay(AFTER_MIDNIGHT, "tr", "dayMonth")).toBe("20 Eyl");
      // Still zone-pinned in the year-less form — the shape must not smuggle the bug back.
      expect(formatDay(BEFORE_MIDNIGHT, "tr", "dayMonth")).toBe("19 Eyl");
    });
  });

  describe("formatDayTime", () => {
    /**
     * The earthquake feed's shape: a day and a clock time together. The clock is where the zone
     * matters most — an event at 21:30 UTC is 00:30 the NEXT day in Istanbul, and a reader being
     * told an earthquake happened "yesterday at 21:30" when their neighbours felt it after
     * midnight is the kind of wrong that is worse than a hydration warning.
     */
    it("carries the clock into the same zone as the day", () => {
      expect(formatDayTime("2026-09-19T21:30:00.000Z", "tr")).toBe("20 Eyl 00:30");
      expect(formatDayTime("2026-09-19T20:30:00.000Z", "tr")).toBe("19 Eyl 23:30");
    });

    it("stays on a 24-hour clock, which is how Turkish prose writes time", () => {
      expect(formatDayTime("2026-09-19T14:05:00.000Z", "tr")).toBe("19 Eyl 17:05");
    });
  });

  describe("bad input", () => {
    /**
     * An unparseable date must not render "Invalid Date" into the page. The API is the source of
     * these strings and has never sent one, so this is a floor rather than a workaround.
     */
    it("renders an em dash rather than Invalid Date", () => {
      expect(formatDay("not-a-date", "tr")).toBe("—");
      expect(formatDayTime("not-a-date", "tr")).toBe("—");
    });
  });
});
