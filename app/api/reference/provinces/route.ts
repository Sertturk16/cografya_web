import { NextResponse } from "next/server";
import { CONTENT_REVALIDATE_SECONDS, PUBLIC_REFERENCE_CACHE_CONTROL } from "@/lib/api/client";
import { getProvincesResilient } from "@/lib/api/provinces";

/**
 * `/api/reference/provinces` — the registration form's province list, on OUR OWN origin
 * (uyelik-auth-redesign plan §5.7). The page (`app/[locale]/kayit/page.tsx`) already fetches
 * `getProvincesResilient()` server-side and hands it to `RegisterForm` as a prop; the auth
 * MODAL cannot do that (shipping 81 provinces into every page's payload for a control that
 * opens on a fraction of them is an unacceptable CWV cost), so `RegisterForm` falls back to
 * this route when no `provinces` prop is supplied — the exact `fetchReferenceList` pattern it
 * already uses three times for districts/universities/departments.
 *
 * No dynamic segment, so this handler's body runs once at build (CI has no api service —
 * `getProvincesResilient` degrades to `[]` there) and is ISR-revalidated afterward, the same
 * posture `/api/reference/universities` and `/api/reference/departments` already document for
 * their own resilient reads.
 */
export const revalidate: typeof CONTENT_REVALIDATE_SECONDS = 3600;

export async function GET() {
  const provinces = await getProvincesResilient();

  return NextResponse.json(provinces, {
    headers: {
      // Public reference data — no cookie, no PII, nothing user-specific — so a shared cache
      // is correct. Mirrors `/api/reference/universities`'s own header exactly.
      "Cache-Control": PUBLIC_REFERENCE_CACHE_CONTROL,
    },
  });
}
