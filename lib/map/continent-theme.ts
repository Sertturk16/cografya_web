import { CONTINENT_IDENTITY, type ContinentIdentity } from "@/lib/theme/continent-identity";

/**
 * The one continent name/count/identity table for the `/dunya` surface — a plain, boundary-free
 * module (no `"use client"`) so both `components/v2/v2-world-map-explorer.tsx` (a client
 * component) and `app/[locale]/(site)/dunya/[slug]/page.tsx` (a server component) can import it
 * without either crossing an RSC/client boundary.
 *
 * ## What used to be here, and why it is not
 *
 * `CONTINENT_META` used to carry NINE raw-Tailwind colour fields per continent — `color`,
 * `hoverColor`, `strokeColor`, `badgeClass`, `headerClass`, `borderClass`, `textClass`,
 * `gradient` and `glowColor`, 112 raw palette occurrences, the heaviest such definition in the
 * tree. They are one field now: `identity`, pointing at `lib/theme/continent-identity.ts`, which
 * is the only file that spells a continent's colour.
 *
 * That is the SAME fix this file already applied once at a shallower depth. Its previous
 * docblock recorded `DES133-I1`: `/dunya/[slug]` kept an independently-chosen `CONTINENT_THEMES`
 * palette whose hues did not match the map's on 6 of 7 continents, and moving `CONTINENT_META`
 * here so both consumers read it was the fix. It left two tables rather than one — this file and
 * `components/v2/v2-world-continents.tsx`'s `CONTINENTS_DATA`, agreeing on hue family and
 * disagreeing on stop — and two tables that agree today are two tables that can disagree
 * tomorrow, which is exactly how the third spelling came about. T-031c Task 5 closed it.
 *
 * `count` stays a plain number here, and stays hand-maintained. It is NOT derived from the
 * corpus: measured stale on 2026-09-11, the seven values sum to 196 against a 199-row seed
 * (Asia is 2 short, North America 1). Not dropped, because `v2-world-map-explorer.tsx`'s own
 * legend renders it, so removing it would change a rendered pixel on `/dunya`. Deriving it from
 * the corpus is a separate, tracked follow-up (`VALB133R2-P1`).
 */
export const CONTINENT_META: Record<
  string,
  {
    name: string;
    nameEn: string;
    /** See the note above: hand-maintained, known stale by 3 against the seed. */
    count: number;
    /** Every colour this continent wears, on the map and off it. */
    identity: ContinentIdentity;
  }
> = {
  AVRUPA: { name: "Avrupa", nameEn: "Europe", count: 44, identity: CONTINENT_IDENTITY.avrupa },
  ASYA: { name: "Asya", nameEn: "Asia", count: 48, identity: CONTINENT_IDENTITY.asya },
  AFRIKA: { name: "Afrika", nameEn: "Africa", count: 54, identity: CONTINENT_IDENTITY.afrika },
  KUZEY_AMERIKA: {
    name: "Kuzey Amerika",
    nameEn: "North America",
    count: 23,
    identity: CONTINENT_IDENTITY["kuzey-amerika"],
  },
  GUNEY_AMERIKA: {
    name: "Güney Amerika",
    nameEn: "South America",
    count: 12,
    identity: CONTINENT_IDENTITY["guney-amerika"],
  },
  OKYANUSYA: {
    name: "Okyanusya",
    nameEn: "Oceania",
    count: 14,
    identity: CONTINENT_IDENTITY.okyanusya,
  },
  ANTARKTIKA: {
    name: "Antarktika",
    nameEn: "Antarctica",
    count: 1,
    identity: CONTINENT_IDENTITY.antarktika,
  },
};
