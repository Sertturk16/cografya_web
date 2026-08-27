import { NextResponse } from "next/server";
import { handleDeleteFavorite, handlePutFavorite } from "@/lib/favorites/transport.server";

/**
 * The web half of the province-favorite surface's route handler (UYELIK-08 plan §5.3) — the
 * same ~20-line mechanical `Request` → `NextResponse` shape as
 * `app/api/video-progress/[bookVideoId]/route.ts`, with no branch of its own.
 * `handlePutFavorite`/`handleDeleteFavorite` (`lib/favorites/transport.server.ts`) own the
 * cookie read, the Origin check, the shape validation, the api call and the status/code
 * mapping.
 *
 * `PUT` and `DELETE` exported — this route mirrors the api's own
 * `/api/favorites/provinces/{plateCode}` resource 1:1.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handlePut(request: Request, ctx: { params: Promise<{ plateCode: string }> }) {
  const { plateCode } = await ctx.params;
  const result = await handlePutFavorite(request, { kind: "province", plateCode });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

async function handleDelete(request: Request, ctx: { params: Promise<{ plateCode: string }> }) {
  const { plateCode } = await ctx.params;
  const result = await handleDeleteFavorite(request, { kind: "province", plateCode });
  // IRIS91-C1 fix (PR #91 round 2, İRİS live-audit gate): the Fetch/Web `Response`
  // constructor FORBIDS a non-null body together with a null-body status (204/205/304) and
  // THROWS — `handleDeleteFavorite`'s own 204 success carries a truthy `{ ok: true }` body,
  // so `NextResponse.json(result.body, { status: 204 })` crashed on every real remove, even
  // though the api call itself had already succeeded. 204 is the ONLY null-body status this
  // module ever produces (confirmed by exhaustive call-site enumeration, remedy-validated
  // `pr-reviews/91-validator-IRIS91-C1.json`), so this branch is the whole fix.
  if (result.status === 204) {
    return new NextResponse(null, { status: 204, headers: result.headers });
  }
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const PUT = handlePut;
export const DELETE = handleDelete;
