import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import enMessages from "@/messages/en.json";
import { OSM_COPYRIGHT_URL, plainAttribution } from "./osm-credit";

/**
 * One message, two renderers (see `osm-credit.ts`). These assertions are what stops the two from
 * drifting: the catalogues have to carry the link markup the HTML renderer needs, and the SVG
 * renderer has to be able to get plain words back out of it.
 */
describe("the OSM credit's two forms", () => {
  const catalogues = [
    ["tr", trMessages.Map.attribution],
    ["en", enMessages.Map.attribution],
  ] as const;

  it.each(catalogues)("%s carries the link markup the rich renderer needs", (_locale, message) => {
    // `t.rich` throws at runtime on a tag with no handler, and renders nothing useful on a
    // message with no tag — so the catalogue having exactly this one is load-bearing.
    expect(message).toContain("<osm>");
    expect(message).toContain("</osm>");
  });

  it.each(catalogues)(
    "%s strips back to plain words with no angle brackets",
    (_locale, message) => {
      const plain = plainAttribution(message);
      expect(plain).not.toContain("<");
      expect(plain).not.toContain(">");
      expect(plain).toContain("OpenStreetMap");
      expect(plain).toContain("ODbL");
      expect(plain.startsWith("©")).toBe(true);
    },
  );

  it("strips only the tag it knows, so a new one is visible rather than swallowed", () => {
    // The point of the narrow regex, asserted: an unhandled tag must survive into the drawn SVG
    // where someone will see it, instead of disappearing and leaving a silently wrong credit.
    expect(plainAttribution("© <osm>OSM</osm>, <odbl>ODbL</odbl>")).toBe(
      "© OSM, <odbl>ODbL</odbl>",
    );
  });

  it("points at the page OSM's own guidance names", () => {
    expect(OSM_COPYRIGHT_URL).toBe("https://www.openstreetmap.org/copyright");
  });
});
