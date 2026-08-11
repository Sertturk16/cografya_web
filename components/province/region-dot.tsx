import type { GeographicRegion } from "@/lib/api/types";
import styles from "./region-dot.module.css";

/**
 * The coloured dot beside the "Bölge" value in a province's Temel Bilgiler card.
 *
 * ## What it costs and what it buys
 *
 * Zero assets, zero requests: ~40 B of HTML per page plus seven CSS rules. The tokens already
 * exist (`--region-*`, Okabe–Ito, DESIGN §6.5) and the key→token mapping already exists in the
 * game's map stylesheet; this is the SECOND consumer of both. Consolidating the mapping into a
 * shared module is deliberately NOT done here — two consumers do not earn an abstraction
 * (AO-6); the third one (map colouring) is where that consolidation belongs.
 *
 * ## Why it carries a dark ring
 *
 * Three of the seven Okabe–Ito tints do not clear WCAG 1.4.11's 3:1 graphical-object floor
 * against the white `.fact` card — İç Anadolu's yellow measures 1.32:1 and is effectively
 * invisible. The palette is a documented data palette and may not be re-toned (DESIGN §6.1),
 * so the fix is a ring rather than a new hue: `--color-ink-dark` is the one neutral in this
 * system measured to clear 3:1 against ALL seven tints (worst case Marmara, 3.25:1) and
 * ≈16.9:1 against white, so the dot's boundary is visible on every row.
 *
 * ## Why it is `aria-hidden`
 *
 * The region's NAME sits immediately beside it as text, so the dot repeats information a
 * screen reader already receives. Hiding it keeps colour from ever being the only channel
 * (WCAG 1.4.1 is satisfied structurally, not by a rule) and stops the region being announced
 * twice. It also means this component ships no new user-visible string.
 */

interface RegionDotProps {
  /**
   * The api's region key (`MARMARA`, `IC_ANADOLU`, …) — the same key space the game uses.
   *
   * The contract union, not `string`, and the call site is why. The province page holds BOTH
   * `province.region` (this key) and a local `region` (its localized label, e.g. "İç Anadolu")
   * in one scope and renders them side by side, so passing the wrong one used to compile.
   * `data-region="İç Anadolu"` matches none of the seven selectors and `.dot` declares no
   * default background, so the failure was a transparent circle inside a ring on all 81
   * province pages — with tsc, eslint and every assertion green.
   */
  region: GeographicRegion;
}

export function RegionDot({ region }: RegionDotProps) {
  return <span className={styles.dot} data-region={region} aria-hidden="true" />;
}
