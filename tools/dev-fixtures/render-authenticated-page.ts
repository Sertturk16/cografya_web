import { promises as dns } from "node:dns";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Cookie, type Page, type Request, type Response } from "playwright";

/**
 * `tools/dev-fixtures/render-authenticated-page.ts` — a repeatable, non-interactive way for a
 * READ-ONLY review leg to load an authenticated page in a real browser and capture DOM, console
 * and network evidence, closing the gap PR #128's round-1/round-2 FENER/a11y/design-fidelity
 * checkpoints recorded (`Owner's Inbox/fener-oturumlu-render-pasi/plan.md` §1).
 *
 *   RENDER_AUTH_PASSWORD='<value>' node tools/dev-fixtures/render-authenticated-page.ts \
 *     --paths /giris,/en/login --out-dir /tmp/render-pass
 *
 * ## What this is built from (plan §5) — an assembly of parts the repo already has
 * The `iris-audit@local.test` fixture account (`cografya_api/tools/dev-fixtures/
 * iris-audit-account.ts`, `DEC 2026-08-27e`), the app's own `/giris` login FORM
 * (`components/auth/login-form.tsx`) and cookie session (`lib/auth/cookies.ts`), and the repo's
 * own `playwright` devDependency. Nothing new except this driver and its documentation.
 *
 * ## Why the real login FORM, not a raw `fetch('/api/auth/login', …)`
 * A raw fetch would need to reconstruct `submitAuth()`'s exact request shape and would silently
 * drift the moment that shape changes. Automating the actual form costs nothing more and cannot
 * drift (plan §5).
 *
 * ## Read-only boundary this script is built to respect (plan §2/§10, `REVIEW-POLICY.md` §0/§3)
 * This script never touches `/kayit` (register — creates a NEW user row, the real mutation
 * risk) and only ever logs in with an EXISTING, already-provisioned synthetic fixture account
 * through the app's own `/giris` login form — no new account, no new content, no product-data
 * row. `assertNoRegisterPath()` below enforces the `/kayit`-avoidance half of that boundary at
 * runtime, not only in this comment.
 *
 * ## Production-use risk (plan §10, Acceptance Criterion 3)
 * Even if the fixture credential leaked, it authenticates nothing in production: production has
 * no such row (the api-side fixture tool refuses to provision anywhere but a DNS-verified
 * loopback database), and a login attempt against a real deployment simply fails. This script
 * additionally refuses to run at all unless `RENDER_AUTH_BASE_URL` is itself a DNS-verified
 * loopback target — `assertLoopbackTarget()` below, mirroring (not importing — no cross-repo
 * import is available from a Node-native-TS tool with no build step, the same reason
 * `cografya_api/tools/dev-fixtures/local-database-guard.ts`'s own header gives) that file's
 * `isLoopbackHostname`/`isLoopbackAddress` logic.
 *
 * ## Stale/rotated credential (plan §10 risk, Atlas §13.2 ruling)
 * `iris-audit-account.ts` is idempotent but NOT append-only: a re-run (e.g. by İRİS re-running
 * her own provisioning step, or a concurrent render-pass invocation) resets the row's password
 * hash and bumps `token_version`, which invalidates any access token already issued to a
 * session that logged in before that re-run. A render-pass that is mid-flight when this happens
 * is not affected (its `cg_access` cookie was already minted and is not re-validated against
 * `token_version` on read — only a subsequent LOGIN or refresh would fail), but a render-pass
 * started AFTER the rotation, using the password value this script's caller was given BEFORE the
 * rotation, gets a genuine wrong-password failure. This script cannot tell "account never
 * existed" apart from "password is stale" apart from "password was simply typed wrong" — all
 * three surface at the same login form and all three get the SAME, explicit, actionable refusal
 * (`describeLoginFailure()` below): re-run the provisioner and pass its fresh password through.
 * It never proceeds past a failed login and never reports a false "clean" evidence set.
 *
 * ## What this deliberately is NOT
 * Not wired into `package.json` scripts, not wired into CI — run by hand only, exactly like
 * `iris-audit-account.ts`'s own stated design. Never imported by product code.
 */

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_EMAIL = "iris-audit@local.test";
const NAVIGATION_TIMEOUT_MS = 15_000;
const LOGIN_SUBMIT_TIMEOUT_MS = 15_000;
/** Best-effort settle window after `load`, NOT a hard requirement (see `capturePath` below). */
const HYDRATION_SETTLE_TIMEOUT_MS = 3_000;

// ---------------------------------------------------------------------------------------------
// Loopback guard for RENDER_AUTH_BASE_URL — the AC-3 enforcement point (plan §10/§400 manifest).
// Mirrors `cografya_api/tools/dev-fixtures/local-database-guard.ts`'s logic; not imported (no
// cross-repo import path exists for a build-step-free tool in this repo either).
// ---------------------------------------------------------------------------------------------

const ALLOWED_LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/** True only for the three conventional loopback spellings (IPv6 bracket form unwrapped first). */
function isLoopbackHostname(rawHostname: string): boolean {
  let hostname = rawHostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  return ALLOWED_LOOPBACK_HOSTNAMES.has(hostname);
}

const OCTET = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])";
const LOOPBACK_V4_PATTERN = new RegExp(`^127\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);

/** True only for a resolved address inside `127.0.0.0/8` or `::1`. */
function isLoopbackAddress(address: string): boolean {
  if (address === "::1") return true;
  const ipv4 = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  return LOOPBACK_V4_PATTERN.test(ipv4);
}

type DnsLookupFn = (
  hostname: string,
) => Promise<ReadonlyArray<{ address: string; family: number }>>;

const defaultLookup: DnsLookupFn = (hostname) => dns.lookup(hostname, { all: true });

class RenderAuthError extends Error {}

/**
 * Refuses (throws {@link RenderAuthError}) unless BOTH hold: the URL's hostname literal is a
 * conventional loopback spelling, AND that hostname's actual DNS resolution is loopback too.
 * No navigation happens before this resolves.
 */
async function assertLoopbackTarget(
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

  const hostname = parsed.hostname;
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

// ---------------------------------------------------------------------------------------------
// CLI args + env contract
// ---------------------------------------------------------------------------------------------

interface CliArgs {
  readonly paths: readonly string[];
  readonly outDir: string;
}

/** Prohibition (plan §400 manifest, binding): never navigate to or interact with `/kayit`. Also
 *  blocks the EN twin (`/en/register`, `/en/v2/register`) and the v2 TR twin (`/v2/kayit`). */
const REGISTER_PATH_PATTERN = /(^|\/)(kayit|register)(\/|$)/i;

function assertNoRegisterPath(targetPath: string): void {
  if (REGISTER_PATH_PATTERN.test(targetPath)) {
    throw new RenderAuthError(
      `Refusing to navigate to "${targetPath}" — this tool must never touch a register path ` +
        `(the reviewer read-only boundary's real mutation risk, plan §2/§10). This is not a ` +
        `configuration mistake to work around; pass a different --paths value.`,
    );
  }
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function parseArgs(argv: readonly string[]): CliArgs {
  const rawPaths = readFlagValue(argv, "--paths");
  const outDir = readFlagValue(argv, "--out-dir");

  if (rawPaths === undefined) {
    throw new RenderAuthError("Missing required --paths <comma-separated concrete paths>.");
  }
  if (outDir === undefined) {
    throw new RenderAuthError("Missing required --out-dir <directory>.");
  }

  const paths = rawPaths
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (paths.length === 0) {
    throw new RenderAuthError("--paths produced no usable entries after parsing.");
  }
  for (const targetPath of paths) {
    if (!targetPath.startsWith("/")) {
      throw new RenderAuthError(`--paths entry "${targetPath}" must start with "/".`);
    }
    assertNoRegisterPath(targetPath);
  }

  return { paths, outDir };
}

interface EnvContract {
  readonly baseUrl: string;
  readonly email: string;
  readonly password: string;
}

const PROVISIONER_HINT =
  "re-run the fixture provisioner from cografya_api, then pass the SAME password as " +
  "RENDER_AUTH_PASSWORD:\n" +
  "  DATABASE_URL=postgresql://cografya:cografya_dev@localhost:5433/cografya \\\n" +
  "    AUDIT_ACCOUNT_PASSWORD='<a chosen value>' \\\n" +
  "    node tools/dev-fixtures/iris-audit-account.ts";

function readEnvContract(): EnvContract {
  const baseUrl = process.env.RENDER_AUTH_BASE_URL ?? DEFAULT_BASE_URL;
  const email = process.env.RENDER_AUTH_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.RENDER_AUTH_PASSWORD;

  if (password === undefined || password.length === 0) {
    throw new RenderAuthError(
      "RENDER_AUTH_PASSWORD is required and has no default (plan Acceptance Criterion 3 — no " +
        `credential this script would silently invent). To obtain a value, ${PROVISIONER_HINT}`,
    );
  }

  return { baseUrl, email, password };
}

// ---------------------------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------------------------

function sanitizePathForFilename(targetPath: string): string {
  const trimmed = targetPath.replace(/^\/+/, "").replace(/\/+$/, "");
  if (trimmed.length === 0) return "root";
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

interface SeoFacts {
  readonly title: string;
  readonly canonical: string | null;
  readonly hreflangs: ReadonlyArray<{ hreflang: string | null; href: string | null }>;
  readonly robots: string | null;
  readonly jsonLdCount: number;
}

async function extractSeoFacts(page: Page): Promise<SeoFacts> {
  return page.evaluate(() => {
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const hreflangEls = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'));
    const robotsEl = document.querySelector('meta[name="robots"]');
    const jsonLdEls = document.querySelectorAll('script[type="application/ld+json"]');
    return {
      title: document.title,
      canonical: canonicalEl ? canonicalEl.getAttribute("href") : null,
      hreflangs: hreflangEls.map((el) => ({
        hreflang: el.getAttribute("hreflang"),
        href: el.getAttribute("href"),
      })),
      robots: robotsEl ? robotsEl.getAttribute("content") : null,
      jsonLdCount: jsonLdEls.length,
    };
  });
}

interface ConsoleEntry {
  readonly type: string;
  readonly text: string;
  readonly location: string | undefined;
}

interface NetworkEntry {
  readonly url: string;
  readonly method: string;
  readonly resourceType: string;
  readonly status: number;
}

// ---------------------------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------------------------

function describeLoginFailure(baseUrl: string, email: string): string {
  return (
    `Login did not produce an authenticated session (no "cg_access" cookie after submitting ` +
    `the /giris form for "${email}" against ${baseUrl}). This is reported loudly rather than as ` +
    `a silent/unauthenticated render, because an unauthenticated render reported as authenticated ` +
    `would produce a false-clean review pass (plan §10). The three most likely causes are the ` +
    `SAME failure mode at the login form: the fixture account does not exist yet, its password ` +
    `has gone stale (rotated by a later provisioner run), or RENDER_AUTH_PASSWORD/RENDER_AUTH_EMAIL ` +
    `simply do not match what is currently provisioned. In every case, ${PROVISIONER_HINT}`
  );
}

async function login(page: Page, baseUrl: string, email: string, password: string): Promise<void> {
  const loginUrl = new URL("/giris", baseUrl).toString();
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });

  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.click('button[type="submit"]');

  // Client-side `router.replace(...)` on success, not a full page load — wait for the URL to
  // move away from `/giris`, never a load-state wait (plan §5).
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/giris"), {
      timeout: LOGIN_SUBMIT_TIMEOUT_MS,
    });
  } catch {
    // Fall through — the cookie check below is the authoritative, loud failure signal.
  }

  const cookies: readonly Cookie[] = await page.context().cookies();
  const hasAccessCookie = cookies.some((cookie) => cookie.name === "cg_access");
  if (!hasAccessCookie) {
    throw new RenderAuthError(describeLoginFailure(baseUrl, email));
  }
}

// ---------------------------------------------------------------------------------------------
// Per-path capture
// ---------------------------------------------------------------------------------------------

async function writeEvidenceFiles(
  outDir: string,
  baseName: string,
  consoleLog: readonly ConsoleEntry[],
  networkLog: readonly NetworkEntry[],
): Promise<void> {
  await writeFile(
    path.join(outDir, `${baseName}.console.json`),
    JSON.stringify(consoleLog, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(outDir, `${baseName}.network.json`),
    JSON.stringify(networkLog, null, 2),
    "utf8",
  );
}

async function capturePath(
  page: Page,
  baseUrl: string,
  targetPath: string,
  outDir: string,
  consoleLog: ConsoleEntry[],
  networkLog: NetworkEntry[],
): Promise<void> {
  assertNoRegisterPath(targetPath);

  // Reset BEFORE this path's own navigation: each path's `.console.json`/`.network.json` is
  // scoped to that path's OWN render, never contaminated by another path's activity or by the
  // pre-login anonymous session check (which legitimately 401s — "not logged in yet" — and is
  // NOT a defect in the authenticated render this capture exists to evidence). The listeners
  // keep pushing into these SAME array objects (passed by reference); only their contents are
  // cleared, never the arrays themselves, so the closures registered once in `main()` keep
  // working after this reset.
  consoleLog.length = 0;
  networkLog.length = 0;

  const url = new URL(targetPath, baseUrl).toString();
  // `waitUntil: "networkidle"` is NOT used here: Next's dev server (Turbopack HMR) holds a
  // persistent WebSocket open for the life of the page, so "no network connections for 500ms"
  // never becomes true in dev mode — measured directly (a real `/giris` load never reached
  // networkidle inside a 15s window). `load` is the hard wait; the short networkidle attempt
  // after it is a best-effort settle window for post-hydration client fetches (e.g.
  // `useAuthSession`'s own session check) and is allowed to time out without failing the
  // capture — it is not this function's authoritative readiness signal.
  await page.goto(url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
  await page.waitForLoadState("networkidle", { timeout: HYDRATION_SETTLE_TIMEOUT_MS }).catch(() => {
    // Expected in dev mode (see comment above) — proceed with whatever has settled so far.
  });

  const html = await page.content();
  const seoFacts = await extractSeoFacts(page);

  const base = sanitizePathForFilename(targetPath);
  await writeFile(path.join(outDir, `${base}.html`), html, "utf8");
  await writeEvidenceFiles(outDir, base, consoleLog, networkLog);
  await page.screenshot({ path: path.join(outDir, `${base}.png`), fullPage: true });

  process.stdout.write(
    `[render-authenticated-page] ${targetPath} -> title="${seoFacts.title}" ` +
      `canonical=${seoFacts.canonical ?? "(none)"} ` +
      `hreflang=[${seoFacts.hreflangs.map((entry) => entry.hreflang ?? "?").join(", ")}] ` +
      `robots=${seoFacts.robots ?? "(none)"} jsonLdCount=${seoFacts.jsonLdCount}\n`,
  );
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = readEnvContract();

  // AC-3 enforcement point: refuse before opening a browser at all unless the target is a
  // DNS-verified loopback origin.
  await assertLoopbackTarget(env.baseUrl);

  await mkdir(args.outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Two arrays, reused (never reassigned) across the whole run: every `page.on("console"/
    // "request"/"response")` event pushes into whichever of these is currently "live". Each
    // path capture (`capturePath`) clears them immediately before its OWN navigation, so a
    // path's `.console.json`/`.network.json` is scoped to that path's own render — a benign
    // pre-login 401 from the anonymous session check, or another path's own network traffic,
    // never leaks into a later path's evidence file (an implementation choice the plan's §5
    // Technical Direction left open; measured necessary — see the login-step evidence below).
    const consoleLog: ConsoleEntry[] = [];
    const networkLog: NetworkEntry[] = [];
    const pendingRequests = new Map<
      Request,
      { url: string; method: string; resourceType: string }
    >();

    page.on("console", (message) => {
      consoleLog.push({
        type: message.type(),
        text: message.text(),
        location: message.location().url || undefined,
      });
    });
    page.on("request", (request: Request) => {
      pendingRequests.set(request, {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      });
    });
    page.on("response", (response: Response) => {
      const request = response.request();
      const info = pendingRequests.get(request) ?? {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      };
      networkLog.push({ ...info, status: response.status() });
    });

    await login(page, env.baseUrl, env.email, env.password);
    process.stdout.write(
      `[render-authenticated-page] authenticated as ${env.email} — cg_access cookie present.\n`,
    );
    // Dedicated evidence for the login step itself — this is where a reviewer finds the
    // `POST /api/auth/login` call and its 2xx status (plan §11 validation item 2), separate
    // from any target page's own scoped capture. `__` prefix keeps this name out of the way of
    // any real `--paths` entry's sanitized filename.
    await writeEvidenceFiles(args.outDir, "__login-step", consoleLog, networkLog);

    for (const targetPath of args.paths) {
      await capturePath(page, env.baseUrl, targetPath, args.outDir, consoleLog, networkLog);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof RenderAuthError) {
    process.stderr.write(`[render-authenticated-page] REFUSED: ${error.message}\n`);
  } else {
    process.stderr.write(
      `[render-authenticated-page] failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }\n`,
    );
  }
  process.exitCode = 1;
});
