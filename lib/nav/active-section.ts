/**
 * Which header nav item a pathname lights.
 *
 * Sections match whole path segments, never a bare prefix: `/dunya-analizi` is a sibling of
 * `/dunya`, and `startsWith("/dunya")` lit "Atlas ve Harita" on the Dünya Analizi page.
 * `pathname` is the internal (locale-less, Turkish) path `usePathname` from
 * `@/i18n/navigation` returns.
 */
export type NavSection = "atlas" | "telemetry" | "interactive" | "worldAnalysis" | "books";

export function inSection(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const SECTION_BASES: Readonly<Record<NavSection, readonly string[]>> = {
  atlas: ["/turkiye", "/dunya"],
  telemetry: ["/deniz", "/deprem"],
  interactive: ["/oyun", "/araclar"],
  worldAnalysis: ["/dunya-analizi"],
  books: ["/kitaplar"],
};

export function activeNavSection(pathname: string): NavSection | null {
  for (const [section, bases] of Object.entries(SECTION_BASES) as [
    NavSection,
    readonly string[],
  ][]) {
    if (bases.some((base) => inSection(pathname, base))) return section;
  }
  return null;
}
