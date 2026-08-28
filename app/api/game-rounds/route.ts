import { NextResponse } from "next/server";
import { handleListGameRounds, handleSubmitGameRound } from "@/lib/game-rounds/transport.server";

/**
 * The web half of the game-rounds surface's route handler (UYELIK-10 plan §5.3) — the same
 * ~35-line mechanical `Request` → `NextResponse` shape as
 * `app/api/video-progress/[bookVideoId]/route.ts`, with no branch of its own.
 * `handleListGameRounds`/`handleSubmitGameRound` (`lib/game-rounds/transport.server.ts`) own
 * the cookie read, the Origin check, the size bound, the api call and the status/code
 * mapping.
 *
 * `GET` and `POST` exported; no other method — this proxy is read-and-idempotent-submit,
 * never an update/delete surface.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handleGet(request: Request) {
  const url = new URL(request.url);
  const result = await handleListGameRounds(request, {
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

async function handlePost(request: Request) {
  const result = await handleSubmitGameRound(request);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const GET = handleGet;
export const POST = handlePost;
