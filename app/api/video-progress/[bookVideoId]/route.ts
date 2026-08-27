import { NextResponse } from "next/server";
import {
  handleGetVideoProgress,
  handlePutVideoProgress,
} from "@/lib/video-progress/transport.server";

/**
 * The web half of the video-progress surface's route handler (UYELIK-06 plan §5.7) — the same
 * ~40-line mechanical `Request` → `NextResponse` shape as `app/api/auth/[...action]/route.ts`,
 * with no branch of its own. `handleGetVideoProgress`/`handlePutVideoProgress`
 * (`lib/video-progress/transport.server.ts`) own the cookie read, the Origin check, the size
 * bound, the api call and the status/code mapping.
 *
 * `GET` and `PUT` exported; no other method — this proxy is read-and-idempotent-replace, never
 * a create/delete surface.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handleGet(request: Request, ctx: { params: Promise<{ bookVideoId: string }> }) {
  const { bookVideoId } = await ctx.params;
  const result = await handleGetVideoProgress(request, bookVideoId);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

async function handlePut(request: Request, ctx: { params: Promise<{ bookVideoId: string }> }) {
  const { bookVideoId } = await ctx.params;
  const result = await handlePutVideoProgress(request, bookVideoId);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const GET = handleGet;
export const PUT = handlePut;
