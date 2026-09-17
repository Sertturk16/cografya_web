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
    // The fifth generated artifact. `.prettierignore` has carried it since it was generated;
    // this list did not, so `CLAUDE.md`'s "listed in BOTH" rule was half-true and the half that
    // was false is the one that runs in CI. `docs/architecture.md` had it recorded as a known
    // gap — a gap nothing prevented anyone from simply closing.
    "lib/map/tr-context.generated.ts",
    // Subagent worktrees. The agent harness creates full checkouts under `.claude/worktrees/`,
    // inside the repo, so a lint run scans every file two or three more times and reports
    // findings against paths that are copies. One such run produced 1,744 errors, all of them
    // from copies and none from this tree.
    ".claude/**",
  ]),
]);

export default eslintConfig;
