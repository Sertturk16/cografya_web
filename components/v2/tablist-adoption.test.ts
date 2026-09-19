import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * NOBODY BUILDS A TABLIST BY HAND.
 *
 * Vitest runs node with no jsdom, so this cannot press a key. It does not need to: the defect
 * is not a subtle interaction bug, it is four widgets that never had a key handler. ARIA APG
 * requires Left/Right to move between tabs; `v2-auth-dialog` and `v2-member-hub` set every
 * role and every aria-* correctly and carry `onKeyDown: 0`, so a keyboard user reaches the
 * widget and cannot move inside it. `components/ui/tabs.tsx` wraps Base UI's Tabs, which
 * brings the roving tabindex, the arrow keys, Home/End and the activation mode with it.
 *
 * A structural assertion, in the shape `css-module-dark-safety.test.ts` uses: the thing to
 * prevent is the hand-rolled widget coming back, and that is visible in the source.
 *
 * ## What a green run proves, and what it does not
 *
 * Green means no file under `components/v2` writes the literal strings `role="tablist"` or
 * `role="tab"` itself. It says nothing about whether a widget that DOES adopt `components/ui/tabs.tsx`
 * gets Left/Right, Home/End or the roving tabindex right — this file cannot render anything, let
 * alone dispatch a keydown, so that guarantee has to come from `components/ui/tabs.tsx`'s own
 * behaviour (inherited from Base UI) rather than from a test in this file. It also says nothing
 * about the two `viewMode` switchers below: they carry no tab semantics at all today, so they are
 * invisible to this scan on purpose, and staying invisible after Task 15 would be silent
 * regression, not success — the follow-up guard for "adopted `Tabs`" belongs to Task 15, not here.
 *
 * ## The discovery blind spot
 *
 * This walk finds offenders by a literal substring match on `role="tablist"` / `role="tab"`.
 * That catches exactly the shape `v2-auth-dialog.tsx` and `v2-member-hub.tsx` use today — the
 * string written directly in JSX — and nothing else. A tablist assembled through a variable
 * (`const tabRole = "tablist"; <div role={tabRole}>`), a `clsx`/template-built value, or a
 * wrapper component that sets the role one level down (`<RoleDiv as="tablist">`) would compile,
 * render and fail every accessibility requirement this file is meant to guard, and this scan
 * would never see it — the substring simply is not there. The anti-vacuity floor below does not
 * help either: it only proves the walk still reaches real files, not that the walk's matching
 * strategy is complete. Closing that gap needs a rule that understands JSX attribute values, not
 * a grep; nothing in this task builds one.
 */
const ROOT = fileURLToPath(new URL(".", import.meta.url));

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [path] : [];
  });

describe("tab widgets come from components/ui/tabs.tsx", () => {
  it('no component under components/v2 writes role="tablist" itself', () => {
    const offenders = sources(ROOT).filter((file) =>
      stripComments(readFileSync(file, "utf8")).includes('role="tablist"'),
    );
    expect(
      offenders.map((f) => f.slice(ROOT.length)),
      "a hand-rolled tablist returned under components/v2 -- adopt components/ui/tabs.tsx instead",
    ).toEqual([]);
  });

  it('no component under components/v2 writes role="tab" itself', () => {
    const offenders = sources(ROOT).filter((file) =>
      /role="tab"/.test(stripComments(readFileSync(file, "utf8"))),
    );
    expect(
      offenders.map((f) => f.slice(ROOT.length)),
      "a hand-rolled tab returned under components/v2 -- adopt components/ui/tabs.tsx instead",
    ).toEqual([]);
  });

  it("the walk covers a real population of components/v2 sources -- anti-vacuity", () => {
    // A broken walk -- a wrong ROOT, an extension filter that excludes every file, or a
    // `.test.` exclusion that swallows real components too -- would make both assertions above
    // pass for free by finding nothing left to fail on. The floor is set well below today's
    // count (comfortably in the dozens) so ordinary file churn does not make this brittle, and
    // well above what an empty or accidentally-narrow walk could produce by accident, so a walk
    // that stops working fails here first and loudly rather than laundering silence into the
    // two assertions above.
    const found = sources(ROOT);
    expect(found.length).toBeGreaterThan(30);
  });
});
