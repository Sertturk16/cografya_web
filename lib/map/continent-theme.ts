/**
 * The one continent colour/label palette for the `/v2/dunya` surface — a plain, boundary-free
 * module (no `"use client"`) so both `components/v2/v2-world-map-explorer.tsx` (a client
 * component) and `app/[locale]/v2/dunya/[slug]/page.tsx` (a server component) can import it
 * without either crossing an RSC/client boundary. Previously `CONTINENT_META` lived only in the
 * explorer and the `[slug]` page kept an independently-chosen second palette
 * (`CONTINENT_THEMES`) whose hues did not match it on 6 of 7 continents (`DES133-I1`). Moving
 * `CONTINENT_META` here — verbatim, values and field names unchanged — and having both
 * consumers read it is the fix; see `plan.md` §5.3.6 (PR #133 fix round) for the full
 * derivation.
 */
export const CONTINENT_META: Record<
  string,
  {
    name: string;
    nameEn: string;
    color: string;
    hoverColor: string;
    strokeColor: string;
    badgeClass: string;
    headerClass: string;
    borderClass: string;
    textClass: string;
    // Hand-maintained, NOT derived from the corpus. Measured stale on 2026-09-11: the seven
    // values below sum to 196 against a 199-row seed (Asia is 2 short, North America 1).
    // Not dropped here — `v2-world-map-explorer.tsx`'s own legend renders this field, so
    // removing it would change a rendered pixel on `/v2/dunya`. Deriving it from the corpus
    // is a separate, tracked follow-up (`VALB133R2-P1`).
    count: number;
    /** Hero section background gradient on `/dunya/[slug]` — derived from the hue above. */
    gradient: string;
    /** Hero glow-backdrop colour on `/dunya/[slug]` — derived from the hue above. */
    glowColor: string;
  }
> = {
  AVRUPA: {
    name: "Avrupa",
    nameEn: "Europe",
    color: "fill-indigo-600/85 dark:fill-indigo-500/85",
    hoverColor: "hover:fill-indigo-500 dark:hover:fill-indigo-400",
    strokeColor: "stroke-indigo-400/50",
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    headerClass: "from-indigo-700 to-blue-900",
    borderClass: "border-indigo-500/30",
    textClass: "text-indigo-700 dark:text-indigo-300",
    count: 44,
    gradient: "from-indigo-500/10 via-background to-background",
    glowColor: "bg-indigo-500/10",
  },
  ASYA: {
    name: "Asya",
    nameEn: "Asia",
    color: "fill-amber-600/85 dark:fill-amber-500/85",
    hoverColor: "hover:fill-amber-500 dark:hover:fill-amber-400",
    strokeColor: "stroke-amber-400/50",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    headerClass: "from-amber-700 to-orange-950",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-700 dark:text-amber-300",
    count: 48,
    gradient: "from-amber-500/10 via-background to-background",
    glowColor: "bg-amber-500/10",
  },
  AFRIKA: {
    name: "Afrika",
    nameEn: "Africa",
    color: "fill-emerald-600/85 dark:fill-emerald-500/85",
    hoverColor: "hover:fill-emerald-500 dark:hover:fill-emerald-400",
    strokeColor: "stroke-emerald-400/50",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    headerClass: "from-emerald-700 to-emerald-950",
    borderClass: "border-emerald-500/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    count: 54,
    gradient: "from-emerald-500/10 via-background to-background",
    glowColor: "bg-emerald-500/10",
  },
  KUZEY_AMERIKA: {
    name: "Kuzey Amerika",
    nameEn: "North America",
    color: "fill-sky-600/85 dark:fill-sky-500/85",
    hoverColor: "hover:fill-sky-500 dark:hover:fill-sky-400",
    strokeColor: "stroke-sky-400/50",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    headerClass: "from-sky-700 to-cyan-950",
    borderClass: "border-sky-500/30",
    textClass: "text-sky-700 dark:text-sky-300",
    count: 23,
    gradient: "from-sky-500/10 via-background to-background",
    glowColor: "bg-sky-500/10",
  },
  GUNEY_AMERIKA: {
    name: "Güney Amerika",
    nameEn: "South America",
    color: "fill-rose-600/85 dark:fill-rose-500/85",
    hoverColor: "hover:fill-rose-500 dark:hover:fill-rose-400",
    strokeColor: "stroke-rose-400/50",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    headerClass: "from-rose-700 to-rose-950",
    borderClass: "border-rose-500/30",
    textClass: "text-rose-700 dark:text-rose-300",
    count: 12,
    gradient: "from-rose-500/10 via-background to-background",
    glowColor: "bg-rose-500/10",
  },
  OKYANUSYA: {
    name: "Okyanusya",
    nameEn: "Oceania",
    color: "fill-purple-600/85 dark:fill-purple-500/85",
    hoverColor: "hover:fill-purple-500 dark:hover:fill-purple-400",
    strokeColor: "stroke-purple-400/50",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    headerClass: "from-purple-700 to-purple-950",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-700 dark:text-purple-300",
    count: 14,
    gradient: "from-purple-500/10 via-background to-background",
    glowColor: "bg-purple-500/10",
  },
  ANTARKTIKA: {
    name: "Antarktika",
    nameEn: "Antarctica",
    color: "fill-teal-600/85 dark:fill-teal-500/85",
    hoverColor: "hover:fill-teal-500 dark:hover:fill-teal-400",
    strokeColor: "stroke-teal-400/50",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    headerClass: "from-teal-700 to-teal-950",
    borderClass: "border-teal-500/30",
    textClass: "text-teal-700 dark:text-teal-300",
    count: 1,
    gradient: "from-teal-500/10 via-background to-background",
    glowColor: "bg-teal-500/10",
  },
};
