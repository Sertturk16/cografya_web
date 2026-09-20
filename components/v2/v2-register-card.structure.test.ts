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

  it("derives role labels from canonical USER_TYPE_LABELS (CODE125-I3, VAL126R2SEC-I3)", () => {
    expect(source).toContain("USER_TYPE_LABELS.student.tr");
    expect(source).toContain("USER_TYPE_LABELS.teacher.tr");
    // DEC 2026-09-03a md.1 / VAL126R2SEC-I3: V2 registration collects accountRole only; the three
    // education-level options moved to the post-registration profile step.
    expect(source).not.toContain("USER_TYPE_LABELS.secondary.tr");
    expect(source).not.toContain("USER_TYPE_LABELS.undergraduate.tr");
    expect(source).not.toContain("USER_TYPE_LABELS.graduate.tr");
  });

  /**
   * REVERSED BY T-061, deliberately, and rewritten rather than deleted.
   *
   * This case used to assert that registration stayed MINIMAL — no education inputs at all
   * (`DEC 2026-09-03a` md.1, `FU125SEC-I1`). That decision produced an account that was
   * always incomplete on day one and a "Profilini tamamla" screen to finish it, and the
   * owner retired it: a student now declares their education in step 2 of the wizard.
   *
   * Note that the old assertions would still PASS today, vacuously — the fieldset's ids are
   * `v2-register-education-grade-level`, not `v2-register-grade`. A test whose name claims
   * the opposite of what the product does and stays green on a technicality is worse than
   * no test, so what it pins now is the shape that replaced it.
   */
  it("asks a student for their education in step 2, through the shared fieldset (T-061)", () => {
    expect(source).toContain('from "./education-fieldset"');
    expect(source).toContain('idPrefix="v2-register-education"');
    // The fields are not re-spelled here — the settings page renders the same component.
    expect(source).not.toContain("UNIVERSITY_GROUP_LABELS");
    expect(source).not.toContain("/api/reference/universities");

    // No hardcoded dummy strings in source
    expect(source).not.toContain('"Diğer"');
    expect(source).not.toContain('"Coğrafya"');
    expect(source).not.toContain('"KPSS"');
  });

  it("never shows the education step to a teacher, and never sends them an education field", () => {
    // The API's profile matrix rejects a TEACHER carrying any education field, so the step
    // is skipped AND the payload branch is empty — two separate guarantees, both pinned.
    expect(source).toContain('if (selectedRole !== "teacher") {\n      setStep("education");');
    expect(source).toContain('...(selectedRole === "teacher"\n          ? {}');
    expect(source).toContain('if (role === "teacher") return "teacher";');
  });

  it("registers from ONE call site, so both steps build the payload the same way", () => {
    // A second `submitAuth("register", …)` is a second chance for one path to send a shape
    // the profile matrix refuses.
    const registerCalls = source.match(/submitAuth\(\s*"register"/g) ?? [];
    expect(registerCalls).toHaveLength(1);
  });

  it("lands a verified member on the hub, not on the retired profile page", () => {
    expect(source).toContain('getPathname({ locale, href: "/hesabim" })');
    expect(source).not.toContain('href: "/profil"');
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

  it("every FIELD_ELEMENT_IDS value matches a real element id in the component (TA126R2-I1)", () => {
    const block = source.match(
      /const FIELD_ELEMENT_IDS: Record<FieldKey, string> = \{([\s\S]*?)\};/,
    );
    expect(block).not.toBeNull();
    const ids = [...(block?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
    // Positive control: all seven FieldKeys are present, so a shrunken regex cannot make the
    // loop below vacuous.
    expect(ids).toHaveLength(7);
    for (const id of ids) {
      expect(
        source,
        `FIELD_ELEMENT_IDS carries "${id}" but no element renders id="${id}"`,
      ).toContain(`id="${id}"`);
    }
  });

  it("enforces 60-second cooldown on resend verification code (SEC126-I1)", () => {
    expect(source).toContain("resendCooldown");
    expect(source).toContain("setResendCooldown(60)");
    // VAL126R2SEC-I1: the resend control has its own in-flight flag, so a resend no longer
    // disables the verify code input and the primary "Kodu Doğrula ve Başla" button.
    expect(source).toContain("disabled={resendLoading || resendCooldown > 0}");
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
