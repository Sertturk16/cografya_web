import { NextResponse } from "next/server";
import { handleListFavorites } from "@/lib/favorites/transport.server";

/**
 * The web half of the favorites-list surface's route handler (UYELIK-08 plan §5.3) — the
 * same ~20-line mechanical `Request` → `NextResponse` shape as
 * `app/api/video-progress/[bookVideoId]/route.ts`, with no branch of its own.
 * `handleListFavorites` (`lib/favorites/transport.server.ts`) owns the cookie read, the api
 * call and the status/code mapping.
 *
 * `GET` exported only — this route mirrors the api's own single list resource.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handleGet(request: Request) {
  const result = await handleListFavorites(request);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const GET = handleGet;
