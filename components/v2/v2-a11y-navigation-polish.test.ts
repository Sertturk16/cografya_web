import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Invariant tests for navigation guards, landmark uniqueness, and WAI-ARIA combobox accessibility
 * (`CODE125-I2`, `FU125A11Y-I1`, `FU125A11Y-I2`, `A11Y125-I3`, `SEC125-M2`).
 */

describe("V2 A11y and navigation invariants", () => {
  it("implements WAI-ARIA APG combobox keyboard navigation and focus restoration in CustomSelect (FU125A11Y-I1, FU125A11Y-I2)", () => {
    const url = new URL("../ui/custom-select.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // Focus restoration in handleSelect
    expect(content).toContain("triggerRef.current?.focus()");

    // Keyboard navigation keys
    expect(content).toContain('e.key === "ArrowDown"');
    expect(content).toContain('e.key === "ArrowUp"');
    expect(content).toContain('e.key === "Home"');
    expect(content).toContain('e.key === "End"');

    // ARIA roles and active descendant binding
    expect(content).toContain('role="combobox"');
    expect(content).toContain('role="listbox"');
    expect(content).toContain('role="option"');
    expect(content).toContain("aria-activedescendant={activeDescendantId}");
  });

  it("binds CustomSelect's keydown handler exactly twice — trigger + search input, never the popup wrapper (FU126A11Y-I2)", () => {
    const url = new URL("../ui/custom-select.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");
    // Positive control: the probe can find a binding at all.
    expect(content).toContain("onKeyDown={handleKeyDown}");
    // Exactly two: the trigger <button> and the searchable <input>. A third binding on the
    // popup <div> makes the input's keydown bubble into the same handler twice, which moved
    // the arrow-key highlight two options per press (FU126A11Y-I2).
    expect(content.match(/onKeyDown=\{handleKeyDown\}/g)?.length).toBe(2);
  });

  it("restores accessible name to selectable marine station table rows (A11Y125-I3)", () => {
    const url = new URL("./v2-marine-map-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    expect(content).toMatch(/<TableRow[^>]*aria-label=\{`\$\{point\.nameTr\} noktasını seç`\}/);
  });

  it("has no AuthMount to guard — the V1 auth tree is gone (SEC125-M2)", () => {
    /**
     * SEC125-M2 was about `components/auth/auth-mount.tsx` querying the DOM during render to
     * decide whether it was on a V2 route. T-032 PR3 retired the `/v2` prefix, which made the
     * path test meaningless, and PR4 deleted `components/auth/` outright — the V2 auth surface is
     * `V2AuthDialog`, mounted once by the `(site)` layout.
     *
     * The defect class outlives the component, so the assertion becomes its absence: nothing may
     * reintroduce a render-phase DOM query to find out which tree it is in.
     */
    const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
      });

    expect(existsSync(join(repoRoot, "components/auth")), "components/auth is back").toBe(false);

    const offenders = ["components", "app"]
      .flatMap((r) => walk(join(repoRoot, r)))
      .filter((file) => readFileSync(file, "utf8").includes('document.querySelector(".v2-app")'))
      .map((file) => file.slice(repoRoot.length));
    expect(offenders, "render-phase DOM query for the app tree").toEqual([]);
  });

  it("ensures exactly one id=main-content landmark exists across the entire app (CODE125-I2)", () => {
    /**
     * DERIVED from the filesystem, not a hand-kept list. T-032 PR3 moved the landmark into
     * `(site)/layout.tsx`, which is what makes this invariant structural: before, 24 pages
     * rendered their own `<main>` inside the root layout's, nesting the landmark, and this
     * assertion could only name the pages somebody had remembered to add.
     */
    const appDir = fileURLToPath(new URL("../../app/[locale]/", import.meta.url));
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name === "page.tsx" ? [full] : [];
      });
    const pages = walk(appDir);

    // Anti-vacuity: a scan that found nothing would satisfy the loop below trivially.
    expect(pages.length, "page.tsx files under app/[locale]").toBeGreaterThan(25);

    for (const page of pages) {
      expect(readFileSync(page, "utf8"), page).not.toContain('id="main-content"');
    }

    const siteLayout = readFileSync(
      fileURLToPath(new URL("../../app/[locale]/(site)/layout.tsx", import.meta.url)),
      "utf8",
    );
    expect(siteLayout).toContain('id="main-content"');

    // The root layout is the document shell now and must NOT carry a second one.
    const rootLayout = readFileSync(
      fileURLToPath(new URL("../../app/[locale]/layout.tsx", import.meta.url)),
      "utf8",
    );
    expect(rootLayout).not.toContain('id="main-content"');
  });
});
