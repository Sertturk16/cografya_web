import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * G5 (plan §9, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`): no
 * source under `components/auth/**` or the `lib/auth/*.ts` modules genuinely reachable from
 * it references `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` or
 * `caches` — the mechanism behind the acceptance line "no token and no PII in browser
 * storage" (plan §12 #2).
 *
 * `LIB_FILES` is DERIVED from the import graph, not hand-maintained (review
 * `TEST85-M1`/`C3`; plan header item 5) — a hand list silently stopped covering a new
 * `lib/auth` module the moment one shipped without a matching edit here, exactly the gap
 * `VAL85-V1`/`SEC85-M1` measured for `error-messages.ts` and `redirect.ts` when PR-1 added
 * them without updating this list. `reachableLibAuthModules` below walks OUTWARD from every
 * `@/lib/auth/X` VALUE import found in `components/auth/**`, then one hop further through
 * each found module's own imports (the `submit.client.ts` → `./redirect` case) — repeating
 * until the walk stabilises. A module reached only behind a `server-only` guard is excluded:
 * Next refuses to bundle one into client code at all, so it can never actually leak PII to a
 * browser regardless of who imports it (`cookies.ts`/`session.ts`/`transport.server.ts` are
 * excluded this way, not by name).
 *
 * Comments are stripped before matching (the `nav-disclosure.test.ts` pattern): this file's
 * own docblock and `submit.client.ts`'s own docblock both name the banned tokens in PROSE,
 * which must not self-trigger the scan.
 */

const COMPONENT_DIR = new URL("./", import.meta.url);
const LIB_AUTH_DIR = new URL("../../lib/auth/", import.meta.url);
const SELF = "no-browser-storage.test.ts";

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

function componentFiles(): { path: string; code: string }[] {
  const names = readdirSync(COMPONENT_DIR, { recursive: true, encoding: "utf8" }).filter(
    (name): name is string =>
      typeof name === "string" && /\.(?:ts|tsx)$/.test(name) && name !== SELF,
  );
  return names.map((name) => ({
    path: `components/auth/${name}`,
    code: stripComments(readFileSync(new URL(name, COMPONENT_DIR), "utf8")),
  }));
}

/** True for a module that literally CANNOT enter a browser bundle — Next fails the build if
 *  a client-reachable module imports one, so a module carrying this guard is safe to exclude
 *  from the audited surface regardless of who (transitively) imports it. */
function isServerOnlyGuarded(source: string): boolean {
  return /^import\s+"server-only";/m.test(source);
}

function extractImports(source: string, pattern: RegExp): string[] {
  const names = new Set<string>();
  for (const match of stripComments(source).matchAll(pattern)) {
    const raw = match[1];
    if (raw === undefined) continue;
    names.add(raw.endsWith(".ts") ? raw : `${raw}.ts`);
  }
  return [...names];
}

/** Every NON-type-only `@/lib/auth/X` import in a COMPONENT file — the only shape a
 *  component ever uses to reach `lib/auth` (a component's OWN relative `./X` imports point
 *  at a sibling component/CSS module, never at `lib/auth`, so that form must not be matched
 *  here — a real bug this file's own first draft hit: `./auth-form.module.css` is a genuine
 *  relative import inside `register-form.tsx`, and matching `./X` at this entry point tried
 *  to resolve it as a `lib/auth` module and threw `ENOENT`). `import type` is excluded on
 *  purpose: a type-only import is erased at compile time and never enters the runtime bundle. */
const COMPONENT_LIB_AUTH_IMPORT =
  /^import\s+(?!type\b)[^;]*\sfrom\s+["']@\/lib\/auth\/([\w.-]+)["'];?\s*$/gm;

/** Every NON-type-only import of a SIBLING `lib/auth/*` module, found either through the
 *  `@/lib/auth/X` alias or a relative `./X` — the shape a MODULE INSIDE `lib/auth` uses to
 *  reach another one (e.g. `submit.client.ts` → `./redirect`). Only ever applied to a
 *  `lib/auth/*.ts` source, where a relative import unambiguously means a `lib/auth` sibling. */
const LIB_AUTH_SIBLING_IMPORT =
  /^import\s+(?!type\b)[^;]*\sfrom\s+["'](?:@\/lib\/auth\/|\.\/)([\w.-]+)["'];?\s*$/gm;

/** The full set of `lib/auth/*` modules genuinely reachable from a browser bundle — see the
 *  module docblock above for the walk and the `server-only` exclusion. */
function reachableLibAuthModules(componentSources: readonly { code: string }[]): string[] {
  const reachable = new Set<string>();
  const queue = componentSources.flatMap(({ code }) =>
    extractImports(code, COMPONENT_LIB_AUTH_IMPORT),
  );

  while (queue.length > 0) {
    const name = queue.pop();
    if (name === undefined || reachable.has(name)) continue;
    const source = readFileSync(new URL(name, LIB_AUTH_DIR), "utf8");
    if (isServerOnlyGuarded(source)) continue; // cannot enter a client bundle — chain stops
    reachable.add(name);
    queue.push(...extractImports(source, LIB_AUTH_SIBLING_IMPORT));
  }
  return [...reachable].sort();
}

const COMPONENT_FILES = componentFiles();
const LIB_FILES = reachableLibAuthModules(COMPONENT_FILES);

function libFiles(): { path: string; code: string }[] {
  return LIB_FILES.map((name) => {
    const url = fileURLToPath(new URL(name, LIB_AUTH_DIR));
    return { path: `lib/auth/${name}`, code: stripComments(readFileSync(url, "utf8")) };
  });
}

const FILES = [...COMPONENT_FILES, ...libFiles()];

const FORBIDDEN: readonly RegExp[] = [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /\bcaches\b/,
];

describe("no browser storage under the auth surface (gate G5)", () => {
  it("scans a non-empty, real file set", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it("positive control — the scan actually reads code, not an empty string", () => {
    // At least one scanned file genuinely contains `useState`, so an empty match on the
    // FORBIDDEN patterns below is proof of absence rather than proof of a broken read.
    expect(FILES.some(({ code }) => /\buseState\b/.test(code))).toBe(true);
  });

  it.each(FILES.map(({ path }) => path))("%s references no browser storage API", (path) => {
    const file = FILES.find((entry) => entry.path === path);
    if (!file) throw new Error(`missing scanned file: ${path}`);
    for (const pattern of FORBIDDEN) {
      expect(file.code, `${path} matched ${pattern}`).not.toMatch(pattern);
    }
  });
});

describe("LIB_FILES — derived from the import graph (review TEST85-M1/C3)", () => {
  it("rediscovers PR-1's known four modules", () => {
    expect(LIB_FILES).toEqual(
      expect.arrayContaining([
        "submit.client.ts",
        "form-rules.ts",
        "error-messages.ts",
        "redirect.ts",
      ]),
    );
  });

  it("picks up profile-labels.ts — a real PR-2 addition, not a fixture", () => {
    // `register-form.tsx` imports `@/lib/auth/profile-labels`, so the walk MUST find it
    // without a single hand edit to this file. If this fails, the derivation stopped
    // running and PR-2's own new module is the proof.
    expect(LIB_FILES).toContain("profile-labels.ts");
  });

  it("never includes a server-only module (cookies.ts, session.ts, transport.server.ts)", () => {
    expect(LIB_FILES).not.toContain("cookies.ts");
    expect(LIB_FILES).not.toContain("session.ts");
    expect(LIB_FILES).not.toContain("transport.server.ts");
  });

  it("never includes auth-metadata.ts (real, but never imported by a component)", () => {
    // Negative-result honesty (`ATLAS.md`'s claim-discipline "differently-named form" check):
    // `auth-metadata.ts` carries no `server-only` guard, so its absence here is proof the
    // walk starts from components (page.tsx server shells import it, not the islands) —
    // not proof the guard-exclusion branch is doing the work.
    expect(LIB_FILES).not.toContain("auth-metadata.ts");
  });
});
