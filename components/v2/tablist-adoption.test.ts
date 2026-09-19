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
 * about the two `viewMode` switchers: they never carried tab semantics at all, so they are
 * invisible to the two scans on purpose, and staying invisible would be silent regression, not
 * success. The positive counterpart — "these two files DID adopt `Tabs`" — is the third describe
 * block below, in the shape `v2-member-hub.test.ts` uses for the hub.
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
    // pass for free by finding nothing left to fail on. The floor sits just under today's 47
    // rather than far below it: a walk that quietly lost a third of the directory is already a
    // broken walk, and a floor loose enough to survive that launders silence into the two
    // assertions above. Raise it with the directory when a handful of files are added.
    const found = sources(ROOT);
    expect(found.length).toBeGreaterThan(40);
    // A floor alone still passes for a walk that silently lost a third of the directory, so
    // name a file too: `unnamed-icon-button.test.ts` does the same. This one is here because
    // it is one of the two explorers the third block below asserts against, so a walk that
    // stops reaching it makes THAT block's premise false as well.
    expect(found.some((file) => file.endsWith("v2-turkey-map-explorer.tsx"))).toBe(true);
  });
});

describe("the two viewMode switchers adopted the shared Tabs primitive", () => {
  // The counterpart to the two scans above, which are negative by construction and would stay
  // green if either explorer went back to `<button onClick={() => setViewMode(...)}>` — a plain
  // button writes no `role="tab"` for them to find, which is the original defect exactly.
  const explorers = ["v2-turkey-map-explorer.tsx", "v2-world-map-explorer.tsx"] as const;

  for (const file of explorers) {
    it(`${file} renders its view switcher through components/ui/tabs.tsx`, () => {
      const source = stripComments(readFileSync(join(ROOT, file), "utf8"));
      expect(source, `${file} no longer imports the shared Tabs primitive`).toContain(
        'from "@/components/ui/tabs"',
      );
      expect(source, `${file} no longer renders a TabsList`).toContain("<TabsList");
      expect(source, `${file} no longer renders a TabsTrigger`).toContain("<TabsTrigger");
    });
  }
});

describe("components/ui/tabs.tsx keeps automatic activation", () => {
  const primitive = readFileSync(new URL("../ui/tabs.tsx", import.meta.url), "utf8");

  it("TabsList defaults activateOnFocus to true, against Base UI's false", () => {
    // The whole keyboard argument for this conversion rests on this one value: with Base UI's
    // `false`, Left/Right moves focus while the selection and the panel stay put until a
    // separate Enter, which is the defect the conversion exists to fix. It lives in a defaulted
    // destructure, so an ordinary `{ className, ...props }` tidy-up would delete it in silence
    // and nothing else in the suite would notice.
    expect(stripComments(primitive)).toMatch(/activateOnFocus\s*=\s*true/);
  });
});
