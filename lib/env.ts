import { z } from "zod";

/**
 * Boot-time environment validation (CONVENTIONS §3 — "no unvalidated process.env
 * reads"). This is the first PR that consumes an env var (NEXT_PUBLIC_SITE_URL),
 * so the zod schema lands here. `NEXT_PUBLIC_*` vars are inlined at build time, so
 * each must be referenced by its full literal name for Next's static replacement.
 */
const clientEnvSchema = z.object({
  // Absolute site origin, used for metadataBase + canonical/sitemap URLs.
  // Falls back to localhost for local dev; MUST be set to the real domain in prod.
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  // Analytics / Search Console placeholders — declared, not wired yet.
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_GSC_VERIFICATION: z.string().optional(),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  NEXT_PUBLIC_GSC_VERIFICATION: process.env.NEXT_PUBLIC_GSC_VERIFICATION,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${details}`);
}

export const env = parsed.data;
