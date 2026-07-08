import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable ESLint rules that conflict with Prettier (Prettier owns formatting).
  // Must stay last so it can turn the relevant rules off.
  prettier,
  // Explicitly pin build-output / generated files to ignore. Mirrors
  // eslint-config-next's own defaults so they hold regardless of preset changes.
  // `lib/api/schema.ts` is codegen output (openapi-typescript) — never hand-edited
  // and not linted (its shape is owned by the OpenAPI contract, not our style rules).
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "lib/api/schema.ts"]),
]);

export default eslintConfig;
