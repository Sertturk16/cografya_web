import { promises as dns } from "node:dns";

/**
 * `tools/dev-fixtures/render-auth-guards.ts` — the pure, testable boundary logic that
 * `render-authenticated-page.ts`'s safety claims rest on: the loopback-target guard, the
 * per-navigation same-origin check, the register-path guard, secret redaction (both the flat
 * string form and the recursive JSON-value form), and the
 * evidence-filename allocator. Nothing here touches Playwright or the filesystem, and nothing
 * here calls `main()` at module load — that split is what makes this module safely importable
 * from a test file (PR #131 fix round plan §5.0).
 */

// -------------------------------------------------------------------------------------------
// RenderAuthError — the tool's own refusal type. A RenderAuthError message never embeds another
// error's raw text (the standing rule behind the redaction sink table's O2 entry — a fill/click
// error's message can carry a credential; this tool's own refusal messages never do).
// -------------------------------------------------------------------------------------------

export class RenderAuthError extends Error {}

// -------------------------------------------------------------------------------------------
// Secret registration and redaction — a literal-substring replacement. `registerSecret` must be
// called the moment a credential validates, before any code that could throw with it in scope;
// `redactSecrets` is then applied to every text artefact and every stdout/stderr write this
// tool produces, BEFORE serialisation, never after — a serialised string can escape the literal
// substring (`JSON.stringify` turns `"`/`\` into `\"`/`\\`), so redacting the output instead of
// the input would miss it.
// -------------------------------------------------------------------------------------------

const registeredSecrets = new Set<string>();
const REDACTED_PLACEHOLDER = "[REDACTED:RENDER_AUTH_PASSWORD]";

/** Registers a value for redaction. A no-op for an empty string (nothing to hide, nothing to
 *  accidentally match everything against). */
export function registerSecret(value: string): void {
  if (value.length > 0) {
    registeredSecrets.add(value);
  }
}

/** Replaces every literal occurrence of every registered secret with a fixed placeholder.
 *  Unconditional — there is no minimum-length exception, so a pathologically short registered
 *  value produces noisy evidence rather than a silent gap. That is a deliberate trade. */
export function redactSecrets(text: string): string {
  let result = text;
  for (const secret of registeredSecrets) {
    result = result.split(secret).join(REDACTED_PLACEHOLDER);
  }
  return result;
}

/** Redacts every string leaf of a JSON-safe value, recursively — applied to VALUES before
 *  `JSON.stringify`, never to the serialised string. Lives here rather than beside its caller
 *  because it is pure: no Playwright, no filesystem, and therefore directly testable. */
export function redactJsonValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactSecrets(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactJsonValue(entry)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = redactJsonValue(entry);
    }
    return redacted as T;
  }
  return value;
}

// -------------------------------------------------------------------------------------------
// Loopback target guard for RENDER_AUTH_BASE_URL — scheme, then host literal, then DNS, in that
// exact order. The order is load-bearing: an origin/host comparison is meaningless on an opaque
// scheme (`file:` yields an origin of the literal string "null" for every such URL — measured),
// so the scheme check MUST run before the host is even looked at.
// -------------------------------------------------------------------------------------------

export const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const ALLOWED_LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/** Lowercases and strips IPv6 bracket notation. Idempotent — safe to apply more than once, so a
 *  caller that already has a normalized hostname may pass it straight through unchanged. */
export function normalizeHostname(rawHostname: string): string {
  let hostname = rawHostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  return hostname;
}

/** True only for the three conventional loopback spellings, bracket-tolerant (normalizes
 *  internally, so it is safe to call with either a raw or an already-normalized hostname). */
export function isLoopbackHostname(rawHostname: string): boolean {
  return ALLOWED_LOOPBACK_HOSTNAMES.has(normalizeHostname(rawHostname));
}

const OCTET = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])";
const LOOPBACK_V4_PATTERN = new RegExp(`^127\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);

/** True only for a resolved address inside `127.0.0.0/8` or `::1`. */
export function isLoopbackAddress(address: string): boolean {
  if (address === "::1") return true;
  const ipv4 = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  return LOOPBACK_V4_PATTERN.test(ipv4);
}

export type DnsLookupFn = (
  hostname: string,
) => Promise<ReadonlyArray<{ address: string; family: number }>>;

const defaultLookup: DnsLookupFn = (hostname) => dns.lookup(hostname, { all: true });

/**
 * Refuses (throws {@link RenderAuthError}) unless ALL of: the scheme is `http:`/`https:`; the
 * hostname literal is a conventional loopback spelling; and that hostname's ACTUAL DNS
 * resolution is loopback too. No navigation happens before this resolves. Returns the parsed
 * base URL — every later comparison in this tool is against THIS object.
 */
export async function assertLoopbackTarget(
  rawUrl: string,
  lookup: DnsLookupFn = defaultLookup,
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RenderAuthError(
      `RENDER_AUTH_BASE_URL "${rawUrl}" is not a valid URL — refusing to run.`,
    );
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new RenderAuthError(
      `RENDER_AUTH_BASE_URL "${rawUrl}" uses scheme "${parsed.protocol}" — only http: and ` +
        `https: are allowed. Refusing to run against a non-HTTP target.`,
    );
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!isLoopbackHostname(hostname)) {
    throw new RenderAuthError(
      `RENDER_AUTH_BASE_URL host "${hostname}" is not a conventional loopback spelling ` +
        `(localhost / 127.0.0.1 / ::1). Refusing to run against a non-local target.`,
    );
  }

  let resolved: ReadonlyArray<{ address: string; family: number }>;
  try {
    resolved = await lookup(hostname);
  } catch (error) {
    throw new RenderAuthError(
      `RENDER_AUTH_BASE_URL host "${hostname}" could not be resolved: ` +
        `${error instanceof Error ? error.message : String(error)}. Refusing to run.`,
    );
  }

  if (resolved.length === 0 || !resolved.every((entry) => isLoopbackAddress(entry.address))) {
    const addresses = resolved.map((entry) => entry.address).join(", ") || "(no address)";
    throw new RenderAuthError(
      `RENDER_AUTH_BASE_URL host "${hostname}" resolves to a non-loopback address (${addresses}). ` +
        `The hostname literal alone is never trusted — refusing to run.`,
    );
  }

  return parsed;
}

// -------------------------------------------------------------------------------------------
// Per-navigation origin check — a semantic origin-key comparison, never the URL object's own
// built-in origin getter: that getter returns the literal string "null" for EVERY opaque-scheme
// URL, so two entirely unrelated `file:` URLs compare equal under it. The scheme is already
// pinned to http:/https: by `assertLoopbackTarget` above, but the LANDED URL (after a redirect)
// is not under this tool's control, so the comparison itself must stay non-degenerate rather
// than resting on that upstream guarantee.
// -------------------------------------------------------------------------------------------

const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

export function originKey(url: URL): string {
  return `${url.protocol}//${url.hostname}:${url.port || DEFAULT_PORTS[url.protocol] || ""}`;
}

/**
 * Throws {@link RenderAuthError} if `url`'s origin key differs from `verifiedBase`'s. The
 * message names `context` (the operator-supplied input this check is protecting) and the
 * offending origin key — never the full href, which after a foreign redirect could carry a
 * token in its query string.
 */
export function assertSameOrigin(url: URL, verifiedBase: URL, context: string): void {
  const actual = originKey(url);
  const expected = originKey(verifiedBase);
  if (actual !== expected) {
    throw new RenderAuthError(
      `Refusing ${context} — it resolves to origin "${actual}", which does not match the ` +
        `verified target origin "${expected}". Refusing to navigate off the verified target.`,
    );
  }
}

// -------------------------------------------------------------------------------------------
// Register-path guard — a semantic terminator class, not a spelling blocklist. Matches
// "kayit"/"register" as a whole path SEGMENT (bounded by "/", the string edges, or a
// query/fragment separator), so "/kayit", "/kayit/", "/en/register", "/v2/kayit", "/kayit?x=1"
// and "/kayit#a" all match, while "/kayitli-varliklar", "/registered" and "/giris" do not.
// Known, non-blocking limit: a percent-encoded spelling such as "/%6Bayit" evades this — left
// open deliberately, at MINOR weight, on a measured accident (not attacker) surface.
// -------------------------------------------------------------------------------------------

/** Prohibition (binding): this tool must never navigate to or interact with a register path. */
export const REGISTER_PATH_PATTERN = /(^|\/)(kayit|register)($|[\/?#])/i;

export function assertNoRegisterPath(targetPath: string): void {
  if (REGISTER_PATH_PATTERN.test(targetPath)) {
    throw new RenderAuthError(
      `Refusing to navigate to "${targetPath}" — this tool must never touch a register path ` +
        `(the reviewer read-only boundary's real mutation risk). This is not a configuration ` +
        `mistake to work around; pass a different --paths value.`,
    );
  }
}

// -------------------------------------------------------------------------------------------
// Evidence filenames — collision-aware, so two different --paths entries (or a --paths entry
// and one of the run's own reserved names) can never overwrite each other's evidence file
// silently.
// -------------------------------------------------------------------------------------------

export function sanitizePathForFilename(targetPath: string): string {
  const trimmed = targetPath.replace(/^\/+/, "").replace(/\/+$/, "");
  if (trimmed.length === 0) return "root";
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/**
 * Returns a base filename for `targetPath` that is guaranteed distinct from every other name
 * this function has already handed out against the SAME `counts` map (including the run's own
 * reserved names, if the caller pre-seeds them — e.g. `new Map([["__login-step", 1], ["__run",
 * 1]])`). The first allocation for a given sanitized name gets that name unchanged; every later
 * one — including a later `--paths` entry that happens to sanitize to the same string, or to a
 * pre-seeded reserved name — gets a deterministic numeric suffix.
 */
export function allocateBaseName(counts: Map<string, number>, targetPath: string): string {
  const sanitized = sanitizePathForFilename(targetPath);
  const seen = counts.get(sanitized) ?? 0;
  counts.set(sanitized, seen + 1);
  return seen === 0 ? sanitized : `${sanitized}-${seen + 1}`;
}
