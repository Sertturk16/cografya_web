/**
 * Which Kaynaklar sentence a country page prints, and with what interpolation.
 *
 * This exists as a pure function for one reason: it is the only executable logic the
 * source-credit work adds to a rendered page, and `vitest.config.ts` collects only
 * `lib/**` and `components/**` — a branch left inside the 500-line async Server Component
 * in `app/[locale]/dunya/[slug]/page.tsx` has no gate at all (→ PR #54 `TA54-M3`). The
 * catalogue guard in `country-sources.test.ts` proves both strings are well formed; it
 * cannot prove the right one is chosen.
 *
 * ## Why the parameter accepts `undefined` (→ PR #54 `CR54-M3`)
 *
 * The contract types this `string | null`: `populationSourceNameTr/En` are `nullable: true`
 * AND in `required`, so TypeScript proves `undefined` impossible *at compile time against
 * the committed spec*. Runtime has no such proof — the web does not validate response
 * bodies, so an api that predates the field (stale environment, rolled-back deploy, an
 * older api run against a newer web) yields `undefined`. An exact `=== null` check misses
 * that and falls through to the population sentence with an empty slot, printing
 * "… nüfus ." on every country page, silently, with green CI.
 *
 * So the signature is deliberately wider than the contract and the test covers the
 * off-contract states. This is NOT a client-side default: no institution name is invented
 * here, the unknown-source case simply takes the sentence written for it. The api's own
 * field comment forbids `?? "Dünya Bankası"`, and that prohibition is respected.
 */
export type SourcesMessage =
  | { readonly key: "sources"; readonly values: { readonly populationSource: string } }
  | { readonly key: "sourcesNoPopulation"; readonly values: Record<string, never> };

/**
 * @param populationSource resolved credit from the api, or `null` when `population` is
 *   also null (today: Antarktika alone). `undefined` is off-contract but reachable — see
 *   the note above.
 */
export function sourcesMessage(populationSource: string | null | undefined): SourcesMessage {
  // Truthy, not `!== null`: catches the contract's `null`, the off-contract `undefined`,
  // and an empty string — every state in which no source can honestly be credited.
  return populationSource
    ? { key: "sources", values: { populationSource } }
    : { key: "sourcesNoPopulation", values: {} };
}
