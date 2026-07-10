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
  // `lib/api/schema.ts` is codegen output (openapi-typescript) and
  // `lib/map/tr-provinces.generated.ts` is generator output (generate:map) — both
  // machine-written, never hand-edited, so neither is linted for style.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/api/schema.ts",
    "lib/map/tr-provinces.generated.ts",
  ]),
]);

export default eslintConfig;
