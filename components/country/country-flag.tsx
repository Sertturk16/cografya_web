import { hasFlag } from "@/lib/geo/flag-set";
import styles from "./country-flag.module.css";

/**
 * The "Bayrak" card in a country's Temel Bilgiler fact sheet.
 *
 * ## Why a fact card and not a mark beside the `<h1>`
 *
 * The `dl` already runs an `auto-fill` grid, so one more `<dt>/<dd>` pair costs zero layout
 * risk on 191 pages. Putting the flag in the title block would rewrite the heading area of
 * every country page — a much larger blast radius for a purely cosmetic gain (plan §7.4).
 *
 * ## Fail-soft, and what it currently means
 *
 * A row whose ISO code has no asset renders NOTHING — never an empty `<img>`, never an "eksik
 * veri" placeholder. Today exactly one seeded row takes that path: `QN` (KKTC), because the
 * upstream MIT set refuses it and our own asset is not drawn yet (plan §7.6,
 * `lib/geo/flag-set.ts`). That leaves `CY` with a flag and `QN` without, which DEC 2026-08-08c
 * md.2 identified as NOT a neutral silence. It is deliberately surfaced at the owner's sample
 * gate (`/dunya/kibris-cumhuriyeti` beside `/dunya/kuzey-kibris-turk-cumhuriyeti`) rather than
 * resolved here — this component has no standing to settle it.
 *
 * ## A11y and CLS
 *
 * The flag is INFORMATIVE, so it carries a real alt ("Brezilya bayrağı") rather than `alt=""`;
 * a screen reader hears "Bayrak: Brezilya bayrağı". It is never the only carrier of the
 * country's name (the `<h1>` and the fact sheet already say it), so a failed load loses no
 * information. Explicit `width`/`height` in the source ratio (4:3) plus a fixed box hold
 * CLS at zero. WCAG's contrast rules do not apply to a flag (logo/brand exemption).
 */

interface CountryFlagProps {
  /** Uppercase ISO 3166-1 alpha-2 code, straight from the api. */
  isoCode: string;
  /** Localized `<dt>` label ("Bayrak" / "Flag"). */
  label: string;
  /** Localized alt text ("{name} bayrağı" / "Flag of {name}"). */
  alt: string;
  /** The page's own `.fact` grid-cell class — the card must sit in the same rhythm. */
  className?: string;
}

export function CountryFlag({ isoCode, label, alt, className }: CountryFlagProps) {
  if (!hasFlag(isoCode)) return null;

  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>
        {/* Plain <img>, not next/image — see the ENGINEERING §4 #9 exception and the reasoning
            in components/map/locator-map.tsx. The 4:3 attribute pair is the SOURCE ratio of the
            `flags/4x3` set; the rendered size is fixed in CSS. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9
            exception (→ DEC 2026-08-08a md.3). A 32 × 24 px flag can never be the LCP
            element, and the fixed CSS box plus the 4:3 attribute pair hold CLS at zero. */}
        <img
          className={styles.flag}
          src={`/flags/${isoCode}.svg`}
          alt={alt}
          width={4}
          height={3}
          loading="lazy"
          decoding="async"
        />
      </dd>
    </div>
  );
}
