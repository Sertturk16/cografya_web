import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { repoRoot, closureFrom } from "@/lib/test-support/import-closure";

/**
 * A GATED CONTROL AND THE DIALOG IT OPENS MUST SHARE A RENDER TREE.
 *
 * ## The regression this closes (T-057)
 *
 * `requestAuth()` writes to a module singleton in `lib/auth/auth-modal.client.ts`. That store
 * holds no callbacks and opens nothing by itself; the ONLY component that subscribes to it and
 * renders a dialog is `components/v2/v2-auth-dialog.tsx`. Before this test, that component was
 * mounted in exactly one place — `app/[locale]/(site)/layout.tsx` — while
 * `components/v2/v2-game-screen.tsx` and `components/v2/v2-leaderboard-modal.tsx`, both of
 * which call `requestAuth("gameRound")`, render only under the sibling `(play)` group. A guest
 * pressing the primary button on all three fullscreen game screens got NOTHING: no dialog, no
 * error, no console trace. The store commit succeeded and no mounted component was listening.
 *
 * The cause was not a forgotten import. It was a written and wrong assumption, in the comment
 * that justified the single mount: "It does not belong in the root layout, because the play
 * screens have no auth affordances to open it from." They have two.
 *
 * ## Why this is a closure walk and not a grep
 *
 * The defect is invisible in any single file. `v2-game-screen.tsx` is correct on its own — it
 * imports `requestAuth`, calls it, and keeps its own `requestId` for the resume, exactly as
 * `lib/auth/auth-modal.client.ts`'s docblock prescribes. `(play)/layout.tsx` is correct on its
 * own — it is a deliberately bare fullscreen shell. The bug lives only in the relationship
 * between them, several import hops apart: the screen reaches `requestAuth`, and the tree that
 * renders the screen does not reach `v2-auth-dialog.tsx`. Nothing short of the real module
 * graph can see that, which is why this reuses `closureFrom` rather than scanning source text.
 *
 * ## What a green run proves, and what it does not
 *
 * Green means: for every render tree Next.js compiles, if some file in that tree's import
 * closure calls `requestAuth`, then `v2-auth-dialog.tsx` is in the same closure. That is a
 * MOUNT-REACHABILITY claim and nothing more. It does not prove the dialog actually opens: the
 * component could early-return null, the store could be committed to twice, the dialog could
 * render behind a stacking context. Vitest runs in `node` with no jsdom (`vitest.config.ts`),
 * so this file cannot press a button. The behavioural half was verified in a browser, as a
 * guest, on all three play screens.
 *
 * It is also tree-granular, not caller-granular in its GUARANTEE: it proves the dialog is
 * reachable from the same roots the caller is, not that the caller sits inside the dialog's
 * React subtree. Those differ only if a layout imports the dialog without rendering it, which
 * would be a strange thing to write and is not worth a JSX scan to exclude.
 */

/** The component that subscribes to the modal store and renders the dialog. */
const DIALOG = "components/v2/v2-auth-dialog.tsx";

/** The module that owns `requestAuth`. It defines the function; it is never a caller. */
const AUTH_STORE = "lib/auth/auth-modal.client.ts";

/**
 * Next.js renders every page under `app/[locale]/<dir>` through the root layout AND that
 * directory's own layout, so a render tree is the pair, not the group alone — mounting the
 * dialog in the root layout has to count for `(play)`.
 *
 * Discovered from disk rather than listed, so a FOURTH route group added tomorrow is audited
 * the day it appears. A hardcoded list is the same class of mistake as the single mount this
 * test exists to prevent: correct when written, silently incomplete afterwards.
 */
const ROOT_LAYOUT = "app/[locale]/layout.tsx";

function renderTrees(): Array<{ name: string; roots: string[] }> {
  return readdirSync(join(repoRoot, "app/[locale]"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      roots: [ROOT_LAYOUT, join("app/[locale]", entry.name)],
    }));
}

/**
 * A caller both IMPORTS `requestAuth` from the store and invokes it. The import clause is what
 * keeps this from firing on an unrelated local identifier; the invocation is what keeps it from
 * firing on `v2-auth-dialog.tsx` itself, which imports four other members of the same module
 * and no `requestAuth`.
 */
function callsRequestAuth(file: string): boolean {
  if (relative(repoRoot, file) === AUTH_STORE) return false;
  const source = stripComments(readFileSync(file, "utf8"));
  if (!/from\s+["']@\/lib\/auth\/auth-modal\.client["']/.test(source)) return false;
  return /\brequestAuth\s*\(/.test(source);
}

const rel = (file: string) => relative(repoRoot, file);

describe("the reachability scanner itself", () => {
  it("the dialog and the store both exist where this test looks for them", () => {
    expect(existsSync(join(repoRoot, DIALOG)), `${DIALOG} moved -- update DIALOG`).toBe(true);
    expect(existsSync(join(repoRoot, AUTH_STORE)), `${AUTH_STORE} moved`).toBe(true);
    expect(existsSync(join(repoRoot, ROOT_LAYOUT)), `${ROOT_LAYOUT} moved`).toBe(true);
  });

  it("found the route groups on disk, not from a list in this file", () => {
    expect(
      renderTrees()
        .map((tree) => tree.name)
        .sort(),
    ).toEqual(["(play)", "(site)", "design-system"]);
  });

  it("every render tree walks a real, non-trivial slice of the surface", () => {
    for (const tree of renderTrees()) {
      expect(closureFrom(tree.roots).size, `${tree.name} closure collapsed`).toBeGreaterThan(20);
    }
  });

  it("recognizes a real caller -- positive control", () => {
    expect(callsRequestAuth(join(repoRoot, "components/v2/v2-game-screen.tsx"))).toBe(true);
    expect(callsRequestAuth(join(repoRoot, "components/v2/v2-header.tsx"))).toBe(true);
  });

  it("the dialog imports the store but is not itself a caller -- negative control", () => {
    const source = readFileSync(join(repoRoot, DIALOG), "utf8");
    expect(source).toContain("@/lib/auth/auth-modal.client");
    expect(callsRequestAuth(join(repoRoot, DIALOG))).toBe(false);
  });

  it("the store that defines requestAuth is not counted as a caller", () => {
    expect(callsRequestAuth(join(repoRoot, AUTH_STORE))).toBe(false);
  });

  it("the surface still has callers at all -- anti-vacuity floor", () => {
    const callers = [...closureFrom([ROOT_LAYOUT, "app/[locale]/(site)", "app/[locale]/(play)"])]
      .filter(callsRequestAuth)
      .map(rel)
      .sort();

    // Not a count: the seven gated surfaces by name. A caller leaving this list is a real
    // product change and should be read, not silently absorbed by a `>= n` threshold.
    expect(callers).toEqual([
      "components/book/video-bench.tsx",
      "components/v2/v2-favorite-button.tsx",
      "components/v2/v2-game-history-stats.tsx",
      "components/v2/v2-game-screen.tsx",
      "components/v2/v2-header.tsx",
      "components/v2/v2-leaderboard-modal.tsx",
      "components/v2/v2-tool-workbench.tsx",
    ]);
  });
});

describe("every gated control renders under a tree that mounts the auth dialog", () => {
  it.each(renderTrees())("$name", ({ name, roots }) => {
    const closure = closureFrom(roots);
    const callers = [...closure].filter(callsRequestAuth).map(rel).sort();
    if (callers.length === 0) return;

    expect(
      [...closure].map(rel).includes(DIALOG),
      `${name} renders ${callers.length} component(s) that call requestAuth() -- ` +
        `${callers.join(", ")} -- but nothing in its render tree mounts ${DIALOG}, so every ` +
        `one of those calls writes to the store and opens nothing. Mount the dialog in a ` +
        `layout this tree passes through.`,
    ).toBe(true);
  });
});
