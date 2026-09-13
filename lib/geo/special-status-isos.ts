// Special-status entities, HAND-MAINTAINED. There is no api-side flag to read from: the
// committed contract publishes `sovereigntyNoteTr` on CountryDetailDto only, not on the
// CountryListItemDto / CountryMapSummaryDto this page consumes — so no test in this repo can
// compare this set to the api seed. `components/v2/v2-world-sovereignty.test.ts` only FREEZES
// this set's current contents; it does NOT verify a sync invariant. When the api seed gains a
// new `sovereigntyNoteTr` row, this set must be updated by hand (and that test with it).
export const SPECIAL_STATUS_ISO_CODES = new Set(["QN", "CY", "IL", "PS", "TW", "XK"]);
