import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Structural AST and contract test for V2RegisterCard
 * (`CODE125-I1`, `CODE125-I3`, `A11Y125-I2`, `FU125SEC-I1`, `FU125SEC-M2`, `FU125SEC-M3`, `FU125TC-I1`).
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

describe("V2RegisterCard structural contract", () => {
  const { source, ast } = parse("./v2-register-card.tsx");

  it("imports canonical buildRegisterPayload, isPasswordPolicyCompliant, and USER_TYPE_LABELS", () => {
    let hasBuildRegisterPayload = false;
    let hasIsPasswordPolicyCompliant = false;
    let hasUserTypeLabels = false;

    ts.forEachChild(ast, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, "");
        if (moduleSpecifier === "@/lib/auth/form-rules") {
          const namedBindings = node.importClause?.namedBindings;
          if (namedBindings && ts.isNamedImports(namedBindings)) {
            for (const specifier of namedBindings.elements) {
              const name = specifier.name.text;
              if (name === "buildRegisterPayload") hasBuildRegisterPayload = true;
              if (name === "isPasswordPolicyCompliant") hasIsPasswordPolicyCompliant = true;
            }
          }
        }
        if (moduleSpecifier === "@/lib/auth/profile-labels") {
          const namedBindings = node.importClause?.namedBindings;
          if (namedBindings && ts.isNamedImports(namedBindings)) {
            for (const specifier of namedBindings.elements) {
              if (specifier.name.text === "USER_TYPE_LABELS") hasUserTypeLabels = true;
            }
          }
        }
      }
    });

    expect(hasBuildRegisterPayload).toBe(true);
    expect(hasIsPasswordPolicyCompliant).toBe(true);
    expect(hasUserTypeLabels).toBe(true);
  });

  it("derives role labels from canonical USER_TYPE_LABELS (CODE125-I3)", () => {
    expect(source).toContain("USER_TYPE_LABELS.secondary.tr");
    expect(source).toContain("USER_TYPE_LABELS.undergraduate.tr");
    expect(source).toContain("USER_TYPE_LABELS.graduate.tr");
    expect(source).toContain("USER_TYPE_LABELS.teacher.tr");
  });

  it("keeps registration minimal without university/department/grade inputs (DEC 2026-09-03a md.1, FU125SEC-I1)", () => {
    // Form does not render university/department datalists or grade dropdowns
    expect(source).not.toContain("v2-universities-list");
    expect(source).not.toContain("v2-departments-list");
    expect(source).not.toContain("v2-register-grade");
    expect(source).not.toContain("v2-register-stream");

    // No hardcoded dummy strings in source
    expect(source).not.toContain('"Diğer"');
    expect(source).not.toContain('"Coğrafya"');
    expect(source).not.toContain('"KPSS"');
  });

  it("enforces ASCII password policy and 6-char minimum requirement (CODE125-I1, FU125SEC-M2)", () => {
    expect(source).toMatch(/isPasswordPolicyCompliant\(password\)/);
    expect(source).toContain("password.length >= 6");
    expect(source).toContain("/[a-z]/.test(password)");
    expect(source).toContain("/[A-Z]/.test(password)");
    expect(source).not.toContain("/[a-zğüşıöç]/");
  });

  it("announces field errors to screen readers and focuses first invalid field via explicit mapping (A11Y125-I2, A11Y126-I2)", () => {
    expect(source).toContain('role="status" aria-live="polite" className="sr-only"');
    expect(source).toContain("FIELD_ELEMENT_IDS");
    expect(source).toContain('provincePlateCode: "v2-register-province"');
    expect(source).toContain('districtId: "v2-register-district"');
    expect(source).toContain("el.focus()");
  });

  it("enforces 60-second cooldown on resend verification code (SEC126-I1)", () => {
    expect(source).toContain("resendCooldown");
    expect(source).toContain("setResendCooldown(60)");
    expect(source).toContain("disabled={loading || resendCooldown > 0}");
  });

  it("wires field-specific errors and error association", () => {
    expect(source).toContain("fieldErrors.firstName");
    expect(source).toContain("fieldErrors.lastName");
    expect(source).toContain("fieldErrors.email");
    expect(source).toContain("fieldErrors.phone");
    expect(source).toContain("fieldErrors.password");
    expect(source).toContain("fieldErrors.provincePlateCode");
    expect(source).toContain("fieldErrors.districtId");
  });
});
