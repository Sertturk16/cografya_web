import { NextResponse } from "next/server";
import { handleAuthRequest } from "@/lib/auth/transport.server";

/**
 * The whole browser-facing auth surface (plan §6.1,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-03-plan.md`). One catch-all instead of
 * nine files: there is exactly one function that can produce a browser-facing auth
 * response, and every guarantee in `lib/auth/transport.server.ts`'s docblock (P1/P2/P3) is
 * written into it once. `[...action]` (not `[[...action]]`) means bare `/api/auth` matches
 * nothing and Next 404s it without this handler running.
 *
 * This file is ~40 lines of mechanical `Request` → `NextResponse` conversion with NO branch
 * of its own: `handleAuthRequest` owns the action lookup, the Origin check, the size bound,
 * the body read, the cookie read, the api call and the status/code mapping — all of it
 * inside the module `transport.server.test.ts` reaches. No unit test covers this file
 * itself (a route handler needs Next's request context, which vitest does not provide);
 * plan §13.3's curl controls exercise it over the wire instead.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

async function handle(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const result = await handleAuthRequest(request, action);
  const response = NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
  for (const cookie of result.cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export const GET = handle;
export const POST = handle;
