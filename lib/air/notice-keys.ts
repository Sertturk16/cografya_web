/**
 * The editorial notices the api asks this repo to render, resolved from the contract's
 * `Pm25AttributionDto.noticeKeys` (the api publishes KEYS, never texts).
 *
 * ## Why a closed whitelist and not a pass-through
 *
 * `noticeKeys` is typed `string[]` in the OpenAPI schema, so codegen cannot narrow it to
 * the four keys the api actually ships — a fifth key would type-check and then resolve to
 * a missing message. next-intl does not fail a build on a missing key: it logs and renders
 * the dotted path, which would put `airPollution.notice.whatever` in front of a reader on
 * 81 indexable pages with CI green. So an unrecognised key is SKIPPED and the section still
 * renders.
 *
 * ## The residual risk, named rather than hidden (plan §13 R-4)
 *
 * Skipping is the safe failure for a typo and the WRONG failure for a genuine new duty: if
 * the api adds a fifth notice because a fifth honest-presentation obligation appeared, this
 * repo drops it silently. Two things hold the line, neither of them this file: the api's own
 * rule that adding a key is an Atlas notification, and `notice-keys.test.ts`, which pins the
 * four slots so a contract that grows is a code change here rather than a silent omission.
 *
 * ## Where each notice goes is NOT this file's business
 *
 * The four are deliberately not rendered as a stacked "warnings" block — that is
 * `CONTENT-STYLE.md` §7's caveat pile and §22's forbidden class. Each sits where a reader
 * needs it (plan §10.2), and the component owns that placement. This file answers only
 * "which of the four did the payload ask for".
 */

/** The four notice slots this repo can render, in no particular order. */
export const PM25_NOTICE_SLOTS = [
  "annualMean",
  "provinceCentrePoint",
  "satelliteDerived",
  "gridResolution",
] as const;

export type Pm25NoticeSlot = (typeof PM25_NOTICE_SLOTS)[number];

/** Which slots the payload asked for. A slot the payload omitted is `false`. */
export type Pm25NoticeFlags = Record<Pm25NoticeSlot, boolean>;

/**
 * The contract's key namespace. The api ships fully-qualified keys
 * (`airPollution.notice.annualMean`); this repo's message namespace is `AirPollution` and
 * the key inside it is `notice.<slot>`, so the prefix is stripped rather than stored twice.
 */
const CONTRACT_KEY_PREFIX = "airPollution.notice.";

function isSlot(candidate: string): candidate is Pm25NoticeSlot {
  return (PM25_NOTICE_SLOTS as readonly string[]).includes(candidate);
}

/**
 * Resolve the contract's notice keys to render flags. Unknown keys are skipped; a
 * duplicate key is idempotent; an empty array yields all-false and the section still
 * renders (the values and the licence block are what the section is FOR — a missing
 * editorial notice is a degraded section, never a reason to withhold published data).
 */
export function pm25NoticeFlags(keys: readonly string[]): Pm25NoticeFlags {
  const flags: Pm25NoticeFlags = {
    annualMean: false,
    provinceCentrePoint: false,
    satelliteDerived: false,
    gridResolution: false,
  };
  for (const key of keys) {
    if (!key.startsWith(CONTRACT_KEY_PREFIX)) continue;
    const slot = key.slice(CONTRACT_KEY_PREFIX.length);
    if (isSlot(slot)) flags[slot] = true;
  }
  return flags;
}
