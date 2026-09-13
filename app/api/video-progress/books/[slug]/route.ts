import type { NextRequest } from "next/server";
import { handleGetBookProgress } from "@/lib/video-progress/transport.server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const result = await handleGetBookProgress(request, slug);
  return Response.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
