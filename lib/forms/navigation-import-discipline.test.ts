import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { label, readSource, repoRoot } from "@/lib/test-support/composition-scan";

/**
 * Who may reach around `i18n/navigation.ts`, and why (T-062).
 *
 * `CLAUDE.md` has always said to import `Link`, `redirect`, `usePathname`, `useRouter` and
 * `getPathname` from `@/i18n/navigation` and never from `next/link` or `next/navigation`. Nothing
 * held the line, and when the unsaved-changes guard went into that module the rule stopped being
 * about locale prefixes alone: every raw `useRouter` is now also a navigation the guard does not
 * see. So the exceptions are recorded, each with its reason, rather than left to whoever reads
 * the hard rule next.
 *
 * TWO RULES, and the second one is the one with teeth:
 *
 *  1. `i18n/navigation-primitives.ts` exists only so the guard can wrap next-intl's own `Link`
 *     and `useRouter` without importing the module that re-exports the wrappers. Exactly two
 *     files may import it. A third would be a surface quietly using the unwrapped primitives.
 *  2. `useRouter` from `next/navigation` is allowed in the files listed below and nowhere else.
 *     Every entry pushes a path that is ALREADY locale-resolved — next-intl's router would
 *     prefix it a second time and send an `/en` reader to `/en/en/…`.
 *
 * `next/link` needs no list: nothing in the tree imports it, and the check below keeps that true.
 */

/**
 * A local walk, and not `composition-scan.ts`'s: that one returns `.tsx` only, by design — it
 * scans JSX. The module this file polices, `i18n/navigation.ts`, is a `.ts`, and so is half of
 * what imports it.
 */
const walkTs = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkTs(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
  });

const files = ["app", "components", "lib", "i18n"].flatMap((dir) => walkTs(join(repoRoot, dir)));

const importersOf = (specifier: string): string[] =>
  files
    .filter((file) => {
      const source = readSource(file);
      return new RegExp(`from\\s*["']${specifier}["']`).test(source);
    })
    .map(label)
    .sort();

/** Files allowed to take `useRouter` from `next/navigation`, each for a stated reason. */
const RAW_ROUTER_CALLERS: readonly string[] = [
  // `router.replace()` receives the BFF's own `safeReturnPath()` output — a final path with its
  // locale prefix already resolved. The file records this itself.
  "components/v2/v2-login-card.tsx",
  "components/v2/v2-verify-email-card.tsx",
  // Same shape: `result.redirectTo` comes back from the register BFF already resolved.
  "components/v2/v2-register-card.tsx",
  // The dialog re-issues `pendingPath`, which is what an `<a>` resolved to or what `getPathname`
  // produced — resolved by construction. See the file's docblock.
  "components/v2/v2-unsaved-changes-dialog.tsx",
];

describe("navigation import discipline", () => {
  it("keeps the raw primitives behind exactly two doors", () => {
    expect(
      importersOf("@/i18n/navigation-primitives")
        .concat(importersOf("./navigation-primitives"))
        .sort(),
    ).toEqual(["i18n/guarded-navigation.client.tsx", "i18n/navigation.ts"]);
  });

  it("allows next/navigation's useRouter only where a resolved path is being pushed", () => {
    const callers = files
      .filter((file) =>
        /import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*["']next\/navigation["']/.test(
          readSource(file),
        ),
      )
      .map(label)
      .sort();

    expect(callers).toEqual([...RAW_ROUTER_CALLERS].sort());
  });

  it("nothing imports next/link", () => {
    expect(importersOf("next/link")).toEqual([]);
  });

  /**
   * Anti-vacuity. A typo in the specifier above would make every assertion pass against an empty
   * list, which is the failure mode a recorded population is least able to notice.
   */
  it("finds the module's real consumers", () => {
    expect(importersOf("@/i18n/navigation").length).toBeGreaterThan(30);
    expect(files.length).toBeGreaterThan(250);
  });

  it("the guard is what i18n/navigation exports as Link and useRouter", () => {
    const source = readSource(join(repoRoot, "i18n/navigation.ts"));
    expect(source).toMatch(
      /export\s*\{\s*Link,\s*useRouter\s*\}\s*from\s*["']@\/i18n\/guarded-navigation\.client["']/,
    );
    // `redirect` is a server API and `getPathname` navigates nothing, so neither is wrapped —
    // stated here so a future wrap of them is a deliberate edit to this file too.
    expect(source).toMatch(/export\s*\{\s*redirect,\s*usePathname,\s*getPathname\s*\}/);
  });
});
