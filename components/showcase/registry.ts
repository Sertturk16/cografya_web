export interface ShowcaseCategory {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  /** Basenames in components/ui or components/patterns, without extension. */
  readonly components: readonly string[];
}

/**
 * The single source of truth for what the showcase contains.
 *
 * `components/showcase/registry.test.ts` reads this alongside the filesystem and fails if a
 * component exists without a specimen, or is listed in two categories, or is listed but does
 * not exist. That is what stops the showcase drifting from the code, which is the standard
 * way a design system dies.
 *
 * Entries for components T-034 has not built yet are present on purpose — the registry is
 * the plan, and the "listed but missing" assertion is what turns it into a worklist.
 *
 * It is a worklist in one direction only. A primitive with no product call site is DELETED,
 * not kept alive so this registry has something to list (T-036, `components/ui/orphan.test.ts`
 * and `docs/design.md`). Eight entries left here for that reason; the showcase describes the
 * code, so it shrinks when the code does.
 */
export const CATEGORIES: readonly ShowcaseCategory[] = [
  {
    slug: "temeller",
    title: "Temeller",
    blurb: "Renk token'ları, tipografi ölçeği ve klavye tuşları.",
    components: ["typography"],
  },
  {
    slug: "aksiyonlar",
    title: "Aksiyonlar",
    blurb: "Butonlar ve yükleme göstergeleri.",
    components: ["button", "spinner"],
  },
  {
    slug: "formlar",
    title: "Formlar",
    blurb: "Alan sarmalayıcısı ve girdi kontrolleri.",
    components: ["form-field", "input", "select", "custom-select", "label"],
  },
  {
    slug: "veri",
    title: "Veri",
    blurb: "Tablolar ve sayısal göstergeler.",
    components: ["table", "stat-grid", "stat-tile", "metric-value", "progress"],
  },
  {
    slug: "geri-bildirim",
    title: "Geri Bildirim",
    blurb: "Sistem durumu, editoryal not, boş durum ve ipuçları.",
    components: ["alert", "callout", "sonner", "empty-state", "tooltip", "skeleton"],
  },
  {
    slug: "duzen",
    title: "Düzen",
    blurb: "Kartlar, katmanlar, sekmeler ve gezinme.",
    components: [
      "card",
      "dialog",
      "sheet",
      "tabs",
      "accordion",
      "breadcrumb",
      "breadcrumbs",
      "breadcrumbs-nav",
      "badge",
      "page-container",
      "page-hero",
    ],
  },
  {
    slug: "harita",
    title: "Harita",
    blurb: "Harita yanına giren atıf ve lejant bileşenleri.",
    components: ["map-attribution", "map-legend"],
  },
] as const;

/**
 * Files in the two component directories that are NOT specimens.
 *
 * An explicit list rather than a pattern: an exemption nobody wrote down is how a coverage
 * test quietly stops covering things. Add to it deliberately, with a reason.
 */
export const EXEMPT_FILES: readonly string[] = [
  // Showcase machinery — it renders the specimens, it is not one.
  "theme-pair",
] as const;

export function categoryBySlug(slug: string): ShowcaseCategory | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
