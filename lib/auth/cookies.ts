/**
 * Cookie policy for the two session cookies (`cg_access` / `cg_refresh` — plan §8,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-03-plan.md`).
 *
 * PURE by construction, per the manifest note on this file: no Next import, no
 * `process.env` read, no `fetch`. Every input the attribute policy needs — the site URL,
 * the two token TTLs — is a parameter, so this module is testable with nothing more than
 * plain strings and numbers, and `transport.server.ts` owns the one env read (`getSiteUrl()`)
 * this policy depends on.
 */

/** The two cookie names — fixed by plan §8; nowhere else in this package invents one. */
export const ACCESS_COOKIE_NAME = "cg_access";
export const REFRESH_COOKIE_NAME = "cg_refresh";

/** The attribute set every `Set-Cookie` in this app carries (plan §8's table, row by row). */
export interface CookieAttributes {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
}

/** A `{ name, value, options }` descriptor — plain data, applied via
 *  `response.cookies.set(name, value, options)` on a `NextResponse` (plan §8's "Setting"
 *  paragraph: never `cookies().set()`, so this stays assertable with no request context). */
export interface CookieDescriptor {
  readonly name: string;
  readonly value: string;
  readonly options: CookieAttributes;
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * `Secure` derivation (plan §8, "written inverted on purpose"): Secure by default, opt out
 * ONLY for a loopback host — `NODE_ENV === "production"` or "Secure iff https" both fail in
 * the wrong direction, because an operator who forgets to set the site URL would silently
 * ship a non-Secure cookie in production. Inverted, the same mistake breaks http dev loudly
 * instead and never downgrades production. Only the HOSTNAME decides this — the protocol is
 * not consulted, so a non-loopback `http://` host is still `Secure`. Gate: `cookies.test.ts`
 * T-C2.
 */
export function deriveSecureCookieAttribute(siteUrl: string): boolean {
  const { hostname } = new URL(siteUrl);
  return !LOOPBACK_HOSTNAMES.has(hostname);
}

/**
 * TTL → `Max-Age` guard (plan §8's Max-Age row): a `0`, negative or non-finite
 * (`NaN`/`Infinity`) TTL from a broken contract becomes a one-second cookie instead of an
 * already-expired or unbounded one; a fractional TTL is floored. Gate: `cookies.test.ts`
 * T-C4.
 */
export function normalizeMaxAge(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds)) return 1;
  return Math.max(1, Math.floor(ttlSeconds));
}

/** The ONE attribute builder both `sessionCookieMutations` and `clearSessionCookies` call —
 *  the mechanism, not a convention, behind T-C3 ("clear equals set except maxAge/value"). */
function buildAttributes(secure: boolean, maxAge: number): CookieAttributes {
  return { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge };
}

/** The two token TTLs off `AuthResultDto`, as primitives rather than the generated
 *  `AuthResult` type — this module never imports the contract, which is what keeps it
 *  pure per the manifest note. `transport.server.ts` is the only caller and passes the
 *  parsed, guard-validated fields through unchanged. */
export interface SessionTokenAttributes {
  readonly accessToken: string;
  readonly accessTokenExpiresInSeconds: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresInSeconds: number;
}

/**
 * The `set` half of plan §8: both cookies from one `AuthResultDto`-shaped input, built by
 * the SAME `buildAttributes` as `clearSessionCookies` below, so the two descriptor sets can
 * only ever disagree in `maxAge`/`value` — not in any other attribute. This is also the
 * function named in plan §7 P1's mechanism: it is the ONLY consumer of the token strings
 * `transport.server.ts`'s `callAuthApi()` returns, and it returns nothing but two cookie
 * descriptors. Gate: `cookies.test.ts` T-C1.
 */
export function sessionCookieMutations(
  tokens: SessionTokenAttributes,
  siteUrl: string,
): readonly [CookieDescriptor, CookieDescriptor] {
  const secure = deriveSecureCookieAttribute(siteUrl);
  return [
    {
      name: ACCESS_COOKIE_NAME,
      value: tokens.accessToken,
      options: buildAttributes(secure, normalizeMaxAge(tokens.accessTokenExpiresInSeconds)),
    },
    {
      name: REFRESH_COOKIE_NAME,
      value: tokens.refreshToken,
      options: buildAttributes(secure, normalizeMaxAge(tokens.refreshTokenExpiresInSeconds)),
    },
  ];
}

/**
 * The `clear` half. Deliberately NOT `response.cookies.delete()` (plan §8): a delete must
 * match name + path + domain exactly, and a hand-written delete is a second copy of the
 * attribute policy that can drift from `sessionCookieMutations` above — the exact failure
 * that leaves an undeletable cookie behind. Gate: `cookies.test.ts` T-C3.
 */
export function clearSessionCookies(
  siteUrl: string,
): readonly [CookieDescriptor, CookieDescriptor] {
  const secure = deriveSecureCookieAttribute(siteUrl);
  return [
    { name: ACCESS_COOKIE_NAME, value: "", options: buildAttributes(secure, 0) },
    { name: REFRESH_COOKIE_NAME, value: "", options: buildAttributes(secure, 0) },
  ];
}

/** Clears `cg_access` only — the `session` 401 branch (plan §8: "it is provably useless,
 *  while `cg_refresh` may still be good"). Same attribute builder as the other two, so it
 *  cannot drift from them either. */
export function clearAccessCookie(siteUrl: string): CookieDescriptor {
  const secure = deriveSecureCookieAttribute(siteUrl);
  return { name: ACCESS_COOKIE_NAME, value: "", options: buildAttributes(secure, 0) };
}
