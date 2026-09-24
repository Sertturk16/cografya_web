import { routing, type AppPathname } from "@/i18n/routing";
import { getContinentBySlug } from "@/lib/geo/continents";
import { regionFromSlug } from "@/lib/game/region-slug";

/**
 * Where an English URL lands while `ENGLISH_ENABLED` is off (T-105).
 *
 * `proxy.ts` answers every `/en` and `/en/...` request with a permanent redirect to the path
 * this module computes. The EN segment table is still `routing.pathnames` — the switch drops
 * `en` from the SERVED locales, never from the table — so `/en/sea/black-sea` is matched
 * against the same templates that used to serve it and rebuilt from the TR template of the
 * same route: `/deniz/karadeniz`.
 *
 * Dynamic values are the part a template cannot translate. Countries carry a different slug
 * per locale (`germany` ↔ `almanya`, 145 of 199 differ), and provinces and books carry two
 * columns that happen to agree today; those three ask a {@link SlugResolver} backed by the
 * api's list endpoints (`lib/i18n/english-slugs.server.ts`). Continents and regions are
 * answered from static tables. A value nothing recognises lands on the route's own hub
 * (`/en/dunya/atlantis` → `/dunya`) and a path no template matches walks up to the nearest
 * prefix that does, down to `/` — a withdrawn English URL never ends on a 404.
 */

/** The three routes whose `[slug]` differs, or may differ, per locale and needs api data. */
export type ApiSlugRoute = "/turkiye/[slug]" | "/dunya/[slug]" | "/kitaplar/[slug]";

/**
 * EN slug → TR slug for one api-backed route. `null` means "no such entity" (the redirect
 * goes to the hub); a throw means "could not ask" and is treated the same way.
 */
export type SlugResolver = (route: ApiSlugRoute, enSlug: string) => Promise<string | null>;

const API_SLUG_ROUTES: ReadonlySet<string> = new Set<ApiSlugRoute>([
  "/turkiye/[slug]",
  "/dunya/[slug]",
  "/kitaplar/[slug]",
]);

const EN_PREFIX = "/en";

/** `/en` itself or anything under it — not `/enerji` or `/en-iyi`. */
export function isEnglishPath(pathname: string): boolean {
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`);
}

type PathnameEntry = string | Readonly<Record<string, string>>;

function templateFor(entry: PathnameEntry, locale: "tr" | "en"): string {
  if (typeof entry === "string") return entry;
  const localized = entry[locale];
  // Every entry declares both locales (`CLAUDE.md`: "Every route needs an entry … (TR and
  // EN)"), so this only fires if that rule is broken — loudly, not with a wrong redirect.
  if (localized === undefined) throw new Error(`routing.pathnames entry has no "${locale}"`);
  return localized;
}

function segmentsOf(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function isDynamic(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

/** Params captured by `template` from `path`, or `null` when it does not match. */
function matchTemplate(template: string, path: string): Record<string, string> | null {
  const want = segmentsOf(template);
  const have = segmentsOf(path);
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    const w = want[i] as string;
    const h = have[i] as string;
    if (isDynamic(w)) params[w.slice(1, -1)] = h;
    else if (w !== h) return null;
  }
  return params;
}

interface EnglishMatch {
  readonly pathname: AppPathname;
  readonly params: Readonly<Record<string, string>>;
}

/**
 * The route an unprefixed EN path belongs to. A static template beats a dynamic one, so
 * `/dunya/continents` is the continents hub and not a country called "continents" — the same
 * precedence next-intl's own matcher applies.
 */
export function matchEnglishPathname(path: string): EnglishMatch | null {
  let best: { match: EnglishMatch; dynamicCount: number } | null = null;
  for (const [pathname, entry] of Object.entries(routing.pathnames) as [
    AppPathname,
    PathnameEntry,
  ][]) {
    const template = templateFor(entry, "en");
    const params = matchTemplate(template, path);
    if (params === null) continue;
    const dynamicCount = Object.keys(params).length;
    if (best === null || dynamicCount < best.dynamicCount) {
      best = { match: { pathname, params }, dynamicCount };
    }
  }
  return best?.match ?? null;
}

/** The TR value of one dynamic segment, or `null` when the entity is unknown. */
async function turkishParam(
  pathname: AppPathname,
  value: string,
  resolveSlug: SlugResolver,
): Promise<string | null> {
  if (API_SLUG_ROUTES.has(pathname)) {
    try {
      return await resolveSlug(pathname as ApiSlugRoute, value);
    } catch {
      return null;
    }
  }
  switch (pathname) {
    case "/dunya/kita/[slug]":
      return getContinentBySlug(value)?.slugTr ?? null;
    // One identifier in both locales (`lib/game/region-slug.ts`); checked so an unknown one
    // lands on the hub instead of a 404.
    case "/turkiye/bolge/[slug]":
    case "/oyun/bolge-bolge-il/[bolge]":
      return regionFromSlug(value) === null ? null : value;
    default:
      // `/design-system/[category]`: the same string in both locales.
      return value;
  }
}

function fill(template: string, params: Readonly<Record<string, string>>): string {
  const filled = segmentsOf(template).map((segment) =>
    isDynamic(segment) ? (params[segment.slice(1, -1)] ?? segment) : segment,
  );
  return `/${filled.join("/")}`;
}

/** The TR template with its dynamic tail dropped: `/dunya/kita/[slug]` → `/dunya/kita`. */
function hubOf(trTemplate: string): string {
  const segments = segmentsOf(trTemplate);
  while (segments.length > 0 && isDynamic(segments[segments.length - 1] as string)) {
    segments.pop();
  }
  return `/${segments.join("/")}`;
}

/**
 * The Turkish path for an English one. `pathname` is the request path WITH its `/en` prefix
 * (`/en/dunya/germany`); the query string is the caller's to carry over.
 */
export async function turkishPathFor(pathname: string, resolveSlug: SlugResolver): Promise<string> {
  const segments = segmentsOf(pathname.slice(EN_PREFIX.length));
  for (let length = segments.length; length >= 0; length--) {
    const match = matchEnglishPathname(`/${segments.slice(0, length).join("/")}`);
    if (match === null) continue;

    const trTemplate = templateFor(routing.pathnames[match.pathname], "tr");
    const trParams: Record<string, string> = {};
    for (const [name, value] of Object.entries(match.params)) {
      const translated = await turkishParam(match.pathname, value, resolveSlug);
      if (translated === null) return hubOf(trTemplate);
      trParams[name] = translated;
    }
    return fill(trTemplate, trParams);
  }
  return "/";
}
