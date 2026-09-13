import "server-only";
import { serverEnv } from "@/lib/env.server";

/**
 * The web half of the video-cover proxy (P2-KAPAK-TARAYICI-YOLU, closing SEC138-NEW-I1).
 *
 * Serves book video covers from the web application's own origin by proxying bytes
 * server-side from `cografya_api`'s `GET /api/video-cover/:bookVideoId`. The browser and
 * reader-facing pages never see, resolve, or contact any internal API origin or provider CDN.
 *
 * ## Four Governing Rules (kapak-devri.md §3)
 * 1. NO REDIRECTS: The route never redirects (301/302/307/308). Redirecting would expose the
 *    target address in the `Location` header, defeating the proxy boundary.
 * 2. NO BYTE STORAGE: Bytes are streamed directly (`Response(body)`). Zero storage to disk,
 *    Redis, or memory cache. Caching is purely HTTP client/CDN caching via `Cache-Control`.
 * 3. UPSTREAM PINNING: Outbound requests only target the configured internal `API_BASE_URL`
 *    at `/api/video-cover/{bookVideoId}`. Arbitrary URLs or redirects are rejected.
 * 4. UNIFORM 404: All failure states (malformed UUID, API 404, network failure, timeout)
 *    return the identical uniform 404 with `Cache-Control: no-store`.
 */

const BOOK_VIDEO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBookVideoIdShape(value: string): boolean {
  return BOOK_VIDEO_ID_PATTERN.test(value);
}

const VIDEO_COVER_REQUEST_TIMEOUT_MS = 15_000;

export const VIDEO_COVER_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=604800";

function notFoundResponse(): Response {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

/**
 * Proxies the book video cover bytes from the backend API.
 */
export async function handleGetVideoCover(bookVideoId: string): Promise<Response> {
  if (!isBookVideoIdShape(bookVideoId)) {
    return notFoundResponse();
  }

  const base = new URL(serverEnv.API_BASE_URL);
  const targetUrl = new URL(`/api/video-cover/${encodeURIComponent(bookVideoId)}`, base);

  // Safety check: ensure target stays strictly on configured API host and scheme
  if (targetUrl.origin !== base.origin) {
    return notFoundResponse();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_COVER_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl.href, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "image/jpeg, image/*",
      },
    });

    if (!res.ok || !res.body) {
      // Drain response body if present to return connection to undici pool
      try {
        await res.body?.cancel();
      } catch {
        // Ignored
      }
      return notFoundResponse();
    }

    const responseHeaders = new Headers({
      "Content-Type": res.headers.get("content-type") || "image/jpeg",
      "Cache-Control": res.headers.get("cache-control") || VIDEO_COVER_CACHE_CONTROL,
      "Cross-Origin-Resource-Policy": "same-origin",
    });

    const contentLength = res.headers.get("content-length");
    if (contentLength !== null) {
      responseHeaders.set("Content-Length", contentLength);
    }

    return new Response(res.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch {
    return notFoundResponse();
  } finally {
    clearTimeout(timeout);
  }
}
