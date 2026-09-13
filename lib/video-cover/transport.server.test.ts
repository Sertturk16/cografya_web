import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleGetVideoCover,
  isBookVideoIdShape,
  VIDEO_COVER_CACHE_CONTROL,
} from "./transport.server";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test:3001", INTERNAL_REQUEST_TOKEN: undefined },
}));

const VALID_BOOK_VIDEO_ID = "11111111-2222-4333-8444-555555555555";
const INVALID_BOOK_VIDEO_ID = "not-a-valid-uuid";

function fetchMock(): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("lib/video-cover/transport.server", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isBookVideoIdShape", () => {
    it("accepts a well-formed UUID", () => {
      expect(isBookVideoIdShape(VALID_BOOK_VIDEO_ID)).toBe(true);
      expect(isBookVideoIdShape("c246d465-6d6f-4157-a62a-b6e46f1abb4e")).toBe(true);
    });

    it("rejects non-UUID strings and injection attempts", () => {
      expect(isBookVideoIdShape(INVALID_BOOK_VIDEO_ID)).toBe(false);
      expect(isBookVideoIdShape("../escape")).toBe(false);
      expect(isBookVideoIdShape("")).toBe(false);
      expect(isBookVideoIdShape("11111111-2222-4333-8444-555555555555/extra")).toBe(false);
    });
  });

  describe("handleGetVideoCover", () => {
    it("rejects an invalid bookVideoId immediately with 404 without making an outbound fetch", async () => {
      const mock = fetchMock();
      const res = await handleGetVideoCover(INVALID_BOOK_VIDEO_ID);

      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(mock).not.toHaveBeenCalled();
    });

    it("proxies a successful 200 response with correct headers and streamable body", async () => {
      const mock = fetchMock();
      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
      const bodyStream = new ReadableStream({
        start(controller) {
          controller.enqueue(imageBytes);
          controller.close();
        },
      });

      mock.mockResolvedValueOnce(
        new Response(bodyStream, {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-length": "4",
            "cache-control": VIDEO_COVER_CACHE_CONTROL,
          },
        }),
      );

      const res = await handleGetVideoCover(VALID_BOOK_VIDEO_ID);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("Cache-Control")).toBe(VIDEO_COVER_CACHE_CONTROL);
      expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
      expect(res.headers.get("Content-Length")).toBe("4");

      const readBuffer = await res.arrayBuffer();
      expect(new Uint8Array(readBuffer)).toEqual(imageBytes);

      expect(mock).toHaveBeenCalledWith(
        `http://api.test:3001/api/video-cover/${VALID_BOOK_VIDEO_ID}`,
        expect.objectContaining({
          method: "GET",
          redirect: "error",
          cache: "no-store",
        }),
      );
    });

    it("returns uniform 404 when upstream returns 404", async () => {
      const mock = fetchMock();
      mock.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const res = await handleGetVideoCover(VALID_BOOK_VIDEO_ID);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns uniform 404 when upstream returns 500 (does not leak 500)", async () => {
      const mock = fetchMock();
      mock.mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

      const res = await handleGetVideoCover(VALID_BOOK_VIDEO_ID);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns uniform 404 when upstream request throws a network error", async () => {
      const mock = fetchMock();
      mock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const res = await handleGetVideoCover(VALID_BOOK_VIDEO_ID);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns uniform 404 when upstream request aborts / times out", async () => {
      const mock = fetchMock();
      mock.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

      const res = await handleGetVideoCover(VALID_BOOK_VIDEO_ID);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });
});
