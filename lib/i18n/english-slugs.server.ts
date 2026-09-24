import "server-only";
import { getBooks } from "@/lib/api/books";
import { getCountries } from "@/lib/api/countries";
import { getProvinces } from "@/lib/api/provinces";
import type { ApiSlugRoute, SlugResolver } from "./english-redirect";

/**
 * The api-backed half of the `/en` redirect (T-105): EN slug → TR slug for provinces,
 * countries and books, from the same list endpoints the hubs render.
 *
 * Cost: one list request per route per {@link TTL_MS}, per server process, and only when a
 * request for `/en/dunya/<slug>`, `/en/turkiye/<slug>` or `/en/books/<slug>` actually arrives —
 * every other `/en` URL is answered from `routing.pathnames` alone. A failed load is remembered
 * for {@link FAILURE_TTL_MS} so an api outage costs one attempt a minute rather than one per
 * redirect, and while it lasts those URLs land on their hub, which is still a working page.
 */

const TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;

type SlugMap = ReadonlyMap<string, string>;

const LOADERS: Record<ApiSlugRoute, () => Promise<SlugMap>> = {
  "/turkiye/[slug]": async () => toMap(await getProvinces()),
  "/dunya/[slug]": async () => toMap(await getCountries()),
  "/kitaplar/[slug]": async () => toMap(await getBooks()),
};

function toMap(rows: readonly { slugEn: string; slugTr: string }[]): SlugMap {
  return new Map(rows.map((row) => [row.slugEn, row.slugTr]));
}

const cache = new Map<ApiSlugRoute, { at: number; ttl: number; map: Promise<SlugMap | null> }>();

function slugMap(route: ApiSlugRoute): Promise<SlugMap | null> {
  const now = Date.now();
  const hit = cache.get(route);
  if (hit && now - hit.at < hit.ttl) return hit.map;

  const entry = { at: now, ttl: TTL_MS, map: Promise.resolve<SlugMap | null>(null) };
  entry.map = LOADERS[route]().catch((error: unknown) => {
    console.warn(`[en-redirect] slug map for ${route} unavailable: ${String(error)}`);
    entry.ttl = FAILURE_TTL_MS;
    return null;
  });
  cache.set(route, entry);
  return entry.map;
}

export const resolveEnglishSlug: SlugResolver = async (route, enSlug) => {
  const map = await slugMap(route);
  return map?.get(enSlug) ?? null;
};
