import { NextResponse } from "next/server";
import { CONTENT_REVALIDATE_SECONDS } from "@/lib/api/client";
import { getUniversitiesResilient } from "@/lib/reference/reference.server";

/**
 * `/api/reference/universities` — the registration form's university list, on OUR OWN
 * origin (plan §4.4, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). No
 * dynamic segment, so this handler's body runs once at build (CI has no api service —
 * `getUniversitiesResilient` degrades to `[]` there) and is ISR-revalidated afterward, the
 * same posture `/api/search-index/{locale}` documents for its own two resilient reads.
 */
export const revalidate: typeof CONTENT_REVALIDATE_SECONDS = 3600;

export async function GET() {
  const universities = await getUniversitiesResilient();

  return NextResponse.json(universities, {
    headers: {
      // Public reference data — no cookie, no PII, nothing user-specific — so a shared cache
      // is correct. Mirrors `/api/search-index/{locale}`'s own header exactly.
      "Cache-Control": `public, max-age=300, s-maxage=${CONTENT_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
