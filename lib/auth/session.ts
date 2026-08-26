import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import type { Session } from "@/lib/api/types";
import { ACCESS_COOKIE_NAME } from "./cookies";

/**
 * Wall-clock budget for this module's single api call. Mirrors `lib/api/client.ts`'s
 * `API_REQUEST_TIMEOUT_MS` and `transport.server.ts`'s `AUTH_REQUEST_TIMEOUT_MS` (both 15s)
 * without importing either — this module deliberately imports NOTHING from
 * `transport.server.ts` (see the property docblock on `getSession` below), so the number is
 * repeated here rather than shared.
 */
const SESSION_REQUEST_TIMEOUT_MS = 15_000;

const sessionSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  accountRole: z.enum(["STUDENT", "TEACHER"]),
});

type SessionShape = z.infer<typeof sessionSchema>;
// Drift gate: the runtime guard and the generated contract must stay identical. A contract
// change this schema misses is a TYPE ERROR in the `Typecheck & Lint` job, not a runtime
// surprise. Do not relax either direction.
const _sessionShapeAgreesWithContract: [SessionShape, Session] = [
  null as unknown as Session,
  null as unknown as SessionShape,
];
void _sessionShapeAgreesWithContract;

/**
 * `getSession()` — what server code calls to read the current user (plan §6 manifest item
 * 7, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-03-plan.md`). Memoized per request
 * with React `cache()`, so one render never issues the read twice.
 *
 * PROPERTY P3 (plan §7) — canonical statement, mechanism and residual: this module does NOT
 * restate it; see `lib/auth/transport.server.ts`'s module docblock (P3), the single place it
 * is defined. A second narrow copy is deliberately not written here — a second copy already
 * drifted from the canonical one once (`CODE84R2-I1`: this paragraph carried the broad,
 * since-withdrawn "a rotated refresh token is never lost" while the canonical copy had
 * already been narrowed), and only a pointer closes that class rather than reopening it.
 *
 * This module's OWN contribution to the property: it is READ-ONLY BY CONSTRUCTION — there
 * is no function anywhere in this file that rotates a session. It is not "we remember not
 * to" — the capability does not exist here, because this file imports neither the
 * token-issuing endpoint nor the cookie that would carry a rotated refresh token. A Server
 * Component cannot write a `Set-Cookie` header, so a "helpful" auto-rotate called from here
 * would obtain a token it has nowhere to persist; the browser's next use of the now-stale
 * refresh cookie then looks like a REUSE to the api, which revokes the whole session family
 * (`AuthResultDto`). Gate: `transport.server.test.ts` T7
 * asserts this file's own source contains neither the rotation endpoint's path nor the
 * refresh cookie's name — the same source-assertion technique `lib/env.server.test.ts`
 * already uses to keep a marker import from hiding a removed guard.
 *
 * PROHIBITION (plan §15 R4) — do not call this from a page/layout component that must stay
 * statically rendered: `cookies()` opts its caller out of static rendering the moment it is
 * read, which is an SSG/ISR loss on an indexable route. Keep the page static and put the
 * auth-dependent part behind a client island that calls `GET /api/auth/session` instead.
 * Nothing in UYELIK-03 calls `getSession()` from a page.
 *
 * `null` DOES NOT DISTINGUISH "no session" from "the session could not be read" (`CODE84-M6`):
 * a missing/invalid access cookie, a network failure, a timeout, an api 4xx/5xx and a 200
 * whose body fails the schema all collapse to the same `null`. A caller must not read `null`
 * as an authoritative "the user is logged out" signal.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!accessToken) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SESSION_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${serverEnv.API_BASE_URL}/api/auth/session`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      // Drain the body before returning (`CODE84-M2`, the third of the round's three
      // unconsumed-body sites): this function never reads a failed response's body, but
      // undici still needs it consumed to return the connection to its pool. NO GATE in
      // this round: this file has no test file today and this round adds none (plan §14
      // prohibits a new file) — recorded rather than silently claimed as covered.
      await res.body?.cancel();
      return null;
    }

    const parsed = sessionSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
});
