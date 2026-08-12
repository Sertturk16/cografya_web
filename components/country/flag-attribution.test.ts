import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * The MIT credit for the flag set, pinned against the package's own LICENSE.
 *
 * Sibling of `components/map/locator-attribution.test.ts`, and it exists for the same reason:
 * an attribution obligation is the kind of thing a refactor drops silently, because nothing
 * breaks when it goes. The country pages serve 198 SVG files from `flag-icons`, MIT asks that
 * the copyright notice travel with them, and `provenance/datasets.md` records that obligation
 * against this package by name. Until this test existed the site shipped those files with no
 * credit at all.
 *
 * The notice is compared to the LICENSE ON DISK rather than to a literal copied into the test.
 * A literal would pass forever, including on the day a package bump changes the holder or the
 * year — which is precisely the day the credit stops being true.
 */

const license = readFileSync(join(process.cwd(), "node_modules", "flag-icons", "LICENSE"), "utf8");
const copyrightLine = license
  .split("\n")
  .map((line) => line.trim())
  .find((line) => line.startsWith("Copyright"));

const trCredit = trMessages.About.dataFlagsCredit;
const enCredit = enMessages.About.dataFlagsCredit;

describe("flag-set credit", () => {
  it("reproduces the package's copyright notice character for character", () => {
    expect(copyrightLine).toBeDefined();
    expect(trCredit).toContain(copyrightLine);
  });

  it("names the licence the notice belongs to", () => {
    expect(license).toContain("MIT License");
    expect(trCredit).toContain("MIT License");
  });

  it("is IDENTICAL in both catalogues — a translated notice is no longer the notice", () => {
    expect(trCredit).toBe(enCredit);
  });

  it('is rendered inside lang="en", like the JRC citation beside it', () => {
    const page = readFileSync(
      new URL("../../app/[locale]/hakkimizda/page.tsx", import.meta.url),
      "utf8",
    )
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
      .replace(/\/\*[\s\S]*?\*\//g, " ");

    expect(page).toMatch(/<span lang="en">\{t\("dataFlagsCredit"\)\}<\/span>/);
  });
});
