import { NextResponse } from "next/server";
import { handleGetVideoIdentity } from "@/lib/video-identity/transport.server";

/**
 * The web half of the video-identity surface's route handler (P2 plan §5.3) — the same
 * ~15-line mechanical `Request` → `NextResponse` shape as
 * `app/api/video-progress/[bookVideoId]/route.ts`, with no branch of its own.
 * `handleGetVideoIdentity` (`lib/video-identity/transport.server.ts`) owns the cookie read,
 * the api call and the status/code mapping.
 *
 * `GET` only — this proxy is a read, never a write surface.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handleGet(request: Request, ctx: { params: Promise<{ bookVideoId: string }> }) {
  const { bookVideoId } = await ctx.params;
  const result = await handleGetVideoIdentity(request, bookVideoId);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const GET = handleGet;
