/**
 * `bindingKind` → safe sentence class (§5.7, `deprem-sayfalari` plan) — the one place a real
 * factual error is easy to ship silently.
 *
 * `EarthquakeEventDto.bindingKind` is mandatory precisely because the api's own docblock
 * states it "never emits a sentence of the form 'an earthquake occurred in X'": the provider's
 * `province` field means "the nearest Turkish province", not "where this happened" — an
 * Iranian event is filed under `Ağrı`, an Azerbaijani one 137 km away under `Iğdır`
 * (measured, `EarthquakeBindingKind`'s own docblock; confirmed again against the live store on
 * 2026-08-29: real `across_border` rows include a Georgian event tagged to Ardahan and a
 * Syrian event tagged to Hatay). This module never composes the sentence text itself — the
 * wording is genuinely new and has no fixed `GLOSSARY.md` row yet (see the message-key
 * docblock in `messages/tr.json`'s consumer, `components/earthquake/earthquake-list.tsx`, and
 * the plan's own §5.7/§13 escalation) — it only decides WHICH of the three safe classes an
 * event's `bindingKind` belongs to, so a caller can never reach for the wrong key.
 *
 * `null` for `"inside"` is deliberate, not an oversight: the ordinary "near {province}" framing
 * is safe for an inside event, but `placeNameTr` already carries the province in parentheses
 * for that case (e.g. "Nurdağı (Gaziantep)"), so printing a second sentence saying the same
 * thing would be exactly the mechanical/redundant copy `CONTENT-STYLE.md` §22 bars. The two
 * states where a naive province sentence would misattribute a foreign or offshore event as
 * Turkish are the ones that get an explicit, safe key.
 */

import type { components } from "@/lib/api/schema";

export type EarthquakeBindingKind = components["schemas"]["EarthquakeEventDto"]["bindingKind"];

/**
 * The message-key suffix under `Earthquake.binding.*` a caller should render for this
 * `bindingKind`, or `null` when no extra sentence is needed.
 */
export type BindingSentenceKey = "offshoreNear" | "acrossBorder" | null;

export function bindingSentenceKey(bindingKind: EarthquakeBindingKind): BindingSentenceKey {
  switch (bindingKind) {
    case "inside":
      return null;
    case "offshore_near":
      return "offshoreNear";
    case "across_border":
      return "acrossBorder";
  }
}
