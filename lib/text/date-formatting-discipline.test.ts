import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { label, readSource, repoRoot } from "@/lib/test-support/composition-scan";

/**
 * One date formatter, and it is the one that pins the time zone (T-064).
 *
 * `Intl` without an explicit `timeZone` uses the runtime's, and a server-rendered page has two
 * runtimes: a UTC container and the reader's browser. `/hesabim/ayarlar` threw React #418 on every
 * load for months because of it — server `19 Eylül 2026`, client `20 Eylül 2026` — and four other
 * call sites were the same shape waiting for a row created after 21:00 UTC.
 *
 * What makes this worth a test rather than a note: the broken form LOOKS right. `new
 * Date(x).toLocaleDateString("tr-TR", { day, month, year })` names a locale, so it reads as
 * deliberate and localised, and the bug only shows for three hours a day, in a console nobody has
 * open. Nothing in review catches that reliably; a grep does.
 *
 * NUMBER formatting is untouched. `toLocaleString` on a population or an area has no zone in it,
 * and `lib/text/format-number.ts` is its own shared helper for a different reason.
 */

const DATE_APIS = [
  // A `Date` formatted through the locale APIs — both halves of the earthquake feed's old helper.
  "toLocaleDateString(",
  "toLocaleTimeString(",
  // The explicit formatter, which is what the settings card used.
  "Intl.DateTimeFormat(",
] as const;

/**
 * The rule is NOT "one file may call them" — the repo already had two modules doing this
 * correctly (`lib/earthquake/time.ts`, whose docblock reasons the zone out at length, and
 * `lib/home/featured.ts`), and an allowlist would have declared them violations and invited
 * someone to rewrite working code. The rule is the actual invariant: a file that formats a date
 * must NAME a zone. That is self-maintaining — a new formatter passes by doing the right thing,
 * not by being added to a list here.
 */
const FORMATTER = "lib/text/format-date.ts";

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
  });

const files = ["app", "components", "lib"].flatMap((dir) => walk(join(repoRoot, dir)));

describe("dates are formatted in one place", () => {
  it("reads the tree it means to read", () => {
    // Anti-vacuity: an empty list would pass the rule below for free.
    expect(files.length).toBeGreaterThan(250);
    expect(files.map(label)).toContain(FORMATTER);
  });

  it.each(DATE_APIS)("%s is never called without naming a time zone", (api) => {
    const unpinned = files
      .filter((file) => {
        const source = readSource(file);
        return source.includes(api) && !source.includes("timeZone");
      })
      .map(label)
      .sort();

    expect(
      unpinned,
      `these format a date in whatever zone the runtime happens to be in, which is UTC on the ` +
        `server and the reader's zone in the browser — use lib/text/format-date.ts:\n  ` +
        unpinned.join("\n  "),
    ).toEqual([]);
  });

  it("finds the formatters it is policing — anti-vacuity for the rule above", () => {
    // If the API spellings ever stop matching the code, every assertion above passes on an empty
    // list. These are the files that SHOULD match, so a typo in `DATE_APIS` is visible.
    const withDates = files.filter((file) =>
      DATE_APIS.some((api) => readSource(file).includes(api)),
    );
    expect(withDates.map(label)).toContain(FORMATTER);
    expect(withDates.map(label)).toContain("lib/earthquake/time.ts");
    expect(withDates.length).toBeGreaterThanOrEqual(3);
  });

  it("the shared formatter does pin one", () => {
    // The other half of the rule: routing every call site through one file is worth nothing if
    // that file forgets the `timeZone` too.
    const source = readSource(join(repoRoot, FORMATTER));
    expect(source).toContain('SITE_TIME_ZONE = "Europe/Istanbul"');
    const calls = source.split("Intl.DateTimeFormat(").length - 1;
    const pins = source.split("timeZone: SITE_TIME_ZONE").length - 1;
    expect(pins, "every formatter in the shared file names the zone").toBe(calls);
  });
});
