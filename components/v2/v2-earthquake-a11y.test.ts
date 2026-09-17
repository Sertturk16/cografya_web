import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../lib/test-support/strip-comments";

/**
 * Invariant tests for earthquake explorer keyboard a11y, fault line copy clean-up,
 * and dead module pruning (`FU125A11Y-C1`, `FEN125-I1`, `FEN125-I2`, `FU125SEO-I1`, `FU125SEO-I2`).
 */

describe("V2 earthquake explorer a11y and copy invariants", () => {
  it("provides keyboard navigation and focus-visible on SVG epicenters and table rows (FU125A11Y-C1)", () => {
    const url = new URL("./v2-earthquake-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // SVG epicenters are a ROVING tabindex group (A11Y126-I5): exactly one marker — the
    // selected one — is in the tab order, the rest are programmatically focusable only.
    expect(content).toMatch(/<g[^>]*tabIndex=\{isTabStop \? 0 : -1\}[^>]*role="button"/);
    expect(content).toMatch(
      /onKeyDown=\{\(e\) => \{\s*if \(e\.key === "Enter" \|\| e\.key === " "\)/,
    );
    // …and the arrow/Home/End branch that moves that single tab stop is what makes the group
    // navigable once entered; without it the roving tabindex would strip navigation instead.
    expect(content).toContain("document.getElementById(`eq-marker-${next.id}`)?.focus()");
    expect(content).toContain("focus-visible:scale-125");

    // TableRow must have tabIndex={0}, aria-selected, onKeyDown with Enter/Space, and accessible name
    expect(content).toMatch(/<TableRow[^>]*tabIndex=\{0\}[^>]*aria-selected=\{isSelected\}/);
    expect(content).toMatch(
      /aria-label=\{`M \$\{eq\.magnitude\.toFixed\(1\)\} - \$\{eq\.placeNameTr\} depremini seç`\}/,
    );

    // Live region for selection announcement (WCAG 4.1.3, A11Y126-I4)
    expect(content).toContain('role="status" aria-live="polite" className="sr-only"');
    expect(content).toContain("Seçilen deprem: Büyüklük");
  });

  it("cleanses fault lines claims from toolbar label, page title, H1, and JSON-LD (FEN125-I1, FEN125-I2)", () => {
    const explorerUrl = new URL("./v2-earthquake-explorer.tsx", import.meta.url);
    const explorerContent = readFileSync(explorerUrl, "utf8");
    expect(explorerContent).toContain("Eşzamanlı Merkez Üsleri &amp; Odak Derinlikleri");
    expect(explorerContent).not.toContain("Eşzamanlı Merkez Üsleri &amp; Aktif Fay Hatları");

    const pageUrl = new URL("../../app/[locale]/(site)/deprem/page.tsx", import.meta.url);
    const pageContent = readFileSync(pageUrl, "utf8");
    expect(pageContent).toContain("Canlı Deprem Takip & Sismik Monitör");
    expect(pageContent).not.toContain("Sismik Fay Monitörü");
    expect(pageContent).not.toContain("ve fay hatlarıyla anlık takip edin");
  });

  it("names MTA nowhere the earthquake pages cannot trace data to it (FU125SEO-I1)", () => {
    /**
     * RE-POINTED AND UN-VACUUMED, not weakened.
     *
     * This asserted `not.toContain('id: "mta-fay"')`. The card's id was `mta-diri-fay`, so the
     * substring never appeared and the assertion could not fail — it was green while the card
     * it was named after sat in the `deprem` list.
     *
     * The rule it now carries is the owner's: a source card naming an institution belongs only
     * where the page can trace its data to that institution. `/deprem/fay-hatlari` renders
     * `lib/earthquake/fault-lines-data.ts` — fault-zone names, approximate lengths, prose
     * mechanisms, town-named segments, province lists, historical earthquakes. The first
     * assertion below is what makes that true and keeps it true.
     *
     * COMMENTS ARE STRIPPED FIRST (`docs/conventions.md`). All three files now explain in a
     * docblock why the MTA claim is not earned, and a naive search matches the explanation — the
     * exact failure mode that has shipped four times in this repo. Mutation-checked: restoring
     * `id: "mta-diri-fay"` to the `deprem` list turns the first pair red, restoring the eyebrow
     * to `/deprem` turns the last red, and adding a `lat`/`lon` pair to the fault data turns the
     * middle one red.
     *
     * The strip is `lib/test-support/strip-comments.ts`, not the two-`replace` form used
     * elsewhere here: that form reads the `messages/*.json` inside a line comment in
     * `v2-sources-section.tsx` as a block-comment opener and deletes the `deprem` scope outright,
     * so `not.toMatch(/MTA/)` would pass against a file with the card still in it.
     */
    const sources = stripComments(
      readFileSync(new URL("./v2-sources-section.tsx", import.meta.url), "utf8"),
    );
    // Anti-vacuity: the bibliography must still BE a bibliography, or `not.toMatch` below
    // would pass against a file that no longer declares any source at all.
    expect(sources).toMatch(/id: "afad-deprem"/);
    expect(sources).not.toMatch(/MTA/);

    // …and the data behind the page still carries no MTA-derived material. A coordinate or a
    // path would be geometry, and geometry IS traceable to a published fault map — at which
    // point the citation becomes earned and this assertion must be revisited, not deleted.
    const faultData = stripComments(
      readFileSync(new URL("../../lib/earthquake/fault-lines-data.ts", import.meta.url), "utf8"),
    );
    expect(faultData).toContain("FAULT_LINES_DATA");
    expect(faultData).not.toMatch(/\b(lat|lon|lng|latitude|longitude|coordinates|geometry)\b/i);

    // The page chrome may not carry the claim the card was removed for either.
    const deprem = stripComments(
      readFileSync(new URL("../../app/[locale]/(site)/deprem/page.tsx", import.meta.url), "utf8"),
    );
    expect(deprem).toContain("Sismotektonik Yapı");
    expect(deprem).not.toMatch(/MTA/);
  });

  it("rephrases fault line descriptions without unverified numerical figures (FU125SEO-I2)", () => {
    // RE-POINTED, not weakened (T-036). The rule — no unverified fault-length figures in the
    // fault-line copy — was pinned on `v2-fault-lines-guide.tsx`, which no Next.js entry point
    // ever reached; `/deprem/fay-hatlari` renders the same subject from `FAULT_LINES_DATA`
    // inline. The copy lives in the data module and the page now, so the assertion runs there.
    const sources = [
      new URL("../../lib/earthquake/fault-lines-data.ts", import.meta.url),
      new URL("../../app/[locale]/(site)/deprem/fay-hatlari/page.tsx", import.meta.url),
    ];
    // Anti-vacuity: both sources must exist and carry the fault-line vocabulary at all,
    // otherwise two `not.toContain` checks would pass against an empty read.
    for (const url of sources) {
      const content = readFileSync(url, "utf8");
      expect(content).toContain("Fay");
      expect(content).not.toContain("yaklaşık 1.500 km");
      expect(content).not.toContain("yaklaşık 550 km");
    }
  });

  it("ensures dead lib/map/fault-lines.ts module is pruned (CODE125-M2)", () => {
    const faultLinesUrl = new URL("../../lib/map/fault-lines.ts", import.meta.url);
    expect(existsSync(faultLinesUrl)).toBe(false);
  });
});
