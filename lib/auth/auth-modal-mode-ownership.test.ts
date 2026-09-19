import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { repoRoot, walk } from "@/lib/test-support/import-closure";

/**
 * THE MODE SETTER BELONGS TO THE OPEN DIALOG, AND TO NOTHING ELSE.
 *
 * ## The regression this closes (T-059)
 *
 * `setAuthModalMode` and `requestAuth` write the same field, and only one ordering worked:
 * `requestAuth` committed `mode: "register"` unconditionally, so a `setMode` written BEFORE it
 * was erased and a `setMode` written after it survived. Both readings look right. The header
 * wrote all four of its call sites by hand and got two of them backwards, so the mobile menu's
 * "Giris Yap" opened the register tab on every page of the site, for as long as it had existed.
 *
 * T-059 made the mode an argument to `requestAuth`, which is what removes the ordering: a caller
 * that wants a mode now says so in the same call. This test removes the temptation to pair them
 * again. `setMode` still exists, because the dialog's own tab strip and its two
 * "switch to login / switch to register" links legitimately change the mode of an ALREADY OPEN
 * dialog -- that is a different operation from opening one, and it is the only one left.
 *
 * ## Why an importer scan and not an ordering scan
 *
 * The obvious guard is "no file calls setAuthModalMode before requestAuth". That needs statement
 * order inside a callback, and it would still pass a file that paired them correctly today and
 * was edited tomorrow. Ownership is the stronger and simpler claim: if the setter has exactly one
 * importer, the ordering bug has nowhere to live.
 *
 * ## What a green run proves, and what it does not
 *
 * Green means no file outside {@link OWNER} names `setAuthModalMode` in its source. It does not
 * prove the dialog uses it correctly, and it does not stop a file from reaching `setMode` through
 * `createAuthModalStore()` -- that factory is exported for the unit tests, and a component that
 * built its own store instance would be broken in a much louder way (its dialog would subscribe
 * to a different store and never open at all).
 */

/** The one component allowed to change the mode of an already-open dialog. */
const OWNER = "components/v2/v2-auth-dialog.tsx";

/** The module that exports the setter, and the spec that exercises it. */
const EXEMPT = new Set([OWNER, "lib/auth/auth-modal.client.ts"]);

const SCAN_ROOTS = ["components", "app", "lib"] as const;

function sourcesNaming(symbol: string): string[] {
  return SCAN_ROOTS.flatMap((root) => walk(`${repoRoot}${root}`))
    .filter((file) => !file.includes(".test."))
    .filter((file) => stripComments(readFileSync(file, "utf8")).includes(symbol))
    .map((file) => relative(repoRoot, file))
    .sort();
}

describe("setAuthModalMode has exactly one owner", () => {
  it("only the auth dialog names it", () => {
    expect(
      sourcesNaming("setAuthModalMode").filter((file) => !EXEMPT.has(file)),
      "a component outside the dialog reached for setAuthModalMode -- to open the dialog in a " +
        "chosen mode, pass the mode to requestAuth(intent, mode) instead. Pairing the two is the " +
        "T-059 ordering bug: requestAuth commits the mode, so a setMode written before it is lost.",
    ).toEqual([]);
  });

  it("the owner really does name it -- anti-vacuity, the scan reaches live source", () => {
    expect(sourcesNaming("setAuthModalMode")).toContain(OWNER);
  });

  it("the scan reaches a broad slice of the surface -- anti-vacuity", () => {
    expect(sourcesNaming("requestAuth").length).toBeGreaterThan(5);
  });
});
