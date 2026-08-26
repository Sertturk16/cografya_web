/**
 * The redirect allowlist (plan §9,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-03-plan.md`) — a pure "parse, check
 * origin, rebuild" sanitizer for a post-login/verify return path. No Next import, no env
 * read: the module builds its own placeholder origin (RFC 2606 `.invalid`, which can never
 * resolve), so it never depends on the real site origin and its output is always a
 * same-origin RELATIVE path.
 */

export const RETURN_PATH_FALLBACK = "/";
export const RETURN_PATH_MAX_LENGTH = 512;

const PLACEHOLDER_ORIGIN = "https://cografya.invalid";

/**
 * Fails closed at every step; any step that does not hold returns `RETURN_PATH_FALLBACK`.
 * The caller's raw string is NEVER echoed — the return value is always rebuilt from a
 * `URL` whose origin was checked (`pathname + search`), which is the mechanism behind
 * every property below. Gate: `redirect.test.ts` T-R1 (accepted set), T-R2 (rejected
 * families), T-R3 (the measured bypass), T-R4 (fragment dropped / query kept), T-R5
 * (length/empty/nullish).
 */
export function safeReturnPath(raw: string | null | undefined): string {
  // Step 1 — shape.
  if (typeof raw !== "string" || raw.length === 0 || raw.length > RETURN_PATH_MAX_LENGTH) {
    return RETURN_PATH_FALLBACK;
  }

  // Step 2 — reject an absolute URL or a scheme before it is parsed at all.
  if (!raw.startsWith("/")) {
    return RETURN_PATH_FALLBACK;
  }

  // Step 3 — must resolve against the placeholder origin without throwing.
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return RETURN_PATH_FALLBACK;
  }

  // Step 4 — the resolved origin must still be the placeholder. Catches every
  // scheme-relative/absolute family (`//evil.com`, `https://evil.com`, …): the URL parser
  // resolves those against a DIFFERENT origin than the base, and this is what reads that.
  if (url.origin !== PLACEHOLDER_ORIGIN) {
    return RETURN_PATH_FALLBACK;
  }

  // Step 5 — the REBUILT value, not the raw string, must still be single-slash-rooted.
  // `/.//evil.com` and `/..//evil.com` both survive steps 1-4 with the placeholder origin
  // intact, and still rebuild to a protocol-relative `//evil.com` — a browser navigating
  // there goes to evil.com. This step is not defence in depth: it closes a measured bypass
  // (plan §9), and deleting it is T-R3's revert-to-red.
  const rebuilt = url.pathname + url.search;
  if (!rebuilt.startsWith("/") || rebuilt.startsWith("//")) {
    return RETURN_PATH_FALLBACK;
  }

  return rebuilt;
}
