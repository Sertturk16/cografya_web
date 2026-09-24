import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import {
  buildRegisterPayload,
  missingRegisterConsents,
  type RegisterFormState,
} from "./form-rules";

/**
 * T-101: the register form asks for two separate things. Accepting the terms is required;
 * commercial electronic messages are an optional consent that must never block registration
 * and must never be pre-ticked.
 */
const TEACHER: RegisterFormState = {
  firstName: "Ayşe",
  lastName: "Yılmaz",
  phone: "+905551234567",
  email: "reader@example.test",
  password: "Aa123456",
  passwordConfirm: "Aa123456",
  userType: "teacher",
  provincePlateCode: "34",
  districtId: "6b3f6f5a-6f5a-4f5a-8f5a-6f5a6f5a6f5a",
  termsAccepted: true,
  marketingConsent: false,
};

describe("register consents", () => {
  it("requires the terms", () => {
    expect(missingRegisterConsents({ termsAccepted: false, marketingConsent: false })).toEqual([
      "termsAccepted",
    ]);
    expect(missingRegisterConsents({ termsAccepted: false, marketingConsent: true })).toEqual([
      "termsAccepted",
    ]);
  });

  it("never requires marketing consent", () => {
    expect(missingRegisterConsents({ termsAccepted: true, marketingConsent: false })).toEqual([]);
  });

  it("sends marketingConsent as given, false included", () => {
    expect(buildRegisterPayload(TEACHER, "tr").marketingConsent).toBe(false);
    expect(
      buildRegisterPayload({ ...TEACHER, marketingConsent: true }, "tr").marketingConsent,
    ).toBe(true);
  });

  it("does not send termsAccepted to the API", () => {
    expect(Object.hasOwn(buildRegisterPayload(TEACHER, "tr"), "termsAccepted")).toBe(false);
  });
});

describe("the register card's consent controls", () => {
  const cardPath = fileURLToPath(
    new URL("../../components/v2/v2-register-card.tsx", import.meta.url),
  );
  const CARD = stripComments(readFileSync(cardPath, "utf8"));

  it("starts both boxes unticked", () => {
    expect(CARD).toContain("const [termsAccepted, setTermsAccepted] = React.useState(false);");
    expect(CARD).toContain(
      "const [marketingConsent, setMarketingConsent] = React.useState(false);",
    );
  });

  it("checks the terms through the shared rule before submitting", () => {
    expect(CARD).toContain("missingRegisterConsents(");
  });

  it("links the privacy notice as information, not as a second thing to accept", () => {
    expect(CARD).toContain('href="/gizlilik"');
    expect(CARD).not.toContain("PRIVACY_ANCHOR");
  });
});
