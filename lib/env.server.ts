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
  INTERNAL_REQUEST_TOKEN: z
    .string()
    .min(32, "INTERNAL_REQUEST_TOKEN must be at least 32 characters when set")
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
