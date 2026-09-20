import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildRegisterPayload,
  EMAIL_MAX,
  FIRST_NAME_MAX,
  LAST_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PLATE_CODE_PATTERN,
  type RegisterFormState,
} from "./form-rules";

/**
 * Contract-derived constants gate (plan §9 G2 — the CONSTANTS half, PR-1) plus the
 * payload-shape half (PR-2, `buildRegisterPayload` now exists).
 *
 * Reads the COMMITTED `openapi/openapi.json` directly — not `lib/api/schema.ts`, which is
 * codegen output and carries no `maxLength`/`minLength`/`pattern` JSON-Schema facets at all
 * (`openapi-typescript` does not surface them in the generated TypeScript type). Derivation,
 * not duplication: a spec bump that changes a bound turns this red instead of leaving the
 * browser silently refusing something the api now accepts, or accepting something it now
 * refuses.
 */
interface PropertySchema {
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly pattern?: string;
}

const openapiPath = fileURLToPath(new URL("../../openapi/openapi.json", import.meta.url));
const openapi: unknown = JSON.parse(readFileSync(openapiPath, "utf8"));

function registerSchema(): {
  properties: Record<string, PropertySchema>;
  required: readonly string[];
} {
  const root = openapi as { components: { schemas: Record<string, unknown> } };
  return root.components.schemas.RegisterRequestDto as {
    properties: Record<string, PropertySchema>;
    required: readonly string[];
  };
}

function registerProperties(): Record<string, PropertySchema> {
  return registerSchema().properties;
}

describe("form-rules constants agree with the committed contract", () => {
  const properties = registerProperties();

  it("positive control — the schema actually carries facets", () => {
    // Anchors the read: if this fails, the JSON shape changed and every assertion below
    // would otherwise pass on `undefined === undefined`.
    expect(properties.email?.maxLength).toBeTypeOf("number");
  });

  it("FIRST_NAME_MAX matches RegisterRequestDto.firstName.maxLength", () => {
    expect(properties.firstName?.maxLength).toBe(FIRST_NAME_MAX);
  });

  it("LAST_NAME_MAX matches RegisterRequestDto.lastName.maxLength", () => {
    expect(properties.lastName?.maxLength).toBe(LAST_NAME_MAX);
  });

  it("EMAIL_MAX matches RegisterRequestDto.email.maxLength", () => {
    expect(properties.email?.maxLength).toBe(EMAIL_MAX);
  });

  it("PASSWORD_MIN matches RegisterRequestDto.password.minLength", () => {
    expect(properties.password?.minLength).toBe(PASSWORD_MIN);
  });

  it("PASSWORD_MAX matches RegisterRequestDto.password.maxLength", () => {
    expect(properties.password?.maxLength).toBe(PASSWORD_MAX);
  });

  it("PLATE_CODE_PATTERN matches RegisterRequestDto.provincePlateCode.pattern", () => {
    expect(properties.provincePlateCode?.pattern).toBe(PLATE_CODE_PATTERN.source);
  });
});

/**
 * G2's PAYLOAD-SHAPE half (plan §9, PR-2): for each of the five user types,
 * `buildRegisterPayload`'s key set is a SUBSET of `RegisterRequestDto.properties` — the
 * `forbidNonWhitelisted` guard, and what makes it impossible to ship `passwordConfirm` in
 * the body — and a SUPERSET of the DTO's `required` array. Both sides are read out of the
 * spec, not typed into the test (the same derivation-not-duplication reasoning as the
 * constants half above).
 */
describe("buildRegisterPayload key sets agree with the committed contract", () => {
  const { properties, required } = registerSchema();
  const declaredKeys = new Set(Object.keys(properties));
  const locale = "tr" as const;

  const COMMON: Omit<
    RegisterFormState,
    "userType" | "gradeLevel" | "studyStream" | "schoolName" | "universityName" | "departmentName"
  > = {
    firstName: "Ayşe",
    lastName: "Yılmaz",
    phone: "+905551234567",
    email: "reader@example.test",
    password: "Aa123456",
    passwordConfirm: "Aa123456",
    provincePlateCode: "34",
    districtId: "6b3f6f5a-6f5a-4f5a-8f5a-6f5a6f5a6f5a",
  };

  const FIXTURES: Record<string, RegisterFormState> = {
    secondary: {
      ...COMMON,
      userType: "secondary",
      gradeLevel: "GRADE_12",
      studyStream: "SAYISAL",
      universityName: "",
      departmentName: "",
    },
    // T-061: `schoolName` is optional INSIDE the SECONDARY branch and forbidden on every
    // other one, so both spellings need a fixture — present, and absent-as-empty-string.
    "secondary (with school)": {
      ...COMMON,
      userType: "secondary",
      gradeLevel: "GRADE_12",
      studyStream: "SAYISAL",
      schoolName: "Synthetic Lisesi",
      universityName: "",
      departmentName: "",
    },
    "secondary (school left blank)": {
      ...COMMON,
      userType: "secondary",
      gradeLevel: "GRADE_12",
      studyStream: "SAYISAL",
      schoolName: "   ",
      universityName: "",
      departmentName: "",
    },
    // A teacher's form state can carry a stale `schoolName` if someone flips the role after
    // filling the student branch; the payload must still not have the key.
    "teacher (stale schoolName in form state)": {
      ...COMMON,
      userType: "teacher",
      schoolName: "Synthetic Lisesi",
    },
    undergraduate: {
      ...COMMON,
      userType: "undergraduate",
      gradeLevel: "",
      studyStream: "",
      universityName: "Boğaziçi Üniversitesi",
      departmentName: "Coğrafya Öğretmenliği",
    },
    "graduate (with department)": {
      ...COMMON,
      userType: "graduate",
      gradeLevel: "",
      studyStream: "",
      universityName: "Boğaziçi Üniversitesi",
      departmentName: "Coğrafya Öğretmenliği",
    },
    "graduate (department omitted)": {
      ...COMMON,
      userType: "graduate",
      gradeLevel: "",
      studyStream: "",
      universityName: "Boğaziçi Üniversitesi",
      departmentName: "",
    },
    teacher: {
      ...COMMON,
      userType: "teacher",
      gradeLevel: "",
      studyStream: "",
      universityName: "",
      departmentName: "",
    },
    "student (minimal V2 registration)": {
      ...COMMON,
      userType: "student",
    },
    // Kept alongside the branch above on purpose: this one pins the DEFENSIVE collapse of the
    // `secondary` branch when its education fields are absent — a different, still-live path.
    "minimal student (education fields omitted)": {
      ...COMMON,
      userType: "secondary",
    },
  };

  it("positive control — the schema's own required array is non-empty", () => {
    // Anchors the superset assertion below: if this fails, `required` is empty and every
    // fixture would pass the superset check vacuously.
    expect(required.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(FIXTURES))(
    "%s: key set is a subset of the declared properties",
    (_label, state) => {
      const payload = buildRegisterPayload(state, locale);
      for (const key of Object.keys(payload)) {
        expect(
          declaredKeys.has(key),
          `unexpected key "${key}" — not in RegisterRequestDto.properties`,
        ).toBe(true);
      }
    },
  );

  it.each(Object.entries(FIXTURES))(
    "%s: key set is a superset of the required array",
    (_label, state) => {
      const payload = buildRegisterPayload(state, locale);
      const keys = new Set(Object.keys(payload));
      for (const requiredKey of required) {
        expect(keys.has(requiredKey), `missing required key "${requiredKey}"`).toBe(true);
      }
    },
  );

  it("teacher carries no educationLevel key at all, not even undefined", () => {
    const payload = buildRegisterPayload(FIXTURES.teacher as RegisterFormState, locale);
    expect(Object.hasOwn(payload, "educationLevel")).toBe(false);
  });

  it("graduate with an empty department omits departmentName entirely", () => {
    const payload = buildRegisterPayload(
      FIXTURES["graduate (department omitted)"] as RegisterFormState,
      locale,
    );
    expect(Object.hasOwn(payload, "departmentName")).toBe(false);
  });

  it("secondary carries gradeLevel and studyStream", () => {
    const payload = buildRegisterPayload(FIXTURES.secondary as RegisterFormState, locale);
    expect(payload).toMatchObject({ gradeLevel: "GRADE_12", studyStream: "SAYISAL" });
  });

  it("secondary carries a trimmed schoolName when one is given, and no key when it is blank", () => {
    const withSchool = buildRegisterPayload(
      FIXTURES["secondary (with school)"] as RegisterFormState,
      locale,
    );
    expect(withSchool).toMatchObject({ schoolName: "Synthetic Lisesi" });

    // Whitespace is not a school name. An empty-string key would be a value the matrix
    // accepts on this branch and rejects on every other, which is how it leaks.
    const blank = buildRegisterPayload(
      FIXTURES["secondary (school left blank)"] as RegisterFormState,
      locale,
    );
    expect(Object.hasOwn(blank, "schoolName")).toBe(false);
  });

  it("a teacher carries no schoolName even when the form state still holds one", () => {
    // Flipping the role after filling the student branch leaves the value in state. The
    // payload builder switches on `userType`, so the teacher branch never reads it.
    const payload = buildRegisterPayload(
      FIXTURES["teacher (stale schoolName in form state)"] as RegisterFormState,
      locale,
    );
    expect(Object.hasOwn(payload, "schoolName")).toBe(false);
  });

  const EDUCATION_KEYS = [
    "educationLevel",
    "gradeLevel",
    "studyStream",
    // T-061 added the sixth. It belongs in this list for the same reason the other five do:
    // the profile matrix forbids it outside the SECONDARY branch, and a subset check alone
    // would not notice it leaking — `schoolName` IS a declared contract property.
    "schoolName",
    "universityName",
    "departmentName",
  ] as const;

  it("no minimal-registration payload carries any of the five education keys (CROSS126-I2)", () => {
    // Positive control: the same probe returns true on a fixture that genuinely declares a
    // level, so a `false` below is a real absence, not a blind check.
    const secondaryPayload = buildRegisterPayload(FIXTURES.secondary as RegisterFormState, locale);
    expect(Object.hasOwn(secondaryPayload, "educationLevel")).toBe(true);

    for (const name of [
      "student (minimal V2 registration)",
      "minimal student (education fields omitted)",
    ]) {
      const payload = buildRegisterPayload(FIXTURES[name] as RegisterFormState, locale);
      for (const key of EDUCATION_KEYS) {
        expect(Object.hasOwn(payload, key), `${name}: unexpected education key "${key}"`).toBe(
          false,
        );
      }
    }
  });
});
