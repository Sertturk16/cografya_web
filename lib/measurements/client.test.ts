import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMeasurements, removeMeasurement, saveMeasurement } from "./client";

const MEASUREMENT = {
  id: "018f2f3a-9c3e-7b2a-8b9d-2e6f1a7c9d40",
  type: "distance" as const,
  points: [
    { lon: 32.85, lat: 39.92 },
    { lon: 29.0, lat: 41.0 },
  ],
  title: "İstanbul - Ankara mesafesi",
  clientMeasurementId: "018f2f3a-0000-0000-0000-000000000000",
  createdAt: "2026-08-28T10:00:00.000Z",
  updatedAt: "2026-08-28T10:00:00.000Z",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchMeasurements", () => {
  it("a well-formed 200 resolves the measurement list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true, measurements: [MEASUREMENT] }))),
    );
    await expect(fetchMeasurements(new AbortController().signal)).resolves.toEqual([MEASUREMENT]);
  });

  it("an empty list resolves an empty array, not null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true, measurements: [] }))),
    );
    await expect(fetchMeasurements(new AbortController().signal)).resolves.toEqual([]);
  });

  it("a 401 (anonymous/session gone) resolves null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(fetchMeasurements(new AbortController().signal)).resolves.toBeNull();
  });

  it("a network failure resolves null, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(fetchMeasurements(new AbortController().signal)).resolves.toBeNull();
  });

  it("a malformed 200 body (unchecked network input) resolves null rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(fetchMeasurements(new AbortController().signal)).resolves.toBeNull();
  });

  it("a malformed item inside an otherwise well-formed list resolves null for the whole list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            measurements: [{ id: "x" /* missing every other field */ }],
          }),
        ),
      ),
    );
    await expect(fetchMeasurements(new AbortController().signal)).resolves.toBeNull();
  });

  it("sends the same-origin/no-store contract", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { ok: true, measurements: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchMeasurements(new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/measurements",
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
    );
  });
});

describe("saveMeasurement", () => {
  const payload = {
    type: "distance" as const,
    points: MEASUREMENT.points,
    title: MEASUREMENT.title,
    clientMeasurementId: MEASUREMENT.clientMeasurementId,
  };

  it("POSTs the payload and resolves the saved measurement on a 200", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, measurement: MEASUREMENT })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(saveMeasurement(payload)).resolves.toEqual({
      ok: true,
      measurement: MEASUREMENT,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/measurements",
      expect.objectContaining({ method: "POST", credentials: "same-origin", cache: "no-store" }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("maps a 403 to the quota-exceeded code, distinct from a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 403 }))),
    );
    await expect(saveMeasurement(payload)).resolves.toEqual({
      ok: false,
      code: "quota-exceeded",
    });
  });

  it("maps any other non-200 to a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 400 }))),
    );
    await expect(saveMeasurement(payload)).resolves.toEqual({ ok: false, code: "failed" });
  });

  it("maps a network failure to a generic failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(saveMeasurement(payload)).resolves.toEqual({ ok: false, code: "failed" });
  });

  it("maps a malformed 200 body to a generic failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(saveMeasurement(payload)).resolves.toEqual({ ok: false, code: "failed" });
  });

  it("carries its own AbortController", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, measurement: MEASUREMENT })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveMeasurement(payload);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("carries no keepalive — a discrete click, not a teardown/tab-hide save", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, measurement: MEASUREMENT })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveMeasurement(payload);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBeUndefined();
  });

  it("omits title entirely when not provided — never sends null on create", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, measurement: MEASUREMENT })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveMeasurement({
      type: "distance",
      points: MEASUREMENT.points,
      clientMeasurementId: MEASUREMENT.clientMeasurementId,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect("title" in sent).toBe(false);
  });
});

describe("removeMeasurement", () => {
  it("DELETEs and resolves ok:true on a 204", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(removeMeasurement(MEASUREMENT.id)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/measurements/${MEASUREMENT.id}`,
      expect.objectContaining({ method: "DELETE", credentials: "same-origin", cache: "no-store" }),
    );
  });

  it("resolves ok:false on any non-204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(removeMeasurement(MEASUREMENT.id)).resolves.toEqual({ ok: false });
  });

  it("resolves ok:false on a network failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(removeMeasurement(MEASUREMENT.id)).resolves.toEqual({ ok: false });
  });

  it("carries its own AbortController", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await removeMeasurement(MEASUREMENT.id);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
