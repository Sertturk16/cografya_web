import { NextResponse } from "next/server";
import { handleGetLeaderboard } from "@/lib/game-rounds/transport.server";

/**
 * BFF route handler for GET /api/game-rounds/leaderboard?mode=...&page=...&pageSize=...
 * Proxies per-mode leaderboard data while strictly protecting user privacy (only firstName + lastNameInitial).
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handleGet(request: Request) {
  const url = new URL(request.url);
  const result = await handleGetLeaderboard(request, {
    mode: url.searchParams.get("mode") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const GET = handleGet;
