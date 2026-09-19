# T-053: the `:focus-visible` rule joins `@layer base`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `outline-none` mean what it says, stop every focused element losing its corner radius, and replace the cascade guarantee that protected the focus ring with a test that protects it better.

**Architecture:** `app/globals.css`'s `:focus-visible` rule and its `:where([tabindex="-1"])` companion sit outside every `@layer`. An unlayered rule beats every rule in `@layer utilities` whatever its specificity, so the 26 `outline-none` class strings in this repo are inert and every focused element additionally receives `border-radius: 4px`. Moving both rules into `@layer base` fixes both symptoms at once. That move is the one T-041 explicitly refused, so the plan pays T-041's price up front: the two sites that would be left with no indicator are fixed **before** the move, and a named-exemption guard takes over the job the cascade was doing.

**Tech Stack:** Tailwind v4 (CSS-first, cascade layers), vitest (node env, no jsdom), Playwright MCP for the measured half.

**Spec:** `TASKS.md` → T-053. This plan supersedes that entry's "systemik düzeltme tek satır" scoping, which did not know about the T-041 exemption or the two uncovered sites.

## Global Constraints

- `docs/design.md` is the authority on the focus indicator and says: _"Focus visible everywhere: `:focus-visible` = 3px `var(--ring)` outline, 2px offset."_ No new focus token, colour or ring style is invented by this plan. A site that loses `outline-none` falls back to that documented indicator, which is the whole point.
- `docs/design.md` §5: never remove focus without a compliant replacement.
- Never hand-edit generated files. None are involved.
- Commit style: Conventional Commits (commitlint hook). `pnpm typecheck && pnpm lint && pnpm test` is the gate before every commit.
- Work on `fix/t-053-focus-visible-layer`, branched from `dev`.

---

## The measurement this plan rests on

26 `outline-none` class strings across 14 files, classified by reading each one and its element's full class chain:

| Group                                                                                                                                                                                                                                                                                                                                                                | Count | After the move                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| Declares its own `focus-visible:` replacement on the same element — `ui/button.tsx:7`, `ui/input.tsx:6` (+ variants at `:16`/`:18`), `ui/select.tsx:7` (+ `:17`/`:19`), `ui/custom-select.tsx:182`, `ui/tabs.tsx:82`, `v2-header.tsx:159/258/323`, `v2-profile-form.tsx:211`, `v2-register-card.tsx:551/577`, `v2-game-screen.tsx:1176/1278`, the four map explorers | 17    | Works **as written** for the first time                             |
| Parent owns the ring — `v2-hero.tsx:351` (container has `focus-within:ring-4`), `search-combobox.tsx:192` `INPUT` (row has `has-[input:focus]:outline-3`, documented at `:176-189`)                                                                                                                                                                                  | 2     | Unchanged; the `!` on `INPUT` becomes unnecessary but stays correct |
| DOM focus never lands here — `ui/dialog.tsx:40` (panel, focused programmatically on open, same class as the existing `:where([tabindex="-1"])` exemption), `ui/custom-select.tsx:260` (listbox options driven by `aria-activedescendant`; focus stays on the input)                                                                                                  | 2     | Correct, needs an exemption entry                                   |
| **Left with no indicator at all** — `ui/tabs.tsx:68` (`TabsTrigger`: neither `triggerVariants.pills` nor `.line` carries a focus style, only `aria-selected:`) and `search-combobox.tsx:640` (the v2 command-dialog input; its row has no `focus-within`)                                                                                                            | **2** | **Must be fixed before the move**                                   |

`ui/tabs.tsx:68` is the serious one: it is every tab strip on the site, including the auth dialog and the `/hesabim` member hub. Today it draws the global outline by accident. That accident is exactly what T-041 was protecting, and it is why the fix lands first.

## File Structure

| File                                         | Responsibility     | Change                                                                                                     |
| -------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `components/ui/tabs.tsx`                     | tab primitive      | Drop the inert `outline-none` from `TabsTrigger`'s base string so the documented global indicator applies  |
| `components/site-search/search-combobox.tsx` | site search        | Drop the inert `outline-none` from the v2 dialog input, same reason                                        |
| `components/ui/focus-suppression.test.ts`    | **new** guard      | `outline-none` is only allowed beside a replacement or on a named, reasoned exemption                      |
| `app/globals.css`                            | token + base layer | Move `:focus-visible` and `:where([tabindex="-1"]):focus-visible` into the existing `@layer base` block    |
| `components/globals-unlayered-css.test.ts`   | unlayered tripwire | Drop the two exemptions the move retires; its own failure message already instructs this                   |
| `docs/design.md`                             | design authority   | Record that the indicator is now a **default a component may replace**, not an override nothing can escape |

---

### Task 1: The two uncovered sites take the documented indicator

Done first so the tree never passes through a state where a control has no visible focus.

**Files:**

- Modify: `components/ui/tabs.tsx:68`
- Modify: `components/site-search/search-combobox.tsx:640`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing importable. Later tasks rely only on the absence of the string `outline-none` at these two sites.

- [ ] **Step 1: Read both sites and confirm the class strings still match**

```bash
sed -n '66,72p' components/ui/tabs.tsx
sed -n '638,642p' components/site-search/search-combobox.tsx
```

Expected: `tabs.tsx` base string contains `transition-all duration-150 outline-none cursor-pointer`; `search-combobox.tsx` contains `placeholder:text-muted-foreground outline-none border-none`.

- [ ] **Step 2: Remove `outline-none` from `TabsTrigger`**

In `components/ui/tabs.tsx`, the `TabsTrigger` base string changes from:

```
"inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-150 outline-none cursor-pointer hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
```

to:

```
"inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-150 cursor-pointer hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
```

Add this comment directly above the base string:

```tsx
// No `outline-none`: neither triggerVariant carries a focus style, so suppressing the
// outline would leave a tab with no visible focus at all once T-053 moved
// `:focus-visible` into `@layer base` and the suppression started working. The site's
// documented indicator (`docs/design.md`: 3px `var(--ring)`, 2px offset) is the right
// one here — a tab strip has no ring of its own to compete with it.
```

- [ ] **Step 3: Remove `outline-none` from the v2 command-dialog input**

In `components/site-search/search-combobox.tsx`, line 640's `className` changes from:

```
"w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none border-none"
```

to:

```
"w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground border-none"
```

The `INPUT` constant at `:190-192` is a **different** element (the `variant="default"` branch) and is NOT touched: its row genuinely owns the ring via `has-[input:focus]:outline-3`, and its docblock at `:176-189` records the measurement.

- [ ] **Step 4: Confirm nothing regressed**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. No behaviour changes yet — `outline-none` is inert until Task 3, so these two removals are no-ops today and only take effect after the move.

- [ ] **Step 5: Commit**

```bash
git add components/ui/tabs.tsx components/site-search/search-combobox.tsx
git commit -m "fix(a11y): drop the two outline-none suppressions with no replacement"
```

---

### Task 2: A guard so a suppression cannot ship without a replacement

This is what takes over from the cascade. Write it before the move, so it is already standing when the move makes suppressions real.

**Files:**

- Create: `components/ui/focus-suppression.test.ts`

**Interfaces:**

- Consumes: `repoRoot`, `walk` from `@/lib/test-support/import-closure`; `stripComments` from `@/lib/test-support/strip-comments`.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing test**

Create `components/ui/focus-suppression.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { repoRoot, walk } from "@/lib/test-support/import-closure";

/**
 * A SUPPRESSED OUTLINE MUST BE REPLACED, NOT JUST REMOVED.
 *
 * ## What changed under this test (T-053)
 *
 * `app/globals.css`'s `:focus-visible` used to sit outside every `@layer`, which in CSS beats
 * every rule in `@layer utilities` regardless of specificity. Every `outline-none` in this repo
 * was therefore inert: a component that asked for its own ring got BOTH (its ring and the global
 * teal outline, concentric), and every focused element also inherited the rule's
 * `border-radius: 4px` -- `site-search`'s trigger measured `rounded-lg` 10px unfocused and 4px
 * focused. T-041 knew the rule was unlayered and exempted it deliberately, reasoning that a layer
 * "would let ANY component utility silently defeat the site's one guaranteed keyboard-focus
 * ring". That reasoning was right about the risk and wrong about the remedy: the guarantee it
 * bought was a guarantee of the WRONG rendering, and this file is the remedy that costs nothing.
 *
 * ## The rule
 *
 * A file may suppress the outline only where the same element gets a visible focus treatment
 * from somewhere. "Somewhere" is deliberately loose -- a sibling variant string, a parent's
 * `focus-within`, a `has-[input:focus]` row -- because the honest unit is the rendered element
 * and a source scan cannot see one. So the check is per FILE, not per class string: a file that
 * writes `outline-none` must also write a focus treatment, or name itself in {@link EXEMPTIONS}
 * with a reason a reader can check.
 *
 * ## What a green run proves, and what it does not
 *
 * Green means no file suppresses the outline with no focus treatment anywhere in it and no
 * recorded reason. It does NOT prove the treatment lands on the same element as the suppression,
 * and it cannot: that is a rendered-geometry question, and this repo has already learned twice
 * (T-046, T-047) that a source scanner cannot answer one. The browser round in this task's plan
 * is what covers that, and `components/ui/token-binding.test.ts` is the precedent for pairing a
 * source rule with a named exemption list rather than pretending the scan is complete.
 */

/** Tailwind's own suppression spellings, including the `!` important form. */
const SUPPRESSIONS = ["outline-none", "outline-none!"] as const;

/**
 * Anything that makes focus visible. `focus:` as well as `focus-visible:` because
 * `ui/custom-select.tsx` uses the former; `focus-within:` and `has-[input:focus]:` because a row
 * owning its input's ring is this repo's documented pattern (`search-combobox.tsx:176-189`).
 */
const TREATMENT =
  /(focus-visible:|focus:|focus-within:|has-\[input:focus\]:)(ring|outline-(?!none)|border|stroke|scale|bg|shadow|text)/;

interface Exemption {
  readonly file: string;
  readonly reason: string;
}

/**
 * A file allowed to suppress with no treatment of its own. Each entry names WHY focus is still
 * visible, or why DOM focus never lands on the suppressed element.
 */
const EXEMPTIONS: readonly Exemption[] = [
  {
    file: "components/ui/dialog.tsx",
    reason:
      "The suppression is on the dialog PANEL, which Base UI focuses programmatically when it " +
      "opens. Tab never lands there, so a ring could not tell a keyboard user 'you are here'; " +
      "it would draw a box around a page-sized region. Exactly the case globals.css already " +
      'sanctions for `:where([tabindex="-1"]):focus-visible`, with the same reasoning.',
  },
  {
    file: "components/v2/v2-hero.tsx",
    reason:
      "The suppressed element is the omni-search input, whose wrapper carries " +
      "`focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10`. The row " +
      "owns the ring so the input does not draw a second one inside it.",
  },
];

const EXEMPT_FILES = new Set(EXEMPTIONS.map((e) => e.file));

const SCAN_ROOTS = ["components", "app"] as const;

function productSources(): string[] {
  return SCAN_ROOTS.flatMap((root) => walk(`${repoRoot}${root}`)).filter(
    (file) => !file.includes(".test."),
  );
}

function suppresses(source: string): boolean {
  return SUPPRESSIONS.some((token) =>
    new RegExp(`\\b${token.replace("!", "!")}(?![\\w-])`).test(source),
  );
}

describe("every outline suppression has a replacement", () => {
  it("no file suppresses the focus outline without also making focus visible", () => {
    const offenders = productSources()
      .map((file) => ({ file, source: stripComments(readFileSync(file, "utf8")) }))
      .filter(({ source }) => suppresses(source))
      .filter(({ source }) => !TREATMENT.test(source))
      .map(({ file }) => relative(repoRoot, file))
      .filter((file) => !EXEMPT_FILES.has(file))
      .sort();

    expect(
      offenders,
      "these files remove the focus outline and put nothing visible in its place. Since T-053 " +
        "moved `:focus-visible` into `@layer base`, `outline-none` actually works -- so this is " +
        "a control a keyboard user cannot see. Either drop the suppression and take the site " +
        "default (3px var(--ring), docs/design.md), or add a focus treatment, or add an " +
        "exemption here saying why focus is still visible.",
    ).toEqual([]);
  });
});

describe("the scanner itself", () => {
  it("reaches a real, non-trivial slice of the surface -- anti-vacuity", () => {
    expect(productSources().length).toBeGreaterThan(100);
  });

  it("still finds suppressions on the live tree -- anti-vacuity", () => {
    const suppressing = productSources().filter((file) =>
      suppresses(stripComments(readFileSync(file, "utf8"))),
    );
    expect(suppressing.length).toBeGreaterThan(5);
  });

  it("recognises a treatment -- positive control", () => {
    expect(TREATMENT.test('className="outline-none focus-visible:ring-2"')).toBe(true);
    expect(TREATMENT.test('className="outline-none focus-within:ring-4"')).toBe(true);
    expect(TREATMENT.test('className="outline-none focus:border-primary"')).toBe(true);
  });

  it("does not mistake the suppression itself for a treatment -- negative control", () => {
    expect(TREATMENT.test('className="focus-visible:outline-none"')).toBe(false);
  });

  it("every exemption is still live -- a stale one hides a regression", () => {
    for (const exemption of EXEMPTIONS) {
      const source = stripComments(readFileSync(`${repoRoot}${exemption.file}`, "utf8"));
      expect(suppresses(source), `${exemption.file} no longer suppresses; drop the exemption`).toBe(
        true,
      );
    }
  });
});
```

- [ ] **Step 2: Run it and read what it reports**

Run: `pnpm vitest run components/ui/focus-suppression.test.ts`

Expected: the two anti-vacuity cases and both controls PASS. The main assertion may already pass, because Task 1 removed the only two files that had a suppression and no treatment anywhere in the file. **If it passes, prove it can fail** before moving on — that is the mutation check this repo requires of every new counter:

```bash
# temporarily put the suppression back with no treatment
sed -i 's/transition-all duration-150 cursor-pointer hover:text-foreground/transition-all duration-150 outline-none cursor-pointer hover:text-foreground/' components/ui/tabs.tsx
pnpm vitest run components/ui/focus-suppression.test.ts   # MUST be red, naming components/ui/tabs.tsx
git checkout components/ui/tabs.tsx                        # revert
pnpm vitest run components/ui/focus-suppression.test.ts   # green again
```

Record the red output verbatim in the commit body.

- [ ] **Step 3: Commit**

```bash
git add components/ui/focus-suppression.test.ts
git commit -m "test(a11y): a focus-outline suppression needs a replacement"
```

---

### Task 3: Move both rules into `@layer base`

**Files:**

- Modify: `app/globals.css:1394-1428` (the `:focus-visible` rule and its `:where([tabindex="-1"])` companion, with their comments)
- Modify: `components/globals-unlayered-css.test.ts:185-201` (drop the two exemptions)

**Interfaces:**

- Consumes: Task 1's two removals and Task 2's guard, both of which must already be committed.
- Produces: nothing importable.

- [ ] **Step 1: Watch the tripwire tell you what to do**

Run: `pnpm vitest run components/globals-unlayered-css.test.ts`
Expected: green right now. This is the baseline; the next step makes it red on purpose.

- [ ] **Step 2: Move both rules**

In `app/globals.css`, cut the `:focus-visible { … }` rule and the `:where([tabindex="-1"]):focus-visible { … }` rule — **with their full comment blocks** — from where they sit unlayered, and paste them inside the existing `@layer base { … }` block that opens at `:1276`, at the end of that block.

Replace the sentence in the `:focus-visible` comment that reasons about being unlayered with:

```
   T-053: this rule lives in `@layer base` so `outline-none` means what it says. Unlayered, it
   beat every `@layer utilities` rule regardless of specificity, which made all 26 of this
   repo's `outline-none` class strings inert -- a component that asked for its own ring got both
   rings concentrically, and `border-radius: 4px` below travelled to every focused element
   (site-search's trigger measured 10px unfocused, 4px focused). T-041 exempted the rule from
   `components/globals-unlayered-css.test.ts` on the reasoning that a layer "would let ANY
   component utility silently defeat the site's one guaranteed keyboard-focus ring". The risk was
   real and the remedy is `components/ui/focus-suppression.test.ts`, which refuses a suppression
   with no replacement -- a guarantee the cascade could only buy by rendering the wrong thing.
```

- [ ] **Step 3: Run the tripwire and watch it go red with the instruction**

Run: `pnpm vitest run components/globals-unlayered-css.test.ts`
Expected: FAIL on `every named exemption is still live > :focus-visible` with
`":focus-visible is no longer unlayered; drop the exemption"`, and the same for
`:where([tabindex="-1"]):focus-visible`.

- [ ] **Step 4: Drop the two exemptions**

Delete both entries from the `EXEMPTIONS` array in `components/globals-unlayered-css.test.ts`. Leave `UNLAYERED_CSS_RULES = 0` alone — it counts NON-exempt unlayered rules and those two rules are no longer unlayered at all, so the number does not move.

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run components/globals-unlayered-css.test.ts components/ui/focus-suppression.test.ts`
Expected: both PASS.

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. If another suite reds here, read it — it is telling you about a component whose focus rendering this move changed, which is information, not noise.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/globals-unlayered-css.test.ts
git commit -m "fix(css): move :focus-visible into @layer base so outline-none works"
```

---

### Task 4: Measure the rendering, because no test in this repo can

**Files:**

- No source changes expected. If the browser finds one, it is a real defect and gets its own commit.

**Interfaces:**

- Consumes: Tasks 1–3, committed.
- Produces: the evidence that closes T-053.

- [ ] **Step 1: Confirm the two fixed symptoms, before and after, on one control**

The container dev server on `:3000` serves this tree (see `docs/architecture.md`). Do NOT start a host `pnpm dev`.

With Playwright MCP, on `/tr`, focus the site-search trigger by keyboard and read its computed style:

```js
async (page) => {
  await page.goto("http://localhost:3000/tr");
  const el = page.getByRole("button", { name: /Aramayı aç|Ara/ }).first();
  await el.focus();
  return el.evaluate((n) => {
    const s = getComputedStyle(n);
    return { outline: s.outline, borderRadius: s.borderRadius, boxShadow: s.boxShadow };
  });
};
```

Expected AFTER this plan: `borderRadius` keeps the element's own value (it measured 4px while focused before, against `rounded-lg` 10px unfocused).

- [ ] **Step 2: Walk the ring-bearing controls and confirm exactly one indicator each**

For `ui/button.tsx`, `ui/input.tsx`, `ui/select.tsx`, `v2-header.tsx`'s nav pills and `ui/tabs.tsx:82`'s panel: focus each and confirm the computed `outline` is now `none` (their own ring does the work) rather than `3px solid` layered under a second ring.

- [ ] **Step 3: Confirm the two Task 1 sites now SHOW focus**

Tab to a tab strip — `/hesabim` is behind auth, so use the auth dialog's Giriş Yap/Üye Ol tablist on `/tr`, and `/design-system/duzen`'s `variant="line"` specimen. Confirm a visible outline lands on the focused tab, in **both themes**, at **390px and desktop**.

**Judgement point:** the member hub's tab strip scrolls horizontally (`scrollbar-none`, `pb-2`). If the 2px-offset outline is clipped by that scroll container, do NOT widen the container — give `TabsTrigger` a `focus-visible:ring-2 focus-visible:ring-primary/30` instead and drop back to `outline-none` for it, which keeps the indicator inside the element box. Record which branch you took.

- [ ] **Step 4: Sweep for geometry**

Run: `pnpm sweep:overflow`
Expected: PASS. A 3px outline with 2px offset is drawn outside the border box and does not affect layout, so this should be unchanged — but it is a visible change and `CLAUDE.md` requires the sweep.

- [ ] **Step 5: Record the decision in `docs/design.md`**

Amend the focus line at `docs/design.md:148` so it states the contract rather than just the value:

```
- Focus visible everywhere: `:focus-visible` = 3px `var(--ring)` outline, 2px offset. It lives in
  `@layer base` (T-053), so it is the DEFAULT a component may replace with its own
  `focus-visible:ring-*`, not an override nothing can escape. Replacing it is allowed; removing it
  with nothing in its place is not — `components/ui/focus-suppression.test.ts` refuses that.
```

- [ ] **Step 6: Commit**

```bash
git add docs/design.md
git commit -m "docs(design): the focus outline is a replaceable default, not an override"
```

---

## Self-Review

**Spec coverage.** T-053's recorded scope has three parts. "Move the rule into `@layer base`" → Task 3. "Then re-audit the ~8 ring-less sites" → the measurement table plus Tasks 1 and 4; the real count is 2, not 8, because the board's number was a source grep and did not account for cva variants or parent-owned rings. "The `border-radius: 4px` travels too; same move closes it" → Task 3, verified in Task 4 Step 1.

**One thing the board did not know**, added here: T-041 exempted this exact rule from `components/globals-unlayered-css.test.ts` with a written reason against this exact move. Task 2 exists to answer that reason rather than overrule it, and Task 3 Step 2 rewrites the comment so the next reader sees the reversal and its justification instead of a contradiction.

**Placeholders.** None. Every step names its file, its command and its expected output. The one open judgement — whether the tab outline is clipped by the hub's scroll container — is written as an explicit branch with both outcomes specified, because it is a rendered-geometry question no amount of planning can settle from source.

**Type consistency.** `SUPPRESSIONS`, `TREATMENT`, `EXEMPTIONS`, `EXEMPT_FILES`, `productSources()`, `suppresses()` are defined once in Task 2 and referenced nowhere else. `UNLAYERED_CSS_RULES` is read, not redefined.
