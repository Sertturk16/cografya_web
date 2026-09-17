import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("V2 error boundaries", () => {
  it("V2 has its own not-found so it never renders V1 chrome", () => {
    /**
     * A not-found boundary REPLACES `children`, so before this file existed the `.v2-app`
     * wrapper never rendered and the `body:has(.v2-app) > header, footer` suppression rule
     * never matched: a V2 route that called `notFound()` came back wearing V1's header and
     * footer.
     */
    const source = read("../../app/[locale]/v2/not-found.tsx");
    expect(source).toContain("V2Header");
    expect(source).toContain("V2Footer");
  });

  it("the error boundary is a client component and exposes reset", () => {
    const source = read("../../app/[locale]/v2/error.tsx");
    expect(source).toContain('"use client"');
    expect(source).toContain("reset");
  });

  it("the error boundary moves focus to its heading", () => {
    // docs/design.md a11y floor: a boundary that swaps page content in place mid-session has
    // to announce itself, and focus movement is the signal that does not depend on a live
    // region being noticed before its content settles.
    const source = stripComments(read("../../app/[locale]/v2/error.tsx"));
    expect(source).toContain("tabIndex={-1}");
    expect(source).toContain(".focus()");
  });

  it("the error boundary never surfaces the error object", () => {
    // It can carry a server stack. Next already reports server-side failures through its own
    // channel, so logging or rendering it adds nothing and can leak.
    const source = stripComments(read("../../app/[locale]/v2/error.tsx"));
    expect(source).not.toContain("console.error");
    expect(source).not.toContain("{error.message}");
    expect(source).not.toContain("{error.digest}");
  });

  it("both boundaries take their copy from the catalogues", () => {
    // Hard-coded Turkish here would be invisible to the EN reader who triggered it.
    for (const rel of ["../../app/[locale]/v2/not-found.tsx", "../../app/[locale]/v2/error.tsx"]) {
      expect(stripComments(read(rel))).toMatch(/useTranslations|getTranslations/);
    }
  });
});
