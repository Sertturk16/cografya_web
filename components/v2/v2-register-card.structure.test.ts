import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Structural AST test for V2RegisterCard (`TEST124-I1`, `CODE124-C2`, `VAL124SEC-1`).
 * Verifies that:
 * 1. `buildRegisterPayload` and `isPasswordPolicyCompliant` are imported from `@/lib/auth/form-rules`.
 * 2. It does not fabricate hardcoded strings ("Diğer", "Coğrafya") for unasked profile fields.
 * 3. The 4 canonical roles ("secondary", "undergraduate", "graduate", "teacher") are bound.
 * 4. Field-specific errors are used rather than a single global error setting all fields aria-invalid.
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

describe("V2RegisterCard structural contract (TEST124-I1)", () => {
  const { source, ast } = parse("./v2-register-card.tsx");

  it("imports canonical buildRegisterPayload and isPasswordPolicyCompliant from form-rules", () => {
    let hasBuildRegisterPayload = false;
    let hasIsPasswordPolicyCompliant = false;

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
      }
    });

    expect(hasBuildRegisterPayload).toBe(true);
    expect(hasIsPasswordPolicyCompliant).toBe(true);
  });

  it("does not pass hardcoded dummy values for universityName or departmentName", () => {
    // Should not contain hardcoded "Diğer" or "Coğrafya" in payload construction
    expect(source).not.toMatch(/universityName:\s*uType\s*===\s*"undergraduate"\s*\?\s*"Diğer"/);
    expect(source).not.toMatch(/departmentName:\s*uType\s*===\s*"undergraduate"\s*\?\s*"Coğrafya"/);
    expect(source).not.toMatch(/gradeLevel:\s*uType\s*===\s*"secondary"\s*\?\s*"KPSS"/);
  });

  it("supports the 4 canonical user roles", () => {
    expect(source).toContain('"secondary"');
    expect(source).toContain('"undergraduate"');
    expect(source).toContain('"graduate"');
    expect(source).toContain('"teacher"');
  });

  it("wires isPasswordPolicyCompliant into validation", () => {
    expect(source).toMatch(/isPasswordPolicyCompliant\(password\)/);
  });

  it("has field-specific aria-invalid attributes", () => {
    expect(source).toContain("fieldErrors.firstName");
    expect(source).toContain("fieldErrors.lastName");
    expect(source).toContain("fieldErrors.email");
    expect(source).toContain("fieldErrors.phone");
    expect(source).toContain("fieldErrors.password");
  });
});
