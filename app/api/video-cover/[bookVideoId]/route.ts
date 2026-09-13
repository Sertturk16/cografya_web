import { handleGetVideoCover } from "@/lib/video-cover/transport.server";

/**
 * Route handler for `GET /api/video-cover/[bookVideoId]` (P2-KAPAK-TARAYICI-YOLU).
 *
 * Proxies the book video cover bytes through the web application's own origin,
 * ensuring no internal API host or provider CDN address reaches the reader's browser.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ bookVideoId: string }> },
): Promise<Response> {
  const { bookVideoId } = await ctx.params;
  return handleGetVideoCover(bookVideoId);
}
