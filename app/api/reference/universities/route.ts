import { NextResponse } from "next/server";
import { PUBLIC_REFERENCE_CACHE_CONTROL } from "@/lib/api/client";
import { getUniversities } from "@/lib/reference/reference.server";

/**
 * `/api/reference/universities` — the registration form's university list, on OUR OWN
 * origin (plan §4.4, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`).
 *
 * `force-dynamic`: this handler always runs at request time and is never prerendered or
 * ISR-cached by Next. The production Docker build has no network access to the api
 * container, so a build-time snapshot of this route would always bake in an empty `[]` —
 * previously served to real users for up to an hour after every deploy, until ISR's
 * background revalidation kicked in (T-020). Freshness/caching is handled entirely by this
 * handler's own `Cache-Control` header below, which the CDN and browser already respect.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const universities = await getUniversities();

  return NextResponse.json(universities, {
    headers: {
      // Public reference data — no cookie, no PII, nothing user-specific — so a shared cache
      // is correct. Mirrors `/api/search-index/{locale}`'s own header exactly.
      "Cache-Control": PUBLIC_REFERENCE_CACHE_CONTROL,
    },
  });
}
