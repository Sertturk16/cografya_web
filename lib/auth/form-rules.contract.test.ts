import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EMAIL_MAX,
  FIRST_NAME_MAX,
  LAST_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PLATE_CODE_PATTERN,
} from "./form-rules";

/**
 * Contract-derived constants gate (plan §9 G2 — the CONSTANTS half only in PR-1; the
 * payload-shape half joins in PR-2 once `buildRegisterPayload` exists, per the plan's own
 * PR split).
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

function registerProperties(): Record<string, PropertySchema> {
  const root = openapi as { components: { schemas: Record<string, unknown> } };
  const dto = root.components.schemas.RegisterRequestDto as {
    properties: Record<string, PropertySchema>;
  };
  return dto.properties;
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
