import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const SOURCE = readFileSync(at("../app/not-found.tsx"), "utf8");
const PROVIDER = readFileSync(at("./theme-provider.tsx"), "utf8");

describe("root not-found boundary", () => {
  it("supplies its own document shell", () => {
    // It renders OUTSIDE app/[locale]/layout.tsx, so nothing else provides html/body.
    expect(SOURCE).toContain("<html");
    expect(SOURCE).toContain("<body");
  });

  it("is static — it must not read the request", () => {
    // Resolving a locale here would force dynamic rendering on every route that can throw
    // notFound(), which is the regression app/[locale]/not-found.tsx documents.
    expect(SOURCE).not.toContain("getTranslations");
    expect(SOURCE).not.toContain("setRequestLocale");
    expect(SOURCE).not.toContain("headers(");
    expect(SOURCE).not.toContain("cookies(");
  });

  it("addresses both audiences, since it cannot know the locale", () => {
    expect(SOURCE).toMatch(/Sayfa bulunamad/i);
    expect(SOURCE).toMatch(/not found/i);
  });

  it("loads the stylesheet the locale layout would have loaded", () => {
    expect(SOURCE).toContain("globals.css");
  });

  /**
   * The theme script this page inlines duplicates what `next-themes` does everywhere else,
   * because `ThemeProvider` is mounted by the locale layout and that layout never runs here.
   * The duplication is acceptable; drifting apart silently is not — a changed `storageKey`
   * would leave this one page rendering light for a reader who chose dark, on the page least
   * likely to be checked. These two assertions are what make the copy safe.
   */
  it("reads the same storage key next-themes writes", () => {
    const configured = /storageKey="([^"]+)"/.exec(PROVIDER)?.[1];
    expect(configured).toBeDefined();
    expect(SOURCE).toContain(`localStorage.getItem("${configured}")`);
  });

  it("mirrors the provider's system default", () => {
    expect(PROVIDER).toContain('defaultTheme="system"');
    expect(SOURCE).toContain("prefers-color-scheme: dark");
    // Without this, a stored "system" would fall through to light rather than to the OS.
    expect(SOURCE).toContain('t==="system"');
  });

  it("never lets a storage failure take the page down with it", () => {
    // localStorage throws outright in some privacy modes; a 404 that white-screens is worse
    // than a 404 in the wrong theme.
    expect(SOURCE).toContain("try{");
    expect(SOURCE).toContain("catch(e){}");
  });
});
