import { hasFlag } from "@/lib/geo/flag-set";
import styles from "./country-flag.module.css";

/**
 * The "Bayrak" card in a country's Temel Bilgiler fact sheet.
 *
 * ## Why a fact card and not a mark beside the `<h1>`
 *
 * The `dl` already runs an `auto-fill` grid, so one more `<dt>/<dd>` pair costs zero layout
 * risk on 199 pages. Putting the flag in the title block would rewrite the heading area of
 * every country page — a much larger blast radius for a purely cosmetic gain (plan §7.4).
 *
 * ## Fail-soft, and what it currently means
 *
 * A row whose ISO code has no asset renders NOTHING — never an empty `<img>`, never an "eksik
 * veri" placeholder. No seeded row takes that path today: the package covers 198 of the 199,
 * and `QN` (KKTC) resolves through our own asset (`lib/geo/flag-set.ts`, DEC 2026-08-08m /
 * 08-08p). The guard stays because the seed can grow, not because a gap is open.
 *
 * ## A11y and CLS
 *
 * The flag is INFORMATIVE, so it carries a real alt ("Brezilya bayrağı") rather than `alt=""`;
 * a screen reader hears "Bayrak: Brezilya bayrağı". It is never the only carrier of the
 * country's name (the `<h1>` and the fact sheet already say it), so a failed load loses no
 * information. Explicit `width`/`height` plus a fixed box hold CLS at zero. WCAG's contrast
 * rules do not apply to a flag (logo/brand exemption).
 *
 * The 4:3 attribute pair is the ratio of the BOX, not a promise about the file. It matches
 * the package's `flags/4x3` set, and our own `qn.svg` is 3:2 by law (DEC 2026-08-08p), so it
 * sits centred inside the same box with a thin band above and below. That is the intended
 * outcome: the card is a container, and the flag is never cropped or stretched to fill it.
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
            in components/map/locator-map.tsx. The 4:3 attribute pair is the ratio of the CSS
            box, which is what CLS depends on; the rendered size is fixed in CSS. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9
            exception (→ DEC 2026-08-08a md.3). A 32 × 24 px flag can never be the LCP
            element, and the fixed CSS box plus the 4:3 attribute pair hold CLS at zero. */}
        <img
          className={styles.flag}
          // Normalised, because `hasFlag` normalises before answering. An api row carrying
          // "tr" or " TR" would otherwise pass the gate and emit a URL that is not one of the
          // prerendered params — which, now that the route sets `dynamicParams = false`, is a
          // hard 404 on a country page whose own gate just said the flag exists.
          src={`/flags/${isoCode.trim().toUpperCase()}.svg`}
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
