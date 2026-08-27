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
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const PUT = handlePut;
export const DELETE = handleDelete;
