import { NextResponse } from "next/server";
import { handleReplaceProfile } from "@/lib/profile/transport.server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function PUT(request: Request): Promise<NextResponse> {
  const result = await handleReplaceProfile(request);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
