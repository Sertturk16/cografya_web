import "server-only";
import { cookies } from "next/headers";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { serverEnv } from "@/lib/env.server";
import { drainBody } from "@/lib/http/bff-helpers.server";
import type { Profile } from "@/lib/api/types";
import { profileSchema } from "./transport.server";

export type ProfileReadResult =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ok"; readonly profile: Profile };

const PROFILE_READ_TIMEOUT_MS = 15_000;

export async function readProfileForPage(): Promise<ProfileReadResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { kind: "unauthenticated" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROFILE_READ_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${serverEnv.API_BASE_URL}/api/auth/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    await drainBody(res);
    return { kind: "unauthenticated" };
  }

  if (res.status !== 200) {
    await drainBody(res);
    return { kind: "unavailable" };
  }

  try {
    const json: unknown = await res.json();
    const parsed = profileSchema.safeParse(json);
    if (!parsed.success) {
      return { kind: "unavailable" };
    }
    return { kind: "ok", profile: parsed.data };
  } catch {
    return { kind: "unavailable" };
  }
}
