import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * G5 (plan §9, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`): no
 * source under `components/auth/**` or `lib/auth/{submit.client,form-rules,profile-labels}.ts`
 * references `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` or `caches` —
 * the mechanism behind the acceptance line "no token and no PII in browser storage" (plan
 * §12 #2). `profile-labels.ts` lands in PR-2 with the register form and is added to
 * `LIB_FILES` in that PR, not scanned here as a not-yet-existing path.
 *
 * Comments are stripped before matching (the `nav-disclosure.test.ts` pattern): this file's
 * own docblock and `submit.client.ts`'s own docblock both name the banned tokens in PROSE,
 * which must not self-trigger the scan.
 */

const COMPONENT_DIR = new URL("./", import.meta.url);
const SELF = "no-browser-storage.test.ts";

const LIB_FILES = ["submit.client.ts", "form-rules.ts"] as const;

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

function libFiles(): { path: string; code: string }[] {
  return LIB_FILES.map((name) => {
    const url = fileURLToPath(new URL(`../../lib/auth/${name}`, import.meta.url));
    return { path: `lib/auth/${name}`, code: stripComments(readFileSync(url, "utf8")) };
  });
}

const FILES = [...componentFiles(), ...libFiles()];

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
