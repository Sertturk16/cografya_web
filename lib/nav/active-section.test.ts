import { describe, expect, it } from "vitest";
import { activeNavSection, inSection } from "./active-section";

describe("inSection", () => {
  it("matches the base itself and anything below it", () => {
    expect(inSection("/dunya", "/dunya")).toBe(true);
    expect(inSection("/dunya/fransa", "/dunya")).toBe(true);
  });

  it("does not match a sibling that only shares a prefix", () => {
    expect(inSection("/dunya-analizi", "/dunya")).toBe(false);
    expect(inSection("/denizler", "/deniz")).toBe(false);
  });
});

describe("activeNavSection", () => {
  it.each([
    ["/dunya-analizi", "worldAnalysis"],
    ["/dunya", "atlas"],
    ["/dunya/kita/asya", "atlas"],
    ["/turkiye/ankara", "atlas"],
    ["/deniz/karadeniz", "telemetry"],
    ["/deprem", "telemetry"],
    ["/oyun/iller", "interactive"],
    ["/araclar", "interactive"],
    ["/kitaplar/ayt-cografya", "books"],
  ] as const)("%s lights %s", (pathname, section) => {
    expect(activeNavSection(pathname)).toBe(section);
  });

  it("lights nothing on the home page or a page outside the nav", () => {
    expect(activeNavSection("/")).toBeNull();
    expect(activeNavSection("/hesabim")).toBeNull();
  });
});
