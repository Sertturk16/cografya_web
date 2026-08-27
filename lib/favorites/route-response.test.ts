import { afterEach, describe, expect, it, vi } from "vitest";
import type { FavoriteBffResult } from "./transport.server";

/**
 * ROUTE-LEVEL regression test for the exact defect PR #91 round 2 fixed (`IRIS91-C1`): both
 * favorites `DELETE` route handlers construct a `NextResponse` from `handleDeleteFavorite`'s
 * result — `transport.server.test.ts`'s own T9 already covers the LIB function's return
 * value in isolation, but nothing exercised what `route.ts` itself does with that value, and
 * that gap is exactly where the bug lived. `NextResponse.json(body, { status: 204 })` THROWS
 * (`TypeError: Response constructor: Invalid response status code 204` — the Fetch spec
 * forbids a non-null body on a null-body status) even for a small object body, which is why
 * every real remove-favorite click failed with a 500 while the row was genuinely deleted
 * server-side (İRİS's live-audit finding A1,
 * `Owner's Inbox/design-tour/2026-08-27-uyelik-08-favorite-control/report.md`).
 *
 * Lives under `lib/favorites/` rather than beside the `route.ts` files it imports because
 * `vitest.config.ts`'s `test.include` only globs `lib/**` and `components/**` — a deliberate
 * placement, not a naming mistake; the import path below reaches into `app/api/...` directly.
 *
 * `handlePutFavorite`/`handleDeleteFavorite` are mocked so this is a pure check of `route.ts`'s
 * own ~10-line response-construction shape, never a second copy of T9's own branch coverage.
 */

vi.mock("@/lib/favorites/transport.server", () => ({
  handlePutFavorite: vi.fn(),
  handleDeleteFavorite: vi.fn(),
}));

function noBodyResult(status: number): FavoriteBffResult {
  return { status, body: { ok: true }, headers: { "Cache-Control": "no-store" } };
}

function errorResult(status: number): FavoriteBffResult {
  return {
    status,
    body: { ok: false, code: "errors.transport.forbidden" },
    headers: { "Cache-Control": "no-store" },
  };
}

describe("province favorites route — DELETE (`IRIS91-C1` regression)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("a 204 from handleDeleteFavorite constructs a real 204 Response with NO body, never throws", async () => {
    const { handleDeleteFavorite } = await import("@/lib/favorites/transport.server");
    vi.mocked(handleDeleteFavorite).mockResolvedValue(noBodyResult(204));
    const { DELETE } = await import("@/app/api/favorites/provinces/[plateCode]/route");

    const response = await DELETE(
      new Request("http://localhost:3000/api/favorites/provinces/34", { method: "DELETE" }),
      { params: Promise.resolve({ plateCode: "34" }) },
    );

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a non-204 status (e.g. 403) still returns the JSON body unchanged — the fix is scoped to 204 only", async () => {
    const { handleDeleteFavorite } = await import("@/lib/favorites/transport.server");
    vi.mocked(handleDeleteFavorite).mockResolvedValue(errorResult(403));
    const { DELETE } = await import("@/app/api/favorites/provinces/[plateCode]/route");

    const response = await DELETE(
      new Request("http://localhost:3000/api/favorites/provinces/34", { method: "DELETE" }),
      { params: Promise.resolve({ plateCode: "34" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "errors.transport.forbidden",
    });
  });
});

describe("country favorites route — DELETE (`IRIS91-C1` regression)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("a 204 from handleDeleteFavorite constructs a real 204 Response with NO body, never throws", async () => {
    const { handleDeleteFavorite } = await import("@/lib/favorites/transport.server");
    vi.mocked(handleDeleteFavorite).mockResolvedValue(noBodyResult(204));
    const { DELETE } = await import("@/app/api/favorites/countries/[isoCode]/route");

    const response = await DELETE(
      new Request("http://localhost:3000/api/favorites/countries/TR", { method: "DELETE" }),
      { params: Promise.resolve({ isoCode: "TR" }) },
    );

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a non-204 status (e.g. 403) still returns the JSON body unchanged — the fix is scoped to 204 only", async () => {
    const { handleDeleteFavorite } = await import("@/lib/favorites/transport.server");
    vi.mocked(handleDeleteFavorite).mockResolvedValue(errorResult(403));
    const { DELETE } = await import("@/app/api/favorites/countries/[isoCode]/route");

    const response = await DELETE(
      new Request("http://localhost:3000/api/favorites/countries/TR", { method: "DELETE" }),
      { params: Promise.resolve({ isoCode: "TR" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "errors.transport.forbidden",
    });
  });
});
