import { NextResponse } from "next/server";
import { apiGet } from "@/lib/api/client";
import { buildHealthReport } from "@/lib/health/report";

/**
 * Liveness probe for the deploy and Docker's HEALTHCHECK (`scripts/healthcheck.mjs`).
 *
 * The API is probed through `apiGet`, the one path to it, with `revalidate: 0` so the answer is
 * never a cached one; the API's own probe is the bare `/health` (outside its `/api` prefix).
 * Public through Caddy like every route; it reveals only whether the API answers.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const report = await buildHealthReport(() => apiGet("/health", { revalidate: 0 }));
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
