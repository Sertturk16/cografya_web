/**
 * Which header nav item a pathname lights.
 *
 * Sections match whole path segments, never a bare prefix: `startsWith("/dunya")` would also
 * light "Atlas ve Harita" on any sibling path that merely starts with those letters.
 * `pathname` is the internal (locale-less, Turkish) path `usePathname` from
 * `@/i18n/navigation` returns.
 */
export type NavSection = "atlas" | "telemetry" | "interactive" | "books";

export function inSection(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const SECTION_BASES: Readonly<Record<NavSection, readonly string[]>> = {
  atlas: ["/turkiye", "/dunya"],
  telemetry: ["/deniz", "/deprem"],
  interactive: ["/oyun", "/araclar"],
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
