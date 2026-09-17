import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * Comments are stripped, for the third time in this task. A docblock that explains why a
 * component is NOT `role="alert"` contains the string `role="alert"`, and a scanner that
 * cannot tell prose from code flags the explanation. `lib/theme/bridge-tokens.test.ts` and
 * `components/ui/token-binding.test.ts` learned the same lesson.
 */
const read = (name: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(`./${name}.tsx`, import.meta.url)), "utf8"));

/**
 * Accessibility contracts for the primitives T-034 added.
 *
 * Every assertion here corresponds to something measured in a browser, not to a style
 * preference. Where the shadcn registry output fell short, the gap and its fix are recorded
 * in the component's own docblock.
 */
describe("Tooltip replaces title= properly, not just visually", () => {
  const source = read("tooltip");

  /**
   * The registry output appeared on keyboard focus — the visual half of what `title=` never
   * did — but carried no `role` and no linkage, so focusing the trigger announced only the
   * trigger's own name and the tooltip text was never read. Verified in the browser before
   * and after: `aria-describedby` now resolves to a `role="tooltip"` element carrying the
   * content, both while the tooltip is closed and while it is open.
   */
  it("links the trigger to the content", () => {
    expect(source).toContain("aria-describedby={id}");
    expect(source).toContain('role="tooltip"');
    expect(source).toContain("id={id}");
  });

  it("keeps the popup mounted so the reference never dangles", () => {
    expect(source).toContain("keepMounted");
  });

  it("generates the id rather than asking every call site for one", () => {
    expect(source).toContain("React.useId()");
    expect(source).toContain("TooltipIdContext");
  });
});

describe("Spinner announces what is loading", () => {
  const source = read("spinner");

  it("is a status, not an alert", () => {
    // A load starting is not an event worth interrupting the reader for.
    expect(source).toContain('role="status"');
    expect(source).not.toContain('role="alert"');
  });

  it("carries a label and hides the icon from assistive technology", () => {
    expect(source).toContain("sr-only");
    expect(source).toContain('aria-hidden="true"');
  });
});

/**
 * The Pagination and Separator blocks stood here.
 *
 * T-036 deleted both primitives, so their contracts have no subject left to hold. Neither
 * RULE was dropped, though — each moved to the one place in the product it actually applies:
 *
 *   - Pagination's landmark and live-page rules now sit on the repo's only paginated list,
 *     `components/v2/v2-leaderboard-modal.tsx`, which pages client state inside a modal with
 *     no URL. The primitive's own core decision — real `<a href>` anchors, "so middle-click
 *     and open-in-new-tab work" — is exactly what does not fit there.
 *   - Separator had nothing to hold. Its docblock claimed it was "the shape 24 V2 files were
 *     hand-rolling as `border-t border-border`", and that was a category error: all 63 of
 *     those occurrences are a border ON a content element. See `components/ui/orphan.test.ts`
 *     for the measurement.
 */
describe("the generated primitives were read before they were committed", () => {
  it.each(["progress", "tooltip", "breadcrumb"])(
    "%s imports cn from the repo, not the npm package the CLI reached for",
    (name) => {
      // `shadcn add` wrote `import { cn } from "cn"` and installed an unrelated package.
      // Every other component in this directory uses @/lib/utils.
      expect(read(name)).toContain('from "@/lib/utils"');
      expect(read(name)).not.toMatch(/from "cn"/);
    },
  );
});

describe("Table sorting is an action, announced as one", () => {
  const source = read("table");

  it("sorts with a real button, not a clickable cell", () => {
    // A clickable <th> is neither keyboard-reachable nor announced as pressable.
    expect(source).toContain('type="button"');
    expect(source).toContain("TableSortButton");
  });

  it("puts aria-sort on the header, not on the button", () => {
    // aria-sort describes the COLUMN's state; the button only changes it. Putting it on the
    // button is a common mistake that reads as the button itself being sorted.
    const headStart = source.indexOf("function TableHead");
    const buttonStart = source.indexOf("function TableSortButton");
    const ariaSort = source.indexOf("aria-sort");
    expect(ariaSort).toBeGreaterThan(headStart);
    expect(ariaSort).toBeLessThan(buttonStart > headStart ? Infinity : headStart);
    expect(
      source.slice(buttonStart, headStart > buttonStart ? headStart : source.length),
    ).not.toContain("aria-sort");
  });

  it("gives the unsorted state its own glyph", () => {
    // So a sortable column is distinguishable from a fixed one without clicking to find out.
    expect(source).toContain("ChevronsUpDown");
  });

  it("still wraps in an overflow container", () => {
    // docs/design.md: a wide table scrolls inside its own box, never the page body.
    expect(source).toContain("overflow-x-auto");
  });
});

describe("Tabs carries its variant on context", () => {
  const source = read("tabs");

  it("offers both looks", () => {
    expect(source).toContain("pills");
    expect(source).toContain("line");
  });

  it("does not ask each part to be told which variant it is in", () => {
    // Passing it to TabsList and TabsTrigger separately is how the two drift apart.
    expect(source).toContain("TabsVariantContext");
    expect(source).toContain("React.useContext(TabsVariantContext)");
  });

  it("BOTH halves read the context, not just the trigger", () => {
    /**
     * This assertion exists because the weaker one above passed while the bug was live.
     * T-034 shipped `TabsList` with the pills container hard-coded and `listVariants`
     * unreferenced, so a `line` tabset rendered underlined triggers inside a grey pill bar —
     * exactly the drift the context was introduced to prevent. ESLint caught it only as an
     * unused variable, which reads like tidy-up rather than a rendering defect.
     *
     * Counting the reads is what makes it a real gate: a single `useContext` call satisfies
     * `toContain`, so only the count distinguishes "both halves wired" from "one half wired".
     */
    const reads = source.match(/React\.useContext\(TabsVariantContext\)/g) ?? [];
    expect(reads).toHaveLength(2);
    expect(source).toContain("listVariants[React.useContext(TabsVariantContext)]");
    expect(source).toContain("triggerVariants[React.useContext(TabsVariantContext)]");
  });

  it("underlines with an inset shadow, so selecting does not shift the tab", () => {
    expect(source).toContain("inset_0_-2px_0_0_currentColor");
  });
});

describe("AlertTitle is a paragraph unless asked otherwise", () => {
  const source = read("alert");

  /**
   * `Callout` and `EmptyState` both use `<p>` for their leads and document why: a component
   * that sits inside a section which already has a heading puts a rung in the outline the page
   * structure does not have. `AlertTitle` shipped as `<h5>` and contradicted both — and an
   * alert is a component you use several of, so five demo alerts put ten headings into one
   * page's outline, two levels below anything above them.
   */
  it("does not hard-code a heading element", () => {
    expect(source).not.toMatch(/<h[1-6]\b/);
  });

  it("defaults to a paragraph", () => {
    expect(source).toContain('level === undefined ? "p"');
  });

  it("still offers a real heading for the case that wants one", () => {
    // A full-page error state is content, not an aside, and does belong in the outline.
    expect(source).toContain("level?: AlertTitleLevel");
    expect(source).toContain("`h${level}`");
  });
});
