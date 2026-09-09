import { randomBytes } from "node:crypto";
import { renameSync, writeFileSync, writeSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  chromium,
  type BrowserContext,
  type Cookie,
  type Page,
  type Request,
  type Response,
} from "playwright";

import {
  RenderAuthError,
  assertLoopbackTarget,
  assertNoRegisterPath,
  assertSameOrigin,
  originKey,
  redactJsonValue,
  redactSecrets,
  registerSecret,
  allocateBaseName,
  REGISTER_PATH_PATTERN,
} from "./render-auth-guards.ts";

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
 * own `playwright` devDependency. The pure boundary logic — the loopback guard, the
 * per-navigation origin check, the register-path guard and secret redaction — lives in the
 * sibling module `render-auth-guards.ts`; this file keeps only the browser driving and I/O.
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
 * row. `assertNoRegisterPath()` (imported below) enforces the `/kayit`-avoidance half of that
 * boundary at runtime, not only in this comment, and is applied to every path this tool
 * resolves: the raw `--paths` string, the resolved pathname, and the LANDED pathname after
 * every navigation.
 *
 * ## Production-use risk (plan §10, Acceptance Criterion 3) — narrowed, PR #131 fix round
 * This guard proves the target *socket* is loopback: the scheme is `http:`/`https:`, the host
 * literal is a conventional loopback spelling, DNS resolves it inside `127.0.0.0/8` or `::1`
 * (`assertLoopbackTarget()`, imported from `render-auth-guards.ts` — mirroring, not importing,
 * `cografya_api/tools/dev-fixtures/local-database-guard.ts`'s own `isLoopbackHostname`/
 * `isLoopbackAddress` logic, since no cross-repo import path exists for a build-step-free tool
 * in this repo either), and every navigation this script performs is re-checked against that
 * verified target, including the origin a redirect actually lands on. It does NOT prove which
 * *process* is listening there: an `ssh -L` or `kubectl port-forward` tunnel binds a remote
 * service to loopback and passes this guard unchanged — see `ENGINEERING.md` §11 for the full,
 * honest guarantee text. Do not run this tool with such a tunnel open.
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
 * ## Credential leak paths OUTSIDE this tool's sinks (`ENGINEERING.md` §11, the same class
 * sentence). Redaction reaches only what this file writes. The Chromium subprocess inherits
 * `RENDER_AUTH_PASSWORD` and it is readable through `/proc/<pid>/environ` for the life of the
 * run; Playwright's own `debug`-based loggers print the filled value verbatim, from outside
 * these sinks, for a CLASS of namespaces (`pw:api`, `pw:channel` and `pw:protocol` are the ones
 * measured, not the only ones possible — `pw:*` and a bare `*` enable all three), so do not run
 * this tool with a `DEBUG` value that enables any `pw:` namespace; and `DEBUG_FILE` REDIRECTS
 * that output to a file rather than duplicating it, which makes the leak silent and persistent,
 * so do not set it while running this tool.
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
// CLI args + env contract
// ---------------------------------------------------------------------------------------------

interface CliArgs {
  readonly paths: readonly string[];
  readonly outDir: string;
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

  // The moment the password validates, before any code that could throw with it in scope.
  registerSecret(password);

  return { baseUrl, email, password };
}

// ---------------------------------------------------------------------------------------------
// stdout / stderr — every write goes through here, so redaction is structural, not a habit.
// ---------------------------------------------------------------------------------------------

/** Overall budget for one write against a reader that has stopped consuming but has not closed.
 *  A line that cannot be handed over inside this window is dropped rather than parking the run
 *  behind a stalled consumer. */
const WRITE_DEADLINE_MS = 2_000;
const EAGAIN_PAUSE_MS = 5;
/** `Atomics.wait` needs a shared `Int32Array`. Nothing ever notifies this cell, so every wait
 *  times out — that is the point: a synchronous sleep with no busy loop, available on Node's
 *  main thread (measured: a 25 ms request returned "timed-out"). */
const writePauseCell = new Int32Array(new SharedArrayBuffer(4));

function writeFdSync(fd: 1 | 2, text: string): void {
  const buffer = Buffer.from(redactSecrets(text), "utf8");
  let offset = 0;
  const deadline = Date.now() + WRITE_DEADLINE_MS;
  while (offset < buffer.length) {
    try {
      offset += writeSync(fd, buffer, offset, buffer.length - offset);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EAGAIN" || code === "EINTR") {
        if (Date.now() >= deadline) return;
        if (code === "EAGAIN") Atomics.wait(writePauseCell, 0, 0, EAGAIN_PAUSE_MS);
        continue;
      }
      return;
    }
  }
}

function writeStdout(text: string): void {
  writeFdSync(1, text);
}

/** Synchronous, so a last-gasp message reaches fd 2 before an immediate `process.exit`, and it
 *  finishes a short write instead of assuming one call was enough. It can still drop a message
 *  a reader has stopped taking; it never throws, which is what lets the fatal handler always
 *  reach `process.exit(1)`. */
function writeStderr(text: string): void {
  writeFdSync(2, text);
}

// ---------------------------------------------------------------------------------------------
// Evidence types
// ---------------------------------------------------------------------------------------------

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
  /** `null` when the request never produced a response (see `failure`). */
  readonly status: number | null;
  /** `request.failure()?.errorText`, populated only on a `requestfailed` event. */
  readonly failure: string | null;
}

// ---------------------------------------------------------------------------------------------
// RunRecorder — the ONLY writer of run evidence. Every artefact is written THROUGH it, and the
// same call updates `__run.json`, so there is no code path that writes a file without recording
// it. Redaction happens on the VALUE handed in, before serialisation — never on an already-
// serialised string, which could have escaped the literal substring (`JSON.stringify` turns
// `"`/`\` into `\"`/`\\`).
//
// One file in `runDir` is not an artefact and carries no manifest entry: `__run.json.tmp`, the
// manifest's own staging file. `persist()` writes it and renames it over `__run.json` in the
// same synchronous call, so it is normally never observable; finding one left behind means the
// process died between those two operations.
// ---------------------------------------------------------------------------------------------

interface RunManifestLoginStep {
  readonly baseName: string;
  readonly files: readonly string[];
  readonly landedUrl: string;
  readonly at: string;
}

interface RunManifestCapture {
  readonly requestedPath: string;
  readonly baseName: string;
  readonly landedUrl: string;
  readonly files: readonly string[];
  readonly title: string;
  readonly canonical: string | null;
  readonly hreflangs: SeoFacts["hreflangs"];
  readonly robots: string | null;
  readonly jsonLdCount: number;
  readonly consoleErrorCount: number;
  readonly networkFailureCount: number;
  readonly networkErrorStatusCount: number;
  readonly at: string;
}

interface RunManifest {
  readonly schema: 1;
  readonly tool: "render-authenticated-page";
  status: "running" | "completed" | "failed";
  readonly startedAt: string;
  finishedAt: string | null;
  readonly baseUrl: string;
  readonly verifiedOrigin: string;
  readonly email: string;
  readonly requestedPaths: readonly string[];
  loginStep: RunManifestLoginStep | null;
  captures: RunManifestCapture[];
  error: string | null;
}

function formatRunTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

class RunRecorder {
  readonly runDir: string;
  private readonly manifestPath: string;
  private manifest: RunManifest;

  // Not a TypeScript parameter-property constructor: this file runs directly under Node's
  // native (erasable-syntax-only) type stripping, which does not support that shorthand —
  // measured directly against this file, not assumed.
  private constructor(runDir: string, manifestPath: string, manifest: RunManifest) {
    this.runDir = runDir;
    this.manifestPath = manifestPath;
    this.manifest = manifest;
  }

  static async open(
    outDir: string,
    baseUrl: string,
    verifiedOrigin: string,
    email: string,
    requestedPaths: readonly string[],
  ): Promise<RunRecorder> {
    const runDir = path.join(
      outDir,
      `run-${formatRunTimestamp(new Date())}-${randomBytes(3).toString("hex")}`,
    );
    await mkdir(runDir, { recursive: true });
    const manifest: RunManifest = {
      schema: 1,
      tool: "render-authenticated-page",
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      baseUrl,
      verifiedOrigin,
      email,
      requestedPaths: [...requestedPaths],
      loginStep: null,
      captures: [],
      error: null,
    };
    const recorder = new RunRecorder(runDir, path.join(runDir, "__run.json"), manifest);
    // Published BEFORE the first persist: the window between this directory existing and
    // `main()` receiving the recorder used to be one in which a fatal error could not mark the
    // run failed at all (CODE131R2-M1). This does not make the first write itself infallible —
    // if the very first `persist()` throws, no manifest can exist — but from that write onward
    // the handler always has a recorder to mark.
    activeRecorder = recorder;
    recorder.persist();
    // Printed as the FIRST line after the directory is created — before login — so a run that
    // fails afterwards still tells the operator where to look. A stage-1 refusal (see main())
    // happens before this ever runs, so it creates no directory and prints none.
    writeStdout(`[render-authenticated-page] run directory: ${runDir}\n`);
    return recorder;
  }

  /** Atomic and synchronous, both deliberately.
   *
   *  ATOMIC: the manifest is serialised in full to a sibling `.tmp` file and then renamed over
   *  the target, so a reader never observes a truncated or half-written `__run.json` — measured
   *  on the previous plain-`writeFile` shape, 216 unparseable reads over 40 rounds.
   *
   *  SYNCHRONOUS: the fatal handler marks the manifest and calls `process.exit(1)` in the SAME
   *  tick, so it must not be parked on a promise that may never settle. A synchronous function
   *  also cannot interleave with itself on a single-threaded runtime, which is what makes the
   *  temp file safe under a fixed name — the async `writeFile` + `rename` form of the same
   *  recipe rejected 40 of 80 concurrent persists with ENOENT, because the first rename moved
   *  the temp file out from under the second.
   *
   *  Redaction is applied to a COPY at serialisation time and never assigned back onto
   *  `this.manifest`, so the in-memory manifest keeps its real values and no value is redacted
   *  twice. */
  private persist(): void {
    const tmpPath = `${this.manifestPath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(redactJsonValue(this.manifest), null, 2), "utf8");
    renameSync(tmpPath, this.manifestPath);
  }

  async writeJson(fileName: string, value: unknown): Promise<string> {
    const redacted = redactJsonValue(value);
    await writeFile(path.join(this.runDir, fileName), JSON.stringify(redacted, null, 2), "utf8");
    return fileName;
  }

  async writeText(fileName: string, text: string): Promise<string> {
    await writeFile(path.join(this.runDir, fileName), redactSecrets(text), "utf8");
    return fileName;
  }

  /** Binary artefacts (the screenshot) are never redacted — redaction cannot reach image bytes,
   *  and this is stated as a boundary, not claimed closed (see the fill-path mitigations this
   *  tool relies on instead). */
  async writeBinary(fileName: string, data: Buffer): Promise<string> {
    await writeFile(path.join(this.runDir, fileName), data);
    return fileName;
  }

  recordLoginStep(baseName: string, files: readonly string[], landedUrl: string): void {
    this.manifest.loginStep = {
      baseName,
      files: [...files],
      landedUrl,
      at: new Date().toISOString(),
    };
    this.persist();
  }

  recordCapture(capture: RunManifestCapture): void {
    this.manifest.captures.push(capture);
    this.persist();
  }

  /** Writes the run's terminal status. Guarded so the FIRST terminal status wins: on one
   *  failure both `main()`'s own catch and the shared fatal handler reach this, and the
   *  earlier, more specific message must not be overwritten by the later one. A consequence
   *  worth knowing: a run whose evidence completed but whose browser teardown then failed keeps
   *  `status: "completed"` while the process still exits 1. */
  finishSync(status: "completed" | "failed", error: string | null): void {
    if (this.manifest.status !== "running") return;
    this.manifest.status = status;
    this.manifest.finishedAt = new Date().toISOString();
    this.manifest.error = error !== null ? redactSecrets(error) : null;
    this.persist();
  }

  /** The ordinary-path name for `finishSync` — same behaviour, no second mechanism. Two names
   *  exist so the fatal path's call site reads as what it is: a terminal mark that must land in
   *  the same tick as `process.exit(1)`. */
  finish(status: "completed" | "failed", error: string | null): void {
    this.finishSync(status, error);
  }
}

// ---------------------------------------------------------------------------------------------
// Frame-navigation watcher — registered on the context BEFORE any navigation. Catches anything
// that moves the main frame without going through `navigate()` below, including a same-document
// (pushState/replaceState-style) navigation. Fail-closed only: it can make the tool refuse, it
// can never make it accept.
// ---------------------------------------------------------------------------------------------

interface ViolationWatch {
  readonly violations: string[];
}

function createViolationWatch(): ViolationWatch {
  return { violations: [] };
}

function watchFrameNavigations(
  context: BrowserContext,
  page: Page,
  verifiedBase: URL,
  watch: ViolationWatch,
): void {
  const watched = new WeakSet<Page>();
  const attach = (target: Page): void => {
    if (watched.has(target)) return;
    watched.add(target);
    target.on("framenavigated", (frame) => {
      if (frame !== target.mainFrame()) return; // sub-frames (e.g. the YouTube embed) excluded
      const raw = frame.url();
      if (raw === "" || raw === "about:blank") return; // the initial blank document
      let landed: URL;
      try {
        landed = new URL(raw);
      } catch {
        watch.violations.push(`unparseable main-frame URL "${raw}"`);
        return;
      }
      if (originKey(landed) !== originKey(verifiedBase)) {
        watch.violations.push(`main frame landed on ${originKey(landed)}`);
      } else if (REGISTER_PATH_PATTERN.test(landed.pathname)) {
        watch.violations.push(`main frame landed on register path ${landed.pathname}`);
      }
    });
  };
  // Both are used because whether `context.on("page")` fires for the page returned by
  // `newPage()` was not measured — the main page must not be left unwatched on a guess.
  context.on("page", attach);
  attach(page);
}

function assertNoViolations(watch: ViolationWatch, context: string): void {
  if (watch.violations.length === 0) return;
  const detail = watch.violations.join("; ");
  watch.violations.length = 0;
  throw new RenderAuthError(
    `Refusing after ${context} — the frame-navigation watcher recorded a violation: ${detail}.`,
  );
}

/** The three checks stage 1 (`main()`) and stage 2 (`navigate()`) both run on a `--paths`
 *  entry, defined once so the two copies cannot drift. This does NOT merge the two call sites:
 *  they exist at two different times for two different reasons (plan §5.3) and both are kept. */
function resolveCheckedTarget(targetPath: string, verifiedBase: URL): URL {
  const url = new URL(targetPath, verifiedBase); // may inherit a foreign host
  assertSameOrigin(url, verifiedBase, `--paths entry "${targetPath}"`); // constructed-URL check
  assertNoRegisterPath(url.pathname); // resolved pathname, not the raw string
  return url;
}

// ---------------------------------------------------------------------------------------------
// The single checked navigation path. Exactly one `page.goto` call site exists in this file,
// here — a structural test (`render-auth-guards.test.ts` group H) asserts the call-site count
// so a future contributor cannot quietly add a second one.
// ---------------------------------------------------------------------------------------------

async function navigate(
  page: Page,
  verifiedBase: URL,
  targetPath: string,
  watch: ViolationWatch,
): Promise<URL> {
  const url = resolveCheckedTarget(targetPath, verifiedBase);

  await page.goto(url.toString(), { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });

  const landed = new URL(page.url()); // page.goto FOLLOWS redirects
  assertSameOrigin(landed, verifiedBase, `landed URL for "${targetPath}"`);
  assertNoRegisterPath(landed.pathname);
  assertNoViolations(watch, `navigation to "${targetPath}"`);
  return landed;
}

/** Re-checks the CURRENT page location against the verified base — used where the page moved
 *  without a fresh `navigate()` call (a client-side redirect, or the post-hydration settle
 *  window), never as a substitute for `navigate()` itself. */
function assertStillOnVerifiedOrigin(page: Page, verifiedBase: URL, context: string): URL {
  const current = new URL(page.url());
  assertSameOrigin(current, verifiedBase, context);
  assertNoRegisterPath(current.pathname);
  return current;
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

async function login(
  page: Page,
  verifiedBase: URL,
  email: string,
  password: string,
  watch: ViolationWatch,
): Promise<URL> {
  // N1 — the landed-origin check inside navigate() MUST complete before the password is typed
  // below (Appendix B C10, the round's sharpest ordering constraint): once a value is entered
  // into a foreign document, no later check can recall it.
  await navigate(page, verifiedBase, "/giris", watch);

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

  // N3 — the client-side redirect above never goes through navigate(); re-check explicitly,
  // before trusting the cookie.
  const landed = assertStillOnVerifiedOrigin(page, verifiedBase, "the post-login redirect");
  assertNoViolations(watch, "the post-login redirect");

  const cookies: readonly Cookie[] = await page.context().cookies();
  const hasAccessCookie = cookies.some((cookie) => cookie.name === "cg_access");
  if (!hasAccessCookie) {
    throw new RenderAuthError(describeLoginFailure(verifiedBase.toString(), email));
  }

  return landed;
}

// ---------------------------------------------------------------------------------------------
// Per-path capture
// ---------------------------------------------------------------------------------------------

async function captureLoginStep(
  recorder: RunRecorder,
  consoleLog: readonly ConsoleEntry[],
  networkLog: readonly NetworkEntry[],
  landedUrl: URL,
): Promise<void> {
  // Dedicated evidence for the login step itself — this is where a reviewer finds the
  // `POST /api/auth/login` call and its 2xx status, separate from any target page's own scoped
  // capture. `__` prefix keeps this name out of the way of any real `--paths` entry's sanitized
  // filename (and `counts` below is pre-seeded so a colliding entry is still distinguishable).
  const consoleFile = await recorder.writeJson("__login-step.console.json", consoleLog);
  const networkFile = await recorder.writeJson("__login-step.network.json", networkLog);
  recorder.recordLoginStep("__login-step", [consoleFile, networkFile], landedUrl.toString());
}

async function capturePath(
  page: Page,
  verifiedBase: URL,
  targetPath: string,
  recorder: RunRecorder,
  counts: Map<string, number>,
  consoleLog: ConsoleEntry[],
  networkLog: NetworkEntry[],
  watch: ViolationWatch,
): Promise<void> {
  assertNoRegisterPath(targetPath);

  // Reset BEFORE this path's own navigation: each path's evidence is scoped to that path's OWN
  // render, never contaminated by another path's activity or by the pre-login anonymous session
  // check (which legitimately 401s and is NOT a defect). The listeners keep pushing into these
  // SAME array objects (passed by reference); only their contents are cleared.
  consoleLog.length = 0;
  networkLog.length = 0;

  const landed = await navigate(page, verifiedBase, targetPath, watch);

  // `waitUntil: "networkidle"` is NOT used inside navigate(): Next's dev server (Turbopack HMR)
  // holds a persistent WebSocket open for the life of the page, so "no network connections for
  // 500ms" never becomes true in dev mode. `load` is the hard wait; this short attempt is a
  // best-effort settle window for post-hydration client fetches, allowed to time out.
  await page.waitForLoadState("networkidle", { timeout: HYDRATION_SETTLE_TIMEOUT_MS }).catch(() => {
    // Expected in dev mode (see comment above) — proceed with whatever has settled so far.
  });

  // N5 — a client-side navigation could have moved the page during the settle window above.
  // Re-check immediately before reading or writing ANY evidence for this path.
  assertStillOnVerifiedOrigin(page, verifiedBase, `the settle window for "${targetPath}"`);
  assertNoViolations(watch, `the settle window for "${targetPath}"`);

  // EVERY browser read happens first and NOTHING is written until the guard has been drained
  // again below. The screenshot is taken as a Buffer with no `path` option for the same reason:
  // the recorder stays the only writer, so a capture the guard refuses leaves nothing behind —
  // no html file, no console log, no network log, no image.
  const html = await page.content();
  const seoFacts = await extractSeoFacts(page);
  const png = await page.screenshot({ fullPage: true });

  // The reads above can themselves span a client-side navigation, so the guard is drained once
  // more here: after the last read, before the first write. The previous revision drained only
  // before the reads, which left three of this path's four artefacts already on disk by the
  // time a violation could be noticed.
  assertStillOnVerifiedOrigin(page, verifiedBase, `the evidence read for "${targetPath}"`);
  assertNoViolations(watch, `the evidence read for "${targetPath}"`);

  const baseName = allocateBaseName(counts, targetPath);
  const htmlFile = await recorder.writeText(`${baseName}.html`, html);
  const consoleFile = await recorder.writeJson(`${baseName}.console.json`, consoleLog);
  const networkFile = await recorder.writeJson(`${baseName}.network.json`, networkLog);
  const pngFile = await recorder.writeBinary(`${baseName}.png`, png);

  const consoleErrorCount = consoleLog.filter((entry) => entry.type === "error").length;
  const networkFailureCount = networkLog.filter((entry) => entry.status === null).length;
  const networkErrorStatusCount = networkLog.filter(
    (entry) => entry.status !== null && entry.status >= 400,
  ).length;

  recorder.recordCapture({
    requestedPath: targetPath,
    baseName,
    landedUrl: landed.toString(),
    files: [htmlFile, consoleFile, networkFile, pngFile],
    title: seoFacts.title,
    canonical: seoFacts.canonical,
    hreflangs: seoFacts.hreflangs,
    robots: seoFacts.robots,
    jsonLdCount: seoFacts.jsonLdCount,
    consoleErrorCount,
    networkFailureCount,
    networkErrorStatusCount,
    at: new Date().toISOString(),
  });

  writeStdout(
    `[render-authenticated-page] ${targetPath} -> title="${seoFacts.title}" ` +
      `canonical=${seoFacts.canonical ?? "(none)"} ` +
      `hreflang=[${seoFacts.hreflangs.map((entry) => entry.hreflang ?? "?").join(", ")}] ` +
      `robots=${seoFacts.robots ?? "(none)"} jsonLdCount=${seoFacts.jsonLdCount} ` +
      `consoleErrorCount=${consoleErrorCount} networkFailureCount=${networkFailureCount}\n`,
  );
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = readEnvContract();

  // AC-3 enforcement point: refuse before touching the filesystem or opening a browser at all
  // unless the target is a DNS-verified loopback origin.
  const verifiedBase = await assertLoopbackTarget(env.baseUrl);

  // Stage 1 — every --paths entry is resolved against the VERIFIED base and checked before any
  // side effect exists. When this refuses there is no run directory and no browser process.
  // Stage 2 (navigate(), below) exists because stage 1 cannot see a LANDED url, and because a
  // future caller could reach navigate() without going through this loop.
  for (const targetPath of args.paths) {
    resolveCheckedTarget(targetPath, verifiedBase);
  }

  const recorder = await RunRecorder.open(
    args.outDir,
    env.baseUrl,
    originKey(verifiedBase),
    env.email,
    args.paths,
  );

  // Reserved so a --paths entry that happens to sanitize to one of these names is still
  // distinguishable (pushed to a numeric suffix) rather than colliding silently.
  const counts = new Map<string, number>([
    ["__login-step", 1],
    ["__run", 1],
  ]);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const watch = createViolationWatch();
    watchFrameNavigations(context, page, verifiedBase, watch); // BEFORE any navigation

    const consoleLog: ConsoleEntry[] = [];
    const networkLog: NetworkEntry[] = [];

    page.on("console", (message) => {
      consoleLog.push({
        type: message.type(),
        text: message.text(),
        location: message.location().url || undefined,
      });
    });
    // No separate "request" listener / pending-requests map (CS131-M1 removed): both handlers
    // below read the synchronous getters directly at the moment they fire.
    page.on("response", (response: Response) => {
      const request = response.request();
      networkLog.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status: response.status(),
        failure: null,
      });
    });
    page.on("requestfailed", (request: Request) => {
      networkLog.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status: null,
        failure: request.failure()?.errorText ?? "(unknown)",
      });
    });

    const landedLogin = await login(page, verifiedBase, env.email, env.password, watch);
    writeStdout(
      `[render-authenticated-page] authenticated as ${env.email} — cg_access cookie present.\n`,
    );
    await captureLoginStep(recorder, consoleLog, networkLog, landedLogin);

    for (const targetPath of args.paths) {
      await capturePath(
        page,
        verifiedBase,
        targetPath,
        recorder,
        counts,
        consoleLog,
        networkLog,
        watch,
      );
    }

    // The watcher can hold a violation no per-path drain happened to observe — a frame
    // navigation that lands after the last capture's own check. Draining here is what makes
    // `status: "completed"` mean "no violation was ever recorded", not "none was seen at a
    // checkpoint".
    assertNoViolations(watch, "the run");
    recorder.finish("completed", null);
  } catch (error) {
    // The terminal status is written HERE, synchronously, and deliberately BEFORE the `finally`
    // below: `browser.close()` is issued with playwright's own `kNoTimeout` and then awaits the
    // browser's closed-promise, so an unresponsive Chromium can park this unwind indefinitely.
    // Writing first means `__run.json` carries `failed` plus the message even in that case. The
    // shared fatal handler runs afterwards, finds the status already terminal, and leaves this
    // more specific message alone.
    recorder.finishSync("failed", describeFatalError(error));
    throw error;
  } finally {
    // Deliberately NOT abandoned on this path (contrast the crash handlers below): an ordinary
    // thrown error here still unwinds through this `finally` before the rejection reaches the
    // shared handler — as long as `browser.close()` resolves, which is exactly why the terminal
    // status is written in the `catch` above rather than left to this unwind.
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Fatal-error handling — ONE function serves all three entry points (the rejected main()
// promise, `uncaughtException`, `unhandledRejection`), so a genuinely uncaught throw (e.g. one
// raised inside a `page.on` listener, outside this file's own control flow) is handled exactly
// like an ordinary refusal. Contract, binding: it (1) writes stderr, redacted, through a writer
// that cannot throw, (2) best-effort marks the run manifest failed, wrapped so it can never
// itself throw, and (3) terminates.
//
// The handler is FULLY SYNCHRONOUS, and that is what makes step 3 a guarantee rather than an
// intention. There is no `await` in front of `process.exit(1)`, so no write that fails to settle
// can park the process short of it; and because the event loop is never re-entered, `main()`
// cannot write one further line of evidence after a fatal error — no separate abort flag is
// needed to hold that property. The re-entry guard exits rather than returning, so a second
// entry can only ever shorten the path to termination.
//
// Step 3 is not optional — with a live Chromium holding the event loop open, a handler that only
// prints converts a fatal error into a hang. Browser cleanup is deliberately abandoned on this
// path: a leaked headless Chromium is a visible, recoverable local nuisance, whereas a run that
// keeps writing evidence after a violation is exactly the false-clean outcome this tool exists
// to prevent.
// ---------------------------------------------------------------------------------------------

let activeRecorder: RunRecorder | undefined;
let exiting = false;

/** The single derivation of a fatal error's text, so the operator's terminal line and the
 *  manifest's `error` field can never say different things. */
function describeFatalError(error: unknown): string {
  if (error instanceof RenderAuthError) return error.message;
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

function handleFatalError(error: unknown): never {
  if (exiting) process.exit(1);
  exiting = true;

  const prefix = error instanceof RenderAuthError ? "REFUSED" : "FATAL";
  try {
    writeStderr(`[render-authenticated-page] ${prefix}: ${describeFatalError(error)}\n`);
  } catch {
    // Defence in depth: `writeStderr` is built not to throw, and step 3 still runs if it does.
  }

  try {
    activeRecorder?.finishSync("failed", describeFatalError(error));
  } catch {
    // best-effort — this handler must never itself throw.
  }

  process.exit(1);
}

process.on("uncaughtException", (error) => {
  handleFatalError(error);
});
process.on("unhandledRejection", (reason) => {
  handleFatalError(reason);
});

main().catch((error: unknown) => {
  handleFatalError(error);
});
