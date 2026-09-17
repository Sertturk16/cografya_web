import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Comments are stripped, for the third time in this task. A docblock that explains why a
 * component is NOT `role="alert"` contains the string `role="alert"`, and a scanner that
 * cannot tell prose from code flags the explanation. `lib/theme/bridge-tokens.test.ts` and
 * `components/ui/token-binding.test.ts` learned the same lesson.
 */
const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}.tsx`, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

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

describe("Pagination is navigation made of links", () => {
  const source = read("pagination");

  it("marks the current page programmatically, not only by colour", () => {
    expect(source).toContain('aria-current={isActive ? "page" : undefined}');
  });

  it("names its landmark", () => {
    // A page can carry several <nav>s; an unnamed one tells a screen-reader user nothing.
    expect(source).toContain('aria-label="Sayfalama"');
  });

  it("uses real anchors so middle-click and open-in-new-tab work", () => {
    expect(source).toMatch(/<a\b/);
  });

  it("keeps list semantics on a markerless list", () => {
    // Safari and VoiceOver drop them otherwise, taking "list, 7 items" with them — the same
    // note app/globals.css writes against .province-grid.
    expect(source).toContain('role="list"');
  });

  it("composes our Button rather than the registry's", () => {
    // `shadcn add pagination` asked to overwrite components/ui/button.tsx, which carries
    // Terra's variants and the phase A2 token rebinding. It was declined.
    expect(source).toContain('from "@/components/ui/button"');
    expect(source).toContain("buttonVariants");
  });
});

describe("Separator can opt out of the accessibility tree", () => {
  const source = read("separator");

  it("supports a decorative mode Base UI does not ship", () => {
    // 24 V2 files hand-rolled `border-t border-border`. Announcing "separator" once per
    // decorative rule is noise.
    expect(source).toContain("decorative");
    expect(source).toContain('role={decorative ? "none" : undefined}');
  });
});

describe("the generated primitives were read before they were committed", () => {
  it.each(["separator", "progress", "tooltip", "popover", "breadcrumb"])(
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

  it("underlines with an inset shadow, so selecting does not shift the tab", () => {
    expect(source).toContain("inset_0_-2px_0_0_currentColor");
  });
});
