/**
 * Canonical form of a plaka kodu for JOINING map shapes to API province data.
 *
 * The generated map artifact stores plate codes zero-padded ("01".."81"). The API
 * contract's own examples are 2-digit ("34"), but to stay robust regardless of
 * whether the API zero-pads single-region codes ("06" vs "6"), both sides are
 * normalized to a leading-zero-stripped string before comparison. Non-numeric or
 * empty input is returned trimmed (defensive — never throws on a join key).
 */
export function normalizePlate(plateCode: string): string {
  const trimmed = plateCode.trim();
  const asNumber = Number(trimmed);
  return Number.isInteger(asNumber) && trimmed !== "" ? String(asNumber) : trimmed;
}
