// @ts-check
/**
 * `pnpm contract:sync`: the whole API → web contract refresh in one step.
 *
 *   1. `pnpm openapi:generate` in the API checkout (rewrites its committed `openapi/openapi.json`)
 *   2. copy that file over this repo's `openapi/openapi.json`
 *   3. `pnpm codegen` here (rewrites `lib/api/schema.ts`)
 *
 * The API checkout is the `cografya_api` sibling, or `COGRAFYA_API_DIR` (`scripts/lib/contract.mjs`).
 * Nothing is committed: the script ends by listing which of the three files changed, in which repo.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findApiRepo } from "./lib/contract.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SPEC = path.join("openapi", "openapi.json");

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`contract:sync: ${message}`);
  process.exit(1);
}

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function pnpm(cwd, args) {
  console.log(`\n> (${path.basename(cwd)}) pnpm ${args.join(" ")}`);
  const result = spawnSync("pnpm", args, { cwd, stdio: "inherit" });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`pnpm ${args.join(" ")} failed in ${cwd} (exit ${result.status})`);
}

/**
 * @param {string} repo
 * @param {string} file
 */
function isDirty(repo, file) {
  const out = spawnSync("git", ["-C", repo, "status", "--porcelain", "--", file], {
    encoding: "utf8",
  });
  return out.status === 0 && out.stdout.trim() !== "";
}

let apiRoot;
try {
  apiRoot = findApiRepo(WEB_ROOT, process.env);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// EACCES on the API's dist/? Its CLAUDE.md has the chown for the dev container.
pnpm(apiRoot, ["openapi:generate"]);

const from = path.join(apiRoot, SPEC);
const to = path.join(WEB_ROOT, SPEC);
const copied = readFileSync(from, "utf8") !== readFileSync(to, "utf8");
if (copied) copyFileSync(from, to);
console.log(`\n${SPEC}: ${copied ? "copied from the API" : "already identical to the API's"}`);

pnpm(WEB_ROOT, ["codegen"]);

const changed = [
  { repo: apiRoot, file: SPEC },
  { repo: WEB_ROOT, file: SPEC },
  { repo: WEB_ROOT, file: path.join("lib", "api", "schema.ts") },
].filter(({ repo, file }) => isDirty(repo, file));

console.log("");
if (changed.length === 0) {
  console.log("contract:sync: contract unchanged, nothing to commit.");
} else {
  console.log("contract:sync: uncommitted contract changes:");
  for (const { repo, file } of changed) console.log(`  ${path.basename(repo)}/${file}`);
  console.log("Commit the API spec in the API PR and both web files in the web PR.");
}
