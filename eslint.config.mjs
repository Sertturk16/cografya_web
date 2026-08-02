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
  // `lib/api/schema.ts` is codegen output (openapi-typescript) and all three
  // `lib/map/*.generated.ts` files are generator output (generate:map /
  // generate:world-map / generate:water) — machine-written, never hand-edited, so none
  // is linted. Keep this list in step with `.prettierignore`: lint-staged runs
  // `eslint --fix` and `prettier --write` over staged `*.ts`, so a file missing from
  // EITHER list can be rewritten on commit and turn its `generate:*:check` drift gate
  // red on a file nobody edited.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/api/schema.ts",
    "lib/map/tr-provinces.generated.ts",
    "lib/map/world-countries.generated.ts",
    "lib/map/tr-inland-water.generated.ts",
  ]),
]);

export default eslintConfig;
