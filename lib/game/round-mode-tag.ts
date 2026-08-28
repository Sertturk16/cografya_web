import type { GeographicRegion } from "@/lib/api/types";
import { regionFromSlug, regionSlug } from "./region-slug";
import type { GameModeId } from "./config";

/**
 * The web-internal `mode` tag scheme submitted to `POST /api/game-rounds` (UYELIK-10 plan
 * §5.1) — riding entirely inside the api's own opaque, unvalidated `mode` string
 * (`^[a-z][a-z0-9-]{0,39}$`, "Never validated against a closed set"), so no api change and
 * no Deniz coordination is needed to carry it.
 *
 * WHY THIS FILE EXISTS. `GameModeId` (`lib/game/config.ts`) has exactly two values
 * (`"regions" | "provinces"`), but the UI has THREE named modes: Bölge Bulma, 81 İl Bulma,
 * and Bölge Bölge İl Bulma. The latter two both pass `mode="provinces"` to `<GameScreen>` —
 * the only difference is `region` (`null` vs. one of the seven `GeographicRegion` values).
 * Submitting the raw `modeId` alone would make an 81-question full-country round and an
 * 11-question single-region round indistinguishable in the saved history.
 *
 * Round-trip covers exactly the 9 real tags this repo can produce (`regions`, `provinces`,
 * `provinces-{7 region slugs}`); anything else — a future/foreign client's `mode` value, since
 * the field is unvalidated by contract — falls into `describeGameRoundModeTag`'s `"unknown"`
 * case rather than throwing or misrendering, because `GET /api/game-rounds` can in principle
 * return rows this web client did not itself write.
 */

const PROVINCES_REGION_PREFIX = "provinces-";

/** The api's own submit-tag for a round of the given mode/region — built by construction to
 *  satisfy `^[a-z][a-z0-9-]{0,39}$` (longest case, `"provinces-guneydogu-anadolu"`, is 27
 *  chars — the plan's own prose said 28; corrected here against the measured string,
 *  `round-mode-tag.test.ts`): `regionSlug()` already produces lowercase-ASCII,
 *  hyphen-separated output. */
export function buildGameRoundModeTag(modeId: GameModeId, region: GeographicRegion | null): string {
  if (modeId === "regions") return "regions";
  if (region === null) return "provinces";
  return `${PROVINCES_REGION_PREFIX}${regionSlug(region)}`;
}

export type GameRoundModeShape =
  | { readonly kind: "regions" }
  | { readonly kind: "provinces" }
  | { readonly kind: "provinces-region"; readonly region: GeographicRegion }
  | { readonly kind: "unknown"; readonly raw: string };

/** The inverse of {@link buildGameRoundModeTag}, for the history view (§5.4/§5.7) — never
 *  throws, and never guesses a fallback region: a tag that does not parse is `"unknown"`. */
export function describeGameRoundModeTag(tag: string): GameRoundModeShape {
  if (tag === "regions") return { kind: "regions" };
  if (tag === "provinces") return { kind: "provinces" };
  if (tag.startsWith(PROVINCES_REGION_PREFIX)) {
    const region = regionFromSlug(tag.slice(PROVINCES_REGION_PREFIX.length));
    if (region !== null) return { kind: "provinces-region", region };
  }
  return { kind: "unknown", raw: tag };
}
