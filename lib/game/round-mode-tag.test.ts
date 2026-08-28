import { describe, expect, it } from "vitest";
import type { GeographicRegion } from "@/lib/api/types";
import { REGION_KEYS, regionSlug } from "./region-slug";
import { buildGameRoundModeTag, describeGameRoundModeTag } from "./round-mode-tag";

/**
 * Round-trip coverage for all 9 real tags this web client can produce (UYELIK-10 plan §11),
 * plus the `unknown` fallback for anything that does not parse.
 */

describe("buildGameRoundModeTag", () => {
  it('tags Bölge Bulma as "regions", region ignored', () => {
    expect(buildGameRoundModeTag("regions", null)).toBe("regions");
  });

  it('tags 81 İl Bulma (no region) as "provinces"', () => {
    expect(buildGameRoundModeTag("provinces", null)).toBe("provinces");
  });

  it("tags Bölge Bölge İl Bulma as provinces-{region slug}, one per region", () => {
    for (const region of REGION_KEYS) {
      expect(buildGameRoundModeTag("provinces", region)).toBe(`provinces-${regionSlug(region)}`);
    }
  });

  it("every produced tag satisfies the api's own pattern (^[a-z][a-z0-9-]{0,39}$)", () => {
    const pattern = /^[a-z][a-z0-9-]{0,39}$/;
    expect(buildGameRoundModeTag("regions", null)).toMatch(pattern);
    expect(buildGameRoundModeTag("provinces", null)).toMatch(pattern);
    for (const region of REGION_KEYS) {
      const tag = buildGameRoundModeTag("provinces", region);
      expect(tag).toMatch(pattern);
      expect(tag.length).toBeLessThanOrEqual(40);
    }
  });

  it("the longest real tag (provinces-guneydogu-anadolu) is 27 chars — the plan's own prose said 28, corrected here against the measured string", () => {
    expect(buildGameRoundModeTag("provinces", "GUNEYDOGU_ANADOLU")).toBe(
      "provinces-guneydogu-anadolu",
    );
    expect(buildGameRoundModeTag("provinces", "GUNEYDOGU_ANADOLU")).toHaveLength(27);
  });
});

describe("describeGameRoundModeTag — the inverse", () => {
  it("round-trips every real tag this client can produce", () => {
    expect(describeGameRoundModeTag(buildGameRoundModeTag("regions", null))).toEqual({
      kind: "regions",
    });
    expect(describeGameRoundModeTag(buildGameRoundModeTag("provinces", null))).toEqual({
      kind: "provinces",
    });
    for (const region of REGION_KEYS) {
      expect(describeGameRoundModeTag(buildGameRoundModeTag("provinces", region))).toEqual({
        kind: "provinces-region",
        region,
      });
    }
  });

  it("falls back to unknown on a tag from a future/foreign client, never throwing", () => {
    const cases = ["", "something-else", "provinces-atlantis", "provinces-", "REGIONS"];
    for (const raw of cases) {
      expect(describeGameRoundModeTag(raw)).toEqual({ kind: "unknown", raw });
    }
  });

  it("does not guess a fallback region for an unparseable provinces- suffix", () => {
    const result = describeGameRoundModeTag("provinces-nowhere");
    expect(result.kind).toBe("unknown");
    if (result.kind === "unknown") expect(result.raw).toBe("provinces-nowhere");
  });

  it("is a total function over the closed GeographicRegion set (typed, exhaustive by construction)", () => {
    const regions: readonly GeographicRegion[] = REGION_KEYS;
    expect(regions).toHaveLength(7);
  });
});
