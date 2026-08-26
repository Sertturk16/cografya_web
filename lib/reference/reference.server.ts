import "server-only";
import { apiGet } from "@/lib/api/client";
import { isProductionBuild } from "@/lib/api/provinces";
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
 * No build-time resilience wrapper, unlike {@link getUniversitiesResilient} /
 * {@link getDepartmentsResilient} below: the route handler's own `generateStaticParams`
 * already degrades to an EMPTY params list when the api is unreachable at build
 * (`getProvincesResilient`), so with zero listed plate codes this function's body never runs
 * during a no-api CI build at all (plan §4.4's "Build resilience" paragraph). Every actual
 * invocation is therefore a genuine runtime call, where a real api is assumed reachable —
 * the same posture every other runtime-only read in this repo already has.
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
 * order). Unlike {@link getDistricts}, this route has no dynamic segment and no
 * `generateStaticParams` guard of its own, so its GET handler body DOES run during
 * `next build` (the same reasoning `app/api/search-index/[locale]/route.ts` already
 * documents for its own two resilient reads) — CI has no api service, so this degrades to
 * `[]` at build and re-throws at runtime, the identical split `getMapSummaryResilient`
 * establishes in `lib/api/provinces.ts`.
 */
export async function getUniversitiesResilient(): Promise<University[]> {
  try {
    return await apiGet<University[]>("/api/reference/universities");
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[reference] universities fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/** Every bachelor-level programme name the registration form offers, Turkish-alphabetical —
 *  the same build-vs-runtime split as {@link getUniversitiesResilient}, for the same reason. */
export async function getDepartmentsResilient(): Promise<Department[]> {
  try {
    return await apiGet<Department[]>("/api/reference/departments");
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[reference] departments fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}
