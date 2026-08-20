/**
 * Pure presentation helpers for the long-term PM2.5 series (HAVA-KIRLILIGI).
 *
 * NO React, NO i18n, NO DTO imports — numbers and tokens in, numbers and tokens out, so
 * every rule below is unit-testable in isolation (`lib/climate/scale.ts` discipline). The
 * component owns locale FORMATTING via `next-intl`; this file owns the two decisions that
 * must be made exactly once and used in more than one place.
 */

/**
 * The unit token the contract publishes (`Pm25AnnualDto.unit`), byte for byte: U+00B5
 * MICRO SIGN, then a plain ASCII "3". It is a machine token, not typography.
 */
export const PM25_CONTRACT_UNIT = "µg/m3";

/**
 * The unit as a READER must see it, mapped from the contract token.
 *
 * `GLOSSARY.md` §3 writes the unit `µg/m³` (superscript three, U+00B3) and the payload
 * writes `µg/m3` (plain three). Both are correct in their own layer, so the visible form
 * comes from the i18n catalogue and this function only decides WHETHER the catalogue's
 * form applies to the token that actually arrived.
 *
 * An UNRECOGNISED token is returned unchanged. That is the deliberate choice: if the
 * provider line ever publishes a different unit, showing the raw token is honest and
 * visibly odd, whereas printing "µg/m³" over it would silently relabel someone else's
 * number. The contract does not guarantee a single token (plan §16 V-1), so this branch
 * is a real one, not a defensive flourish.
 */
export function pm25DisplayUnit(contractUnit: string, canonicalDisplayUnit: string): string {
  return contractUnit === PM25_CONTRACT_UNIT ? canonicalDisplayUnit : contractUnit;
}

/** Decimal places every published PM2.5 figure carries. */
export const PM25_DECIMALS = 1;

/**
 * Round one PM2.5 concentration to the published precision — ONCE, so the visible number
 * and the JSON-LD `PropertyValue` are the same number rather than two representations of
 * it (`SEO-POLICY.md` §B5 5.7: structured data may not carry what the page does not show).
 *
 * ONE decimal, not the two the OpenAPI example shows. The example is an example; the
 * binding fact is the provider's own caveat, which says these estimates are "unlikely to
 * fully resolve PM₂.₅ gradients at the gridded resolution" — a second decimal would claim
 * precision the source itself disclaims (→ Atlas ruling on plan §16 V-3).
 */
export function roundPm25(value: number): number {
  const factor = 10 ** PM25_DECIMALS;
  return Math.round(value * factor) / factor;
}
