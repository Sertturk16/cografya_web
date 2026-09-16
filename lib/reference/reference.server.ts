import "server-only";
import { apiGet } from "@/lib/api/client";
import type { Department, District, University } from "@/lib/api/types";
import { PLATE_CODE_PATTERN } from "@/lib/auth/form-rules";

/**
 * The three public reference-data reads the registration form needs (plan §4.4,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`) — one shared,
 * unit-testable module the three `app/api/reference/**` route handlers call, on the same
 * `transport.server.ts` / `route.ts` separation this repo already uses (the logic lives
 * where vitest can reach it without a Next request context, `app/api/search-index/[locale]/
 * route.ts`'s own precedent).
 */

/**
 * Rejects anything that is not EXACTLY two zero-padded digits — the plate-code guard (plan
 * §4.4 decision 3, gate G7's revert-to-red target). Reuses the SAME contract-derived pattern
 * `lib/auth/form-rules.ts` already gates against `RegisterRequestDto.provincePlateCode`
 * (gate G2) rather than a second copy: the registration form's `provincePlateCode` field and
 * this reference read address the identical shape.
 */
export function isValidPlateCode(value: string): boolean {
  return PLATE_CODE_PATTERN.test(value);
}

/**
 * One province's districts, Turkish-alphabetical (the api's own order). A malformed code is
 * refused HERE, before any `fetch` — never reaches the api at all (gate G7's revert-to-red
 * control targets exactly this guard, with the fetch stub asserting zero calls). A
 * well-formed but UNMATCHED code still reaches the api and answers `[]` with a 200 — the
 * api's own contract for that case (plan §3.4) — never a throw.
 *
 * No build-time resilience wrapper, matching {@link getUniversities} / {@link getDepartments}
 * below: none of the three has one any more. Every actual invocation is a genuine runtime
 * call, where a real api is assumed reachable — the same posture every other runtime-only
 * read in this repo already has.
 */
export async function getDistricts(plateCode: string): Promise<District[]> {
  if (!isValidPlateCode(plateCode)) {
    throw new Error(
      `getDistricts: malformed plateCode "${plateCode}" must be rejected before the api layer`,
    );
  }
  return apiGet<District[]>(`/api/reference/districts?plateCode=${encodeURIComponent(plateCode)}`);
}

/**
 * Every university the registration form offers, Turkish-alphabetical (the api's own
 * order). Both `app/api/reference/universities/route.ts` and its `departments` sibling are
 * `export const dynamic = "force-dynamic"` routes, so this body only ever runs at request
 * time, when a real api is reachable — no build-time fallback needed (previously this had a
 * try/catch that degraded to `[]` during `next build`, matching `getMapSummaryResilient` in
 * `lib/api/provinces.ts`; that branch was dropped because the production Docker build has no
 * network access to the api, so it was silently baking an empty `[]` into the static output,
 * which then served for up to an hour post-deploy before ISR self-healed — see T-020). Throws
 * on failure, same posture as {@link getDistricts}.
 */
export async function getUniversities(): Promise<University[]> {
  return apiGet<University[]>("/api/reference/universities");
}

/** Every bachelor-level programme name the registration form offers, Turkish-alphabetical —
 *  same reasoning and posture as {@link getUniversities}. */
export async function getDepartments(): Promise<Department[]> {
  return apiGet<Department[]>("/api/reference/departments");
}
