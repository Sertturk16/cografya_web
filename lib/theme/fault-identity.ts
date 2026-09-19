/**
 * A fault zone wears ONE colour, and this is the only file that spells how.
 *
 * `app/globals.css` decides WHAT colour each of the three fay zonu is and why the set is
 * standard rather than styled: `--fault-*` is the fill, `--fault-*-tint` is the 15% wash that
 * fill becomes as a surface, and `--fault-*-text` is the label that sits on it. This module is
 * the one place that turns those three tokens into the Tailwind classes a component can wear,
 * so a surface that names a fault reaches for a member here instead of re-spelling the tokens —
 * or, as two files in this codebase did until T-031c, re-declaring the hue outright:
 *
 *   - `lib/earthquake/fault-lines-data.ts` held `badgeClass` / `borderClass` / `accentColor`
 *   - `app/[locale]/(site)/deprem/page.tsx` wrote all three fault cards out inline
 *
 * The two AGREED with each other, so this is a consolidation rather than a correction — the
 * same shape the basin set had, and the opposite of the region and continent sets, where the
 * call sites contradicted the token. Two tables agreeing today is not the same property as one
 * table: they are back the moment anyone edits one of them. Hence one module.
 *
 * `app/[locale]/(site)/deprem/fay-hatlari/page.tsx` is why it matters more here than the
 * agreement suggests. Its metric strip is hand-rolled specifically so its three figures can
 * carry the fault hues, and the comment above it records the ruling: "the tile colour says
 * WHICH FAULT, and it has to agree with the card below it". Before this module, agreeing meant
 * a reader comparing two files by eye.
 *
 * ## Why literal strings and not a template
 *
 * Tailwind v4 scans source text for class names; a class assembled at runtime from the fault id
 * produces no CSS at all. Every class below is therefore written out in full, per fault, and
 * the three entries are checked against each other by `components/v2/fault-identity.test.ts`
 * rather than by construction.
 *
 * ## Contrast
 *
 * Measured figures for `-text` on each surface, with the backdrop each figure is a ratio TO,
 * live in `app/globals.css` beside the token declarations (TILE, BADGE, PANEL, DECK and CHIP)
 * and are re-derived by `lib/theme/fault-palette.test.ts`. Nothing here restates them: a ratio
 * copied away from the value it measures is how a table of correct figures comes to name a
 * surface the page never painted.
 *
 * ## No opaque badge member, and that is a measurement
 *
 * `lib/theme/region-identity.ts` and `lib/theme/continent-identity.ts` both carry one, because
 * each has a chip sitting in a table row that hovers and each measured 4.41:1 there. Every
 * fault surface was checked for that shape and none of them moves: the `/deprem` cards declare
 * no hover state at all, the `fay-hatlari` article changes only its border alpha, and the two
 * hovering surfaces on that page — the historical-earthquake rows and the province links —
 * carry no fault mark. A member with nothing to protect would be a member nobody could ever
 * make fail.
 */

/** The three fault ids, spelled exactly as the `--fault-*` tokens are. */
export type FaultId = "kaf" | "daf" | "bafs";

export interface FaultIdentity {
  /** The fault's id, i.e. the `--fault-*` token's own name. Also its in-page anchor. */
  readonly id: FaultId;
  /**
   * The label that sits on any of this module's surfaces, and on a bare card.
   *
   * One member rather than a `label`/`accent` pair: the `fay-hatlari` metric figure, that
   * page's section glyphs and the `/deprem` card heading are the same colour on purpose, and
   * two names for one class is how they come to differ.
   */
  readonly label: string;
  /** The 15% wash of the fill, as a surface. Translucent, so one value serves both themes. */
  readonly surface: string;
  /** `surface` + `label` + a 30% edge: the fault-type badge on a `fay-hatlari` article. */
  readonly badge: string;
  /**
   * The article's own edge — 40%, going to 60% on hover. The only hover colour on that page,
   * and it changes the border alone, which is why no opaque label member is needed.
   */
  readonly articleEdge: string;
  /** The `/deprem` summary card: a 5% wash inside a 30% edge. */
  readonly card: string;
  /** The mechanism chip inside that card: a 10% wash and the label. */
  readonly chip: string;
}

/**
 * Keyed by id rather than by anything derived, so the key IS the token name: a reader can see
 * that `daf` wears `--fault-daf-*` without holding a second mapping in their head.
 */
export const FAULT_IDENTITY: Readonly<Record<FaultId, FaultIdentity>> = {
  kaf: {
    id: "kaf",
    label: "text-[var(--fault-kaf-text)]",
    surface: "bg-[var(--fault-kaf-tint)]",
    badge: "bg-[var(--fault-kaf-tint)] text-[var(--fault-kaf-text)] border-[var(--fault-kaf)]/30",
    articleEdge: "border-[var(--fault-kaf)]/40 hover:border-[var(--fault-kaf)]/60",
    card: "border-[var(--fault-kaf)]/30 bg-[var(--fault-kaf)]/5",
    chip: "bg-[var(--fault-kaf)]/10 text-[var(--fault-kaf-text)]",
  },
  daf: {
    id: "daf",
    label: "text-[var(--fault-daf-text)]",
    surface: "bg-[var(--fault-daf-tint)]",
    badge: "bg-[var(--fault-daf-tint)] text-[var(--fault-daf-text)] border-[var(--fault-daf)]/30",
    articleEdge: "border-[var(--fault-daf)]/40 hover:border-[var(--fault-daf)]/60",
    card: "border-[var(--fault-daf)]/30 bg-[var(--fault-daf)]/5",
    chip: "bg-[var(--fault-daf)]/10 text-[var(--fault-daf-text)]",
  },
  bafs: {
    id: "bafs",
    label: "text-[var(--fault-bafs-text)]",
    surface: "bg-[var(--fault-bafs-tint)]",
    badge:
      "bg-[var(--fault-bafs-tint)] text-[var(--fault-bafs-text)] border-[var(--fault-bafs)]/30",
    articleEdge: "border-[var(--fault-bafs)]/40 hover:border-[var(--fault-bafs)]/60",
    card: "border-[var(--fault-bafs)]/30 bg-[var(--fault-bafs)]/5",
    chip: "bg-[var(--fault-bafs)]/10 text-[var(--fault-bafs-text)]",
  },
};

/** The identity of one fault zone. Total over `FaultId`, so there is no absent case. */
export function faultIdentityOf(id: FaultId): FaultIdentity {
  return FAULT_IDENTITY[id];
}
