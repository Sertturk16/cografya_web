import { NextResponse } from "next/server";
import { CONTENT_REVALIDATE_SECONDS } from "@/lib/api/client";
import { getDepartmentsResilient } from "@/lib/reference/reference.server";

/**
 * `/api/reference/departments` — the registration form's bachelor-programme list, on OUR
 * OWN origin (plan §4.4, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`).
 * Same shape and reasoning as `./universities/route.ts`'s sibling file — see its docblock.
 */
export const revalidate: typeof CONTENT_REVALIDATE_SECONDS = 3600;

export async function GET() {
  const departments = await getDepartmentsResilient();

  return NextResponse.json(departments, {
    headers: {
      "Cache-Control": `public, max-age=300, s-maxage=${CONTENT_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
