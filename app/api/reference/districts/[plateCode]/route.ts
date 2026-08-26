import { NextResponse } from "next/server";
import { CONTENT_REVALIDATE_SECONDS } from "@/lib/api/client";
import { getProvincesResilient } from "@/lib/api/provinces";
import { getDistricts, isValidPlateCode } from "@/lib/reference/reference.server";

/**
 * `/api/reference/districts/{plateCode}` — il→ilçe, on OUR OWN origin (plan §4.4,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). A PATH segment, not a
 * query parameter: {@link generateStaticParams} below prerenders the 81 real plate codes at
 * build, so an unknown/malformed segment is refused before any api call rather than opening
 * an unbounded dynamic cache-key space (§4.4 decision 1).
 *
 * `robots.ts` already disallows `/api/`, and nothing links to this address — the same
 * un-discoverable, cookie-free, cache-safe posture `/api/search-index/{locale}` documents
 * for itself.
 */
export const revalidate: typeof CONTENT_REVALIDATE_SECONDS = 3600;

/**
 * Pre-renders every REAL plate code at build. `getProvincesResilient()` degrades to `[]`
 * when the api is unreachable at build (CI has no api service) — with `[]`, NO district
 * route is prerendered at all, and every real request is generated on demand at runtime
 * instead (the identical posture every other enumerating consumer in this repo already has,
 * plan §4.4's "Build resilience" paragraph). `dynamicParams` is left at its default `true`,
 * so a code outside this list is not automatically 404'd by Next — the guard in `GET` below
 * is what actually refuses a malformed segment.
 */
export async function generateStaticParams() {
  const provinces = await getProvincesResilient();
  return provinces.map((province) => ({ plateCode: province.plateCode }));
}

export async function GET(_request: Request, ctx: { params: Promise<{ plateCode: string }> }) {
  const { plateCode } = await ctx.params;

  // A malformed segment is refused BEFORE any api call — a real 404, never a soft-200
  // (`ENGINEERING.md` §4 #6 applied to a data route). A well-formed but UNMATCHED code still
  // reaches the api below and answers `[]` with a 200, matching the api's own contract.
  if (!isValidPlateCode(plateCode)) {
    return new NextResponse(null, { status: 404 });
  }

  const districts = await getDistricts(plateCode);

  return NextResponse.json(districts, {
    headers: {
      // Public reference data — no cookie, no PII, nothing user-specific (plan §4.4) — so a
      // shared cache is correct. Mirrors `/api/search-index/{locale}`'s own header exactly.
      "Cache-Control": `public, max-age=300, s-maxage=${CONTENT_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
