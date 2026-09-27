// @ts-check
/**
 * `pnpm contract:check`: fails when this repo's `openapi/openapi.json` is not byte-identical to
 * the API checkout's committed spec, i.e. when the web codegens from a stale contract.
 * `codegen:check` cannot see this: it only proves `schema.ts` matches the web's own copy.
 *
 * Locally the API checkout is the `cografya_api` sibling; CI checks the API out and sets
 * `COGRAFYA_API_DIR` (`.github/workflows/contract.yml`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { diffContract, findApiRepo } from "./lib/contract.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SPEC = path.join("openapi", "openapi.json");

let apiRoot;
try {
  apiRoot = findApiRepo(WEB_ROOT, process.env);
} catch (error) {
  console.error(`contract:check: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const { inSync, changes } = diffContract(
  readFileSync(path.join(WEB_ROOT, SPEC), "utf8"),
  readFileSync(path.join(apiRoot, SPEC), "utf8"),
);

if (inSync) {
  console.log(`contract:check: ${SPEC} matches ${path.join(apiRoot, SPEC)}`);
} else {
  console.error(`contract:check: ${SPEC} is stale against ${path.join(apiRoot, SPEC)}:`);
  for (const change of changes) console.error(`  - ${change}`);
  console.error("Run `pnpm contract:sync` and commit openapi/openapi.json and lib/api/schema.ts.");
  process.exit(1);
}
