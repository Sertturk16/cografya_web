import type { MarineValue } from "@/lib/api/types";

/**
 * The FIVE distinguishable renders of one marine value (SPEC-ADDENDUM §7.7, plan §3.3) —
 * classified once, here, as a pure function rather than as branching inside a component.
 *
 * The contract carries two independent axes: `status` (why the value is or is not there,
 * four cases) and `freshness` (how old the cached copy is, and always `null` unless the
 * status is `ok`). Crossing them yields exactly five renders worth telling apart:
 *
 *   1. `ok` + `fresh`         → the number
 *   2. `ok` + `stale`         → the number, marked, with the absolute instant it went stale
 *   3. `no_data`              → "covered here, nothing right now"
 *   4. `not_supported`        → "the provider carries no such field in this sea" (PERMANENT)
 *   5. `unavailable`          → "we cannot reach it right now"
 *
 * 3, 4 and 5 must NOT render alike. `not_supported` is a permanent product truth — CMEMS
 * publishes no wave field inside the Marmara at all — while `no_data` is a temporary gap and
 * `unavailable` is our own outage. Collapsing them into one "—" would tell a reader that the
 * Marmara's missing wave height is a glitch that might clear up.
 *
 * Kept out of the components on purpose: a render decision that lives in JSX can only be
 * verified by rendering, and this repo's test environment is `node` with no DOM. Here the
 * whole 4 × 2 grid plus the contract-violating combinations are ordinary unit tests.
 */

/** The three non-numeric renders. Each has its own sentence; none is an em-dash. */
export type MarineValueStatusKind = "noData" | "notSupported" | "unavailable";

export type MarineValueView =
  | {
      kind: "value";
      value: number;
      unit: MarineValue["unit"];
      /** `true` for render #2. The mark is a WORD, never colour alone (WCAG 1.4.1). */
      stale: boolean;
      /** Absolute ISO instant the value went stale, when the api states one. */
      staleSinceUtc: string | null;
      /** In-cell offset to the model grid centre (km), when the api reports one. */
      distanceKm: number | null;
    }
  | { kind: "status"; status: MarineValueStatusKind };

/**
 * `status` → message key, exhaustive by TYPE.
 *
 * A `Record<Union, …>` rather than a template key (`t(`status.${status}`)`): a template
 * compiles whatever the union does, so a fifth status added to the contract would ship a
 * missing-key crash into an indexable table cell. This map fails at `tsc` instead — the same
 * reasoning the catalogue's enum maps are built on.
 *
 * It is also what the message-key guard derives its expectations from, so a new state cannot
 * reach production without its copy (`messages.test.ts`).
 */
export const MARINE_VALUE_STATUS_KEY: Record<MarineValueStatusKind, string> = {
  noData: "status.noData",
  notSupported: "status.notSupported",
  unavailable: "status.unavailable",
};

/** The stale marker's key — declared here so the guard derives it rather than hard-codes it. */
export const MARINE_FRESHNESS_STALE_KEY = "freshness.stale";

/**
 * Classifies one value into its render.
 *
 * CONTRACT-VIOLATING INPUT IS A FIRST-CLASS CASE. `status: "ok"` with `value: null` cannot
 * happen per the contract, but if it ever does — an api regression, a hand-written fixture,
 * a payload from a newer api than this build — the honest answer is `unavailable`, not a
 * blank cell and not a crash: we genuinely cannot show a number, and we say so in the same
 * words we use for every other case where we cannot. A non-finite number (`NaN`, `Infinity`
 * out of a bad JSON parse) is treated identically; formatting one would print "NaN" into
 * indexable HTML.
 *
 * `freshness` is read ONLY on the `ok` path (the contract nulls it elsewhere), and an absent
 * freshness is treated as fresh rather than stale: claiming staleness we cannot prove is as
 * dishonest as hiding it.
 *
 * The unit is taken from the VALUE, never from the layer catalogue: the catalogue describes
 * a quantity in general while the payload states what this particular number is measured in,
 * and if the two ever disagree the number's own unit is the one that is true of the number.
 */
export function marineValueView(value: MarineValue): MarineValueView {
  if (value.status !== "ok") {
    return { kind: "status", status: statusKindOf(value.status) };
  }

  if (value.value === null || !Number.isFinite(value.value)) {
    return { kind: "status", status: "unavailable" };
  }

  return {
    kind: "value",
    value: value.value,
    unit: value.unit,
    stale: value.freshness === "stale",
    staleSinceUtc: value.staleSinceUtc,
    distanceKm: value.distanceKm,
  };
}

/** Contract `status` → view kind. Anything unknown degrades to `unavailable`, not a throw. */
function statusKindOf(status: MarineValue["status"]): MarineValueStatusKind {
  switch (status) {
    case "no_data":
      return "noData";
    case "not_supported":
      return "notSupported";
    case "unavailable":
      return "unavailable";
    default:
      // Unreachable for today's contract (`tsc` proves the four cases are covered), reachable
      // at RUNTIME the day the api adds a fifth status. "We cannot show it" is true of every
      // status we do not understand, so it is the safe default.
      return "unavailable";
  }
}

/** Narrowing helper for callers that only care whether a number is on screen. */
export function hasNumber(
  view: MarineValueView,
): view is Extract<MarineValueView, { kind: "value" }> {
  return view.kind === "value";
}
