import { NextResponse } from "next/server";
import { handleDeleteMeasurement } from "@/lib/measurements/transport.server";

/**
 * The web half of the per-measurement surface's route handler (UYELIK-12 plan §5.3) —
 * `DELETE` only (no `GET`/`PATCH` — plan §2.6/§3: recall reads from the already-fetched
 * list item, and rename is deferred to the roadmap's own later item).
 * `handleDeleteMeasurement` (`lib/measurements/transport.server.ts`) owns the cookie
 * read, the Origin check, the id-shape check, the api call and the status/code mapping.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handleDelete(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await handleDeleteMeasurement(request, id);
  // IRIS91-C1 fix precedent (`app/api/favorites/provinces/[plateCode]/route.ts`): the
  // Fetch/Web `Response` constructor FORBIDS a non-null body together with a null-body
  // status (204/205/304) and THROWS — `handleDeleteMeasurement`'s own 204 success carries
  // a truthy `{ ok: true }` body, so `NextResponse.json(result.body, { status: 204 })`
  // would crash on every real remove even though the api call itself had already
  // succeeded. 204 is the ONLY null-body status this module ever produces, so this
  // branch is the whole of the fix, applied here from day one rather than found by a
  // second regression.
  if (result.status === 204) {
    return new NextResponse(null, { status: 204, headers: result.headers });
  }
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const DELETE = handleDelete;
