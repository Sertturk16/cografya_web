import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * AST-based structure test for `register-form.tsx`'s R1/R2/R3 accessibility fixes
 * (uyelik-auth-redesign plan §5.9/§2.9) — TEST105-I1 (`pr-reviews/105.md`): the WCAG 4.1.3
 * group-reveal announcement (`groupAnnouncement`) and the `<fieldset>`/`<legend>` grouping of
 * the conditional profile-field blocks shipped with zero regression coverage; neither
 * `register-form.tsx` nor `login-form.tsx` had ever had a test file before this one. Same
 * AST/source-string-scan technique `auth-dialog.structure.test.ts` and
 * `auth-a11y.structure.test.ts` already use over this directory — this repo's vitest
 * environment is a bare `node` environment with no jsdom (`FU-WEB-JSDOM`), so the component
 * cannot be rendered and asserted on directly. The empirical half (real focus/announcement
 * behaviour, a live screen-reader-shaped check) is out of this gate's reach and belongs to a
 * Playwright pass, not here.
 */

function parse(relativePath: string): { source: string; ast: ts.SourceFile } {
  const url = new URL(relativePath, import.meta.url);
  const source = readFileSync(url, "utf8");
  const ast = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  return { source, ast };
}

function descendants<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

type JsxElementLike = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function isJsxElementLike(node: ts.Node): node is JsxElementLike {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
}

function jsxElements(root: ts.Node, tagName?: string): JsxElementLike[] {
  const all = descendants(root, isJsxElementLike);
  if (tagName === undefined) return all;
  return all.filter((el) => el.tagName.getText() === tagName);
}

/** The full `<tag>...</tag>` node (children included), unlike `jsxElements` above, which
 *  returns only the opening/self-closing tag — needed here to scan an element's own
 *  descendants (e.g. "which `<legend>`/`SelectField`s live inside THIS `<fieldset>`"). */
function jsxFullElements(root: ts.Node, tagName: string): ts.JsxElement[] {
  return descendants(root, ts.isJsxElement).filter(
    (el) => el.openingElement.tagName.getText() === tagName,
  );
}

function attrText(el: JsxElementLike, name: string): string | undefined {
  for (const attr of el.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || attr.name.getText() !== name) continue;
    if (attr.initializer === undefined) return "true";
    if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
    if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
      return attr.initializer.expression.getText();
    }
    return undefined;
  }
  return undefined;
}

/** `true` when `el` is a `<p>`/etc. whose only child expression is the bare identifier
 *  `identifierName` — the exact shape `{groupAnnouncement}` uses, distinguishing it from the
 *  district/university/department/province/resend announcements, which each read a
 *  DIFFERENT identifier. */
function hasSoleChildIdentifier(el: ts.JsxElement, identifierName: string): boolean {
  const exprChildren = el.children.filter(ts.isJsxExpression);
  return exprChildren.some(
    (child) => child.expression !== undefined && child.expression.getText() === identifierName,
  );
}

const { source, ast } = parse("./register-form.tsx");

describe("register-form.tsx groups the conditional profile fields in real <fieldset>/<legend> pairs (R2/R3 fix, TEST105-I1)", () => {
  const fieldsets = jsxFullElements(ast, "fieldset");

  it("renders exactly two <fieldset> elements, both wired with the shared .groupFieldset class", () => {
    // Positive control: this scan genuinely finds the two conditional field groups the R2/R3
    // fix introduced, not zero matches passing every assertion below vacuously.
    expect(fieldsets).toHaveLength(2);
    for (const fieldset of fieldsets) {
      expect(attrText(fieldset.openingElement, "className")).toBe("styles.groupFieldset");
    }
  });

  it("each <fieldset> carries exactly one real <legend>, using the shared .groupLegend class", () => {
    for (const fieldset of fieldsets) {
      const legends = jsxElements(fieldset, "legend");
      expect(legends).toHaveLength(1);
      const legend = legends[0];
      if (!legend) throw new Error("unreachable");
      expect(attrText(legend, "className")).toBe("styles.groupLegend");
    }
  });

  it("the secondary-school group contains grade/stream and its legend renders fields.groupSecondary", () => {
    const secondaryFieldset = fieldsets.find((el) =>
      jsxElements(el, "SelectField").some((sf) => attrText(sf, "id") === "register-gradeLevel"),
    );
    expect(secondaryFieldset).toBeDefined();
    if (!secondaryFieldset) throw new Error("unreachable");
    const ids = jsxElements(secondaryFieldset, "SelectField").map((sf) => attrText(sf, "id"));
    expect(ids).toContain("register-gradeLevel");
    expect(ids).toContain("register-studyStream");
    const fieldsetText = source.slice(secondaryFieldset.getStart(), secondaryFieldset.getEnd());
    expect(fieldsetText).toContain('t("fields.groupSecondary")');
  });

  it("the higher-ed group contains university/department and its legend renders fields.groupHigherEd", () => {
    const higherEdFieldset = fieldsets.find((el) =>
      jsxElements(el, "SelectField").some((sf) => attrText(sf, "id") === "register-universityName"),
    );
    expect(higherEdFieldset).toBeDefined();
    if (!higherEdFieldset) throw new Error("unreachable");
    const ids = jsxElements(higherEdFieldset, "SelectField").map((sf) => attrText(sf, "id"));
    expect(ids).toContain("register-universityName");
    expect(ids).toContain("register-departmentName");
    const fieldsetText = source.slice(higherEdFieldset.getStart(), higherEdFieldset.getEnd());
    expect(fieldsetText).toContain('t("fields.groupHigherEd")');
  });

  it("the two groups are genuinely different elements (false-positive control)", () => {
    const secondaryFieldset = fieldsets.find((el) =>
      jsxElements(el, "SelectField").some((sf) => attrText(sf, "id") === "register-gradeLevel"),
    );
    const higherEdFieldset = fieldsets.find((el) =>
      jsxElements(el, "SelectField").some((sf) => attrText(sf, "id") === "register-universityName"),
    );
    expect(secondaryFieldset).not.toBe(higherEdFieldset);
  });
});

describe("register-form.tsx announces the group reveal to AT (R1 fix, WCAG 4.1.3, TEST105-I1)", () => {
  it("an aria-live=polite region reads {groupAnnouncement} — distinct from the reference-list-load-count announcements", () => {
    const paragraphs = jsxFullElements(ast, "p");
    const announcementParagraphs = paragraphs.filter((p) =>
      hasSoleChildIdentifier(p, "groupAnnouncement"),
    );
    // Positive control: exactly one node in the file reads this identifier.
    expect(announcementParagraphs).toHaveLength(1);
    const node = announcementParagraphs[0];
    if (!node) throw new Error("unreachable");
    expect(attrText(node.openingElement, "aria-live")).toBe("polite");

    // Negative control: the district/university/department/province/resend live regions each
    // read a DIFFERENT identifier — this is not one of them under another name.
    const otherAnnouncementIdentifiers = [
      "districtAnnouncement",
      "universityAnnouncement",
      "departmentAnnouncement",
      "provinceAnnouncement",
    ];
    for (const identifier of otherAnnouncementIdentifiers) {
      expect(hasSoleChildIdentifier(node, identifier)).toBe(false);
    }
  });

  it("the announcement node is NOT nested inside either conditional <fieldset> — it stays mounted regardless of which group is showing", () => {
    const paragraphs = jsxFullElements(ast, "p");
    const announcement = paragraphs.find((p) => hasSoleChildIdentifier(p, "groupAnnouncement"));
    if (!announcement) throw new Error("unreachable");
    const fieldsets = jsxFullElements(ast, "fieldset");
    // Positive control: there really are fieldsets to check containment against.
    expect(fieldsets.length).toBeGreaterThan(0);
    for (const fieldset of fieldsets) {
      const insideFieldset =
        announcement.getStart() >= fieldset.getStart() &&
        announcement.getEnd() <= fieldset.getEnd();
      expect(insideFieldset).toBe(false);
    }
  });

  it("the announcement node sits BEFORE both fieldsets in source order — announced ahead of the fields it describes", () => {
    const paragraphs = jsxFullElements(ast, "p");
    const announcement = paragraphs.find((p) => hasSoleChildIdentifier(p, "groupAnnouncement"));
    if (!announcement) throw new Error("unreachable");
    const fieldsets = jsxFullElements(ast, "fieldset");
    for (const fieldset of fieldsets) {
      expect(announcement.getEnd()).toBeLessThan(fieldset.getStart());
    }
  });

  it("groupAnnouncement maps all three userType branches — secondary, undergraduate/graduate, and the empty default (e.g. teacher)", () => {
    const start = source.indexOf("const groupAnnouncement =");
    expect(start).toBeGreaterThan(0);
    const end = source.indexOf(";", start);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    expect(block).toContain('userType === "secondary"');
    expect(block).toContain('t("fields.groupSecondaryAnnounce")');
    expect(block).toContain('userType === "undergraduate" || userType === "graduate"');
    expect(block).toContain('t("fields.groupHigherEdAnnounce")');
    // The default branch (teacher, or no userType chosen yet) announces nothing.
    expect(block).toMatch(/:\s*""\s*$/);
  });
});

describe("auth-form.module.css handles the fieldset's UA min-width footgun (plan's own K10 risk mitigation)", () => {
  const cssPath = fileURLToPath(new URL("./auth-form.module.css", import.meta.url));
  const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");

  it(".groupFieldset sets min-inline-size: 0, working around <fieldset>'s UA-stylesheet min-width: min-content in a flex column", () => {
    const rule = css.match(/\.groupFieldset\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[0]).toMatch(/min-inline-size\s*:\s*0/);
  });
});

describe("register-form.tsx relocates the login cross-link into .formHeader, not duplicated (İRİS idea B1, iris-ideas-small-fix-bundle plan §5.1)", () => {
  const formHeaders = jsxFullElements(ast, "div").filter(
    (el) => attrText(el.openingElement, "className") === "styles.formHeader",
  );

  it("renders exactly one .formHeader wrapper", () => {
    // Positive control: this scan genuinely finds the wrapper, not zero matches passing every
    // assertion below vacuously.
    expect(formHeaders).toHaveLength(1);
  });

  it("the .formHeader wrapper contains exactly one .formSubheading paragraph linking to /giris", () => {
    const [formHeader] = formHeaders;
    if (!formHeader) throw new Error("unreachable");
    const subheadings = jsxFullElements(formHeader, "p").filter(
      (el) => attrText(el.openingElement, "className") === "styles.formSubheading",
    );
    expect(subheadings).toHaveLength(1);
    const [subheading] = subheadings;
    if (!subheading) throw new Error("unreachable");
    const links = jsxElements(subheading, "Link");
    expect(links).toHaveLength(1);
    const [link] = links;
    if (!link) throw new Error("unreachable");
    expect(attrText(link, "href")).toBe("/giris");
  });

  it("the <h1> sits before the cross-link inside .formHeader — heading first, helper line second", () => {
    const [formHeader] = formHeaders;
    if (!formHeader) throw new Error("unreachable");
    const h1s = jsxElements(formHeader, "h1");
    const subheadings = jsxFullElements(formHeader, "p").filter(
      (el) => attrText(el.openingElement, "className") === "styles.formSubheading",
    );
    expect(h1s).toHaveLength(1);
    expect(subheadings).toHaveLength(1);
    const [h1] = h1s;
    const [subheading] = subheadings;
    if (!h1 || !subheading) throw new Error("unreachable");
    expect(h1.getStart()).toBeLessThan(subheading.getStart());
  });

  it("no .crossLink element remains in register-form.tsx — the foot-of-card copy was relocated, not duplicated (login-form.tsx keeps its own, unrelated .crossLink)", () => {
    const crossLinkNodes = jsxElements(ast).filter(
      (el) => attrText(el, "className") === "styles.crossLink",
    );
    expect(crossLinkNodes).toHaveLength(0);
  });

  it('exactly one <Link href="/giris"> exists in the whole file — a false-positive control against a silent duplicate', () => {
    const loginLinks = jsxElements(ast, "Link").filter((el) => attrText(el, "href") === "/giris");
    expect(loginLinks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------
// hasSoleChildIdentifier — a tiny positive/negative control on the helper itself, so a
// silent regression in the matcher does not make every assertion above pass vacuously.
// ---------------------------------------------------------------------------------------

function parseSource(sourceText: string): ts.SourceFile {
  return ts.createSourceFile(
    "synthetic.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

describe("hasSoleChildIdentifier correctly matches/rejects (control for the announcement scan above)", () => {
  it("matches a <p> whose sole child expression is the target identifier", () => {
    const synthetic = parseSource(`
      function Demo({ groupAnnouncement }: { groupAnnouncement: string }) {
        return <p aria-live="polite">{groupAnnouncement}</p>;
      }
    `);
    const [p] = jsxFullElements(synthetic, "p");
    if (!p) throw new Error("unreachable");
    expect(hasSoleChildIdentifier(p, "groupAnnouncement")).toBe(true);
  });

  it("does not match a <p> reading a different identifier (false-positive control)", () => {
    const synthetic = parseSource(`
      function Demo({ districtAnnouncement }: { districtAnnouncement: string }) {
        return <p aria-live="polite">{districtAnnouncement}</p>;
      }
    `);
    const [p] = jsxFullElements(synthetic, "p");
    if (!p) throw new Error("unreachable");
    expect(hasSoleChildIdentifier(p, "groupAnnouncement")).toBe(false);
  });
});
