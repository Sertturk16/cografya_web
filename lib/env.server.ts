import "server-only";
import { z } from "zod";

/**
 * Server-only environment validation (CONVENTIONS §3 — "no unvalidated
 * process.env reads"). Kept SEPARATE from `lib/env.ts` (the client/NEXT_PUBLIC_*
 * schema) because these vars are read only on the server: importing them into a
 * client bundle would fail (the values are never inlined there). The
 * `import "server-only"` guard turns any accidental client import into a build
 * error instead of a silent runtime break.
 */
const serverEnvSchema = z.object({
  // Origin of the api the SSG/ISR data layer fetches from (server-side only, so
  // NOT NEXT_PUBLIC_). Defaults to the local api dev port; MUST be set to the
  // real (internal) api origin in production. A build with no api reachable
  // degrades gracefully to on-demand ISR (see lib/api/provinces.ts).
  // ACCEPTED RISK (deliberate, no origin allowlist): INTERNAL_REQUEST_TOKEN below rides
  // EVERY request to this origin, so a misconfigured value discloses the shared secret to
  // whoever answers. Prefer `https://` unless the api is reached over a trusted network —
  // `z.url()` also accepts `http://`, which sends the token in plaintext.
  API_BASE_URL: z.url().default("http://localhost:3001"),
  // OPTIONAL shared secret that exempts our server-side api reads from the api's global
  // rate limit (cografya_api `TrustedClientThrottlerGuard`, PR #67) — presented in the
  // `x-internal-request-token` header by `lib/api/client.ts`. It is a SECRET: server-only
  // by construction (never `NEXT_PUBLIC_`, never read from a client module), never logged.
  // Fail-closed and backwards-compatible: unset → the header is not sent and every request
  // is throttled exactly as before. The `min(32)` mirrors the api's own schema so a
  // truncated/typo'd value aborts boot loudly instead of degrading into silent 429s during
  // `next build`; an EMPTY assignment is therefore invalid too — leave the line out
  // entirely when you don't want the exemption.
  //
  // The character class is a WIRE-CONTRACT constraint, not cosmetics: this value is sent
  // verbatim as an HTTP header value, and length alone does not make a string one. Visible
  // ASCII (0x21-0x7E) is exactly the set that (a) `Headers` accepts and (b) survives the
  // wire byte-identical, so every accepted value hashes on the api side to what we sent.
  // Measured on Node 24 — the two classes this excludes both fail in production:
  //   · whitespace: a wrapped `openssl rand -base64 64` (internal newline) makes `fetch`
  //     throw a TypeError, which the build-time resilient wrappers swallow → a GREEN build
  //     with zero prerendered pages and a gutted sitemap; a leading/trailing space or
  //     newline is silently TRIMMED by `Headers`, so a byte-identical secret in both stores
  //     still mismatches the api's untrimmed digest → permanent 429s with "exemption:
  //     active" in the api log (the one diagnostic that would exonerate the token).
  //     Note the asymmetry: an INTERIOR LF/CR is a hard error (next bullet), a leading or
  //     trailing one is trimmed. Same character, opposite failure — which is why the class
  //     is rejected wholesale rather than trimmed on our side.
  //   · control/non-ASCII: NUL, 0x7F, `ş`, an emoji — all non-whitespace, so a `\S` check
  //     lets them through, and they fail in THREE different ways. Measured on Node 24, so
  //     the leak is stated exactly rather than left at "several":
  //       – interior LF, CR, NUL → `TypeError: Headers.append: "<value>" is an invalid
  //         header value.` This is the ONLY class whose message quotes the secret VERBATIM,
  //         and it is the one that would land in retained build logs.
  //       – any code point above U+00FF (`ş`, an emoji) → also a TypeError, but the
  //         ByteString conversion message reports only an index and a code point, so it
  //         fails loudly WITHOUT leaking. Still rejected: it is a build-breaking value.
  //       – the remaining C0 controls and 0x7F (0x01, 0x1B, DEL) → silently ACCEPTED and
  //         sent, so they never throw at all and instead land in the silent-mismatch mode
  //         the whitespace bullet describes.
  //     One regex closes all three; splitting it into "leaks" and "does not leak" halves
  //     would only invite someone to relax the safe-looking half.
  // Rejecting them here is the single control that keeps the secret out of both failure
  // modes; `lib/env.server.test.ts` pins the schema↔`Headers` agreement so a future
  // loosening fails CI instead of re-opening them.
  INTERNAL_REQUEST_TOKEN: z
    .string()
    .min(32, "INTERNAL_REQUEST_TOKEN must be at least 32 characters when set")
    .regex(
      /^[\x21-\x7E]+$/,
      "INTERNAL_REQUEST_TOKEN must contain only visible ASCII characters (no whitespace, no control or non-ASCII characters) when set",
    )
    .optional(),
});

const parsed = serverEnvSchema.safeParse({
  API_BASE_URL: process.env.API_BASE_URL,
  INTERNAL_REQUEST_TOKEN: process.env.INTERNAL_REQUEST_TOKEN,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid server environment variables: ${details}`);
}

export const serverEnv = parsed.data;
