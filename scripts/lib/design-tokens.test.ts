import { describe, expect, it } from "vitest";

import { extractTokens, renderFrontmatter, spliceFrontmatter } from "./design-tokens.mjs";

const CSS = `
/* a comment with braces { that } must not end a block */
:root,
.light {
  --color-primary: #b0522e; /* terracotta */
  --color-on-primary: #fff;
  --radius: 0.625rem;
  --font-heading: var(--font-fraunces), Georgia, serif;
  --font-body: var(--font-nunito-sans), system-ui, sans-serif;
  --background: var(--color-bg);
  --color-bg: #fbf8f3;
  --primary: var(--color-primary);
  --ring: rgb(39 107 112 / 50%);
  --mixed: color-mix(in oklab, var(--color-primary) 50%, white);
  --missing: var(--nowhere);
  --map-sea: #dbe7e8;
  --chart-1: oklch(0.87 0 0);
}
@layer base {
  body { font-family: var(--font-body); font-size: 16px; line-height: 1.6; }
  h1 { font-size: clamp(1.9rem, 1.2rem + 2.6vw, 2.6rem); font-weight: 700; }
  h2 { font-size: clamp(1.4rem, 1rem + 1.4vw, 1.8rem); font-weight: 600; }
  :focus-visible { outline: 3px solid var(--ring); border-radius: 4px; }
}
@theme inline {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-ring: var(--ring);
  --color-mixed: var(--mixed);
  --color-missing: var(--missing);
  --color-chart-1: var(--chart-1);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}
.dark {
  --background: #0b1416;
  --primary: var(--color-primary);
}
`;

describe("extractTokens", () => {
  const tokens = extractTokens(CSS);

  it("keeps raw Terra colours under a terra- prefix", () => {
    expect(tokens.colors["terra-primary"]).toBe("#b0522e");
    expect(tokens.colors["terra-on-primary"]).toBe("#fff");
  });

  it("resolves bridge tokens through var() chains to their literal colour", () => {
    expect(tokens.colors.background).toBe("#fbf8f3");
    expect(tokens.colors.primary).toBe("#b0522e");
    expect(tokens.colors.ring).toBe("rgb(39 107 112 / 50%)");
  });

  it("keeps data-encoding and unused shadcn tokens out of the palette", () => {
    expect(tokens.colors).not.toHaveProperty("map-sea");
    expect(tokens.colors).not.toHaveProperty("chart-1");
    expect(Object.values(tokens.colors)).not.toContain("#dbe7e8");
  });

  it("emits dark values under a night- prefix, resolving through :root", () => {
    expect(tokens.colors["night-background"]).toBe("#0b1416");
    expect(tokens.colors["night-primary"]).toBe("#b0522e");
  });

  it("skips values that do not end in a literal colour", () => {
    expect(tokens.colors).not.toHaveProperty("mixed");
    expect(tokens.colors).not.toHaveProperty("missing");
    expect(tokens.colors).not.toHaveProperty("radius");
    expect(Object.values(tokens.colors).join(" ")).not.toContain("var(");
  });

  it("reads font stacks with next/font variables named", () => {
    expect(tokens.typography.body?.fontFamily).toBe("Nunito Sans, system-ui, sans-serif");
    expect(tokens.typography.display?.fontFamily).toBe("Fraunces, Georgia, serif");
  });

  it("reads the base-layer type ramp", () => {
    expect(tokens.typography.body).toMatchObject({ fontSize: "16px", lineHeight: 1.6 });
    expect(tokens.typography.display).toMatchObject({
      fontSize: "clamp(1.9rem, 1.2rem + 2.6vw, 2.6rem)",
      fontWeight: 700,
    });
    expect(tokens.typography.headline).toMatchObject({
      fontSize: "clamp(1.4rem, 1rem + 1.4vw, 1.8rem)",
      fontWeight: 600,
    });
  });

  it("derives the radius scale in px from --radius", () => {
    expect(tokens.rounded).toMatchObject({ sm: "6px", lg: "10px", xl: "14px", focus: "4px" });
  });
});

describe("spliceFrontmatter", () => {
  const fm = renderFrontmatter(extractTokens(CSS));

  it("renders a frontmatter block", () => {
    expect(fm.startsWith("---\n")).toBe(true);
    expect(fm.endsWith("---\n")).toBe(true);
    expect(fm).toContain('terra-primary: "#b0522e"');
  });

  it("prepends to a document without one and replaces an existing one", () => {
    const first = spliceFrontmatter("# Title\n\nBody\n", fm);
    expect(first).toBe(`${fm}\n# Title\n\nBody\n`);
    const again = spliceFrontmatter(first, fm);
    expect(again).toBe(first);
    const replaced = spliceFrontmatter("---\nname: old\n---\n\n# Title\n\nBody\n", fm);
    expect(replaced).toBe(first);
    expect(replaced.match(/^---$/gm)).toHaveLength(2);
  });
});
