import { NextResponse } from "next/server";
import { PUBLIC_REFERENCE_CACHE_CONTROL } from "@/lib/api/client";
import { getProvinces } from "@/lib/api/provinces";

/**
 * `/api/reference/provinces` — the registration form's province list, on OUR OWN origin
 * (uyelik-auth-redesign plan §5.7). The page (`app/[locale]/kayit/page.tsx`) already fetches
 * the province list server-side and hands it to `RegisterForm` as a prop; the auth MODAL
 * cannot do that (shipping 81 provinces into every page's payload for a control that opens
 * on a fraction of them is an unacceptable CWV cost), so `RegisterForm` falls back to this
 * route when no `provinces` prop is supplied — the exact `fetchReferenceList` pattern it
 * already uses three times for districts/universities/departments.
 *
 * `force-dynamic`: this handler always runs at request time and is never prerendered or
 * ISR-cached by Next. The production Docker build has no network access to the api
 * container, so a build-time snapshot of this route would always bake in an empty `[]` —
 * previously served to real users for up to an hour after every deploy, until ISR's
 * background revalidation kicked in (T-020, same fix applied here). Freshness/caching is
 * handled entirely by this handler's own `Cache-Control` header below, which the CDN and
 * browser already respect.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const provinces = await getProvinces();

  return NextResponse.json(provinces, {
    headers: {
      // Public reference data — no cookie, no PII, nothing user-specific — so a shared cache
      // is correct. Mirrors `/api/reference/universities`'s own header exactly.
      "Cache-Control": PUBLIC_REFERENCE_CACHE_CONTROL,
    },
  });
}
