import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { handleGetLeaderboard } from "./transport.server";
import { fetchLeaderboard, formatLeaderboardDisplayName } from "./client";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

const SITE_URL = "http://localhost:3000";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeRequest(cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${SITE_URL}/api/game-rounds/leaderboard`, { method: "GET", headers });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("handleGetLeaderboard (Server Transport)", () => {
  it("rejects request without cookie with 401 unauthenticated", async () => {
    const mock = fetchMock();
    const result = await handleGetLeaderboard(makeRequest(), { mode: "provinces" });
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("rejects invalid mode parameter with 400 invalidRequest", async () => {
    const mock = fetchMock();
    const result = await handleGetLeaderboard(makeRequest(`${ACCESS_COOKIE_NAME}=valid-token`), {
      mode: "INVALID_MODE!",
    });
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("sends request with correct query params and Authorization header", async () => {
    const mock = fetchMock();
    const samplePayload = {
      items: [
        {
          rank: 1,
          firstName: "Ahmet",
          lastNameInitial: "Y",
          score: 95,
          found: 80,
          firstTry: 75,
          totalWrongs: 5,
          completionTimeSeconds: 120,
          achievedAt: "2026-09-08T19:22:11.000Z",
          isCurrentUser: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
      meta: {
        mode: "provinces",
        currentUserRank: 1,
      },
    };
    mock.mockResolvedValue(jsonResponse(200, samplePayload));

    const result = await handleGetLeaderboard(makeRequest(`${ACCESS_COOKIE_NAME}=valid-token`), {
      mode: "provinces",
      page: "1",
      pageSize: "20",
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, ...samplePayload });
    expect(mock).toHaveBeenCalledWith(
      "http://api.test/api/game-rounds/leaderboard?mode=provinces&page=1&pageSize=20",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer valid-token",
        }),
      }),
    );
  });

  it("rejects upstream payload with full surname (privacy defense §3.6)", async () => {
    const mock = fetchMock();
    const leakedPayload = {
      items: [
        {
          rank: 1,
          firstName: "Ahmet",
          lastNameInitial: "Yılmazoğlu", // Defect: full surname leaked
          score: 95,
          found: 80,
          firstTry: 75,
          totalWrongs: 5,
          achievedAt: "2026-09-08T19:22:11.000Z",
          isCurrentUser: false,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
      meta: { mode: "provinces", currentUserRank: null },
    };
    mock.mockResolvedValue(jsonResponse(200, leakedPayload));

    const result = await handleGetLeaderboard(makeRequest(`${ACCESS_COOKIE_NAME}=valid-token`), {
      mode: "provinces",
    });

    // Schema rejects full surname to protect user anonymity
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });
});

describe("Leaderboard Client Utilities", () => {
  it("formatLeaderboardDisplayName formats first name and initial without exposing surname", () => {
    expect(formatLeaderboardDisplayName("Ayşe", "K")).toBe("Ayşe K.");
    expect(formatLeaderboardDisplayName("Mehmet", "D.")).toBe("Mehmet D.");
  });

  it("fetchLeaderboard parses valid leaderboard response", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        items: [
          {
            rank: 1,
            firstName: "Zeynep",
            lastNameInitial: "T",
            score: 100,
            found: 81,
            firstTry: 81,
            totalWrongs: 0,
            completionTimeSeconds: 95,
            achievedAt: "2026-09-09T10:00:00.000Z",
            isCurrentUser: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
        meta: { mode: "provinces", currentUserRank: null },
      }),
    );

    const res = await fetchLeaderboard("provinces");
    expect(res).not.toBeNull();
    expect(res?.items).toHaveLength(1);
    expect(res?.items[0]?.firstName).toBe("Zeynep");
    expect(res?.items[0]?.lastNameInitial).toBe("T");
  });
});
