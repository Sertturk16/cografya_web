import { NextResponse } from "next/server";
import { getMarineOverviewSafe } from "@/lib/api/marine";

/**
 * Route handler proxy for client-side marine telemetry (/v2 live ticker).
 * Follows same architecture as /api/earthquakes/route.ts.
 */
const MARINE_PROXY_CACHE_CONTROL = "public, max-age=60, s-maxage=900, stale-while-revalidate=1800";

export async function GET() {
  try {
    const overview = await getMarineOverviewSafe();
    if (!overview || !overview.dataAvailable) {
      return NextResponse.json({ error: "data_unavailable" }, { status: 404 });
    }
    return NextResponse.json(overview, {
      headers: { "Cache-Control": MARINE_PROXY_CACHE_CONTROL },
    });
  } catch (error) {
    console.error(`[marine] proxy fetch failed: ${String(error)}`);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
