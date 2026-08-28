import { NextResponse } from "next/server";
import {
  handleCreateMeasurement,
  handleListMeasurements,
} from "@/lib/measurements/transport.server";

/**
 * The web half of the measurements surface's route handler (UYELIK-12 plan §5.3) — the
 * same ~30-line mechanical `Request` → `NextResponse` shape as
 * `app/api/game-rounds/route.ts`, with no branch of its own.
 * `handleListMeasurements`/`handleCreateMeasurement` (`lib/measurements/transport.server.ts`)
 * own the cookie read, the Origin check, the size bound, the api call and the
 * status/code mapping.
 *
 * `GET` and `POST` exported; no other method — this proxy is read-and-idempotent-create,
 * never an update/delete surface (that lives at `[id]/route.ts`).
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handleGet(request: Request) {
  const result = await handleListMeasurements(request);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

async function handlePost(request: Request) {
  const result = await handleCreateMeasurement(request);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export const GET = handleGet;
export const POST = handlePost;
