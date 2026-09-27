// @ts-check
/**
 * The web half of the cross-repo contract: the API repo owns `openapi/openapi.json`, the web
 * keeps a byte-identical copy in its own `openapi/openapi.json` and codegens `lib/api/schema.ts`
 * from it. `scripts/sync-contract.mjs` refreshes the copy, `scripts/check-contract.mjs` fails
 * when it has drifted. Both locate the API checkout through `findApiRepo`.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const API_PACKAGE_NAME = "cografya-api";

/**
 * The API checkout: `COGRAFYA_API_DIR` when set (CI checks the API out inside the web tree),
 * otherwise the `cografya_api` sibling of the web repo, which is the workspace layout.
 *
 * @param {string} webRoot absolute path of the web repo
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function findApiRepo(webRoot, env) {
  const dir = env.COGRAFYA_API_DIR
    ? path.resolve(env.COGRAFYA_API_DIR)
    : path.resolve(webRoot, "..", "cografya_api");
  const pkgPath = path.join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    throw new Error(
      `cografya_api not found at ${dir}.\n` +
        "Check the API repo out next to this one " +
        "(git clone https://github.com/Sertturk16/cografya_api.git ../cografya_api) " +
        "or point COGRAFYA_API_DIR at it.",
    );
  }
  const name = JSON.parse(readFileSync(pkgPath, "utf8")).name;
  if (name !== API_PACKAGE_NAME) {
    throw new Error(
      `${dir} is not the API repo (package name "${name}", expected "${API_PACKAGE_NAME}").`,
    );
  }
  return dir;
}

/**
 * Compares the web copy with the API's spec. Byte equality is the contract (`codegen:check`
 * and `openapi:check` both diff bytes); the structural listing only explains a mismatch.
 *
 * @param {string} webText
 * @param {string} apiText
 * @returns {{ inSync: boolean, changes: string[] }}
 */
export function diffContract(webText, apiText) {
  if (webText === apiText) return { inSync: true, changes: [] };

  let web, api;
  try {
    web = JSON.parse(webText);
  } catch {
    return { inSync: false, changes: ["web copy is not valid JSON"] };
  }
  try {
    api = JSON.parse(apiText);
  } catch {
    return { inSync: false, changes: ["API spec is not valid JSON"] };
  }

  const changes = [
    ...diffKeys("path", web.paths ?? {}, api.paths ?? {}),
    ...diffKeys("schema", web.components?.schemas ?? {}, api.components?.schemas ?? {}),
    ...diffKeys("", without(web, "paths", "components"), without(api, "paths", "components")),
    ...diffKeys(
      "components.",
      without(web.components ?? {}, "schemas"),
      without(api.components ?? {}, "schemas"),
    ),
  ];
  if (changes.length === 0) changes.push("formatting only (same JSON, different bytes)");
  return { inSync: false, changes };
}

/**
 * @param {Record<string, unknown>} object
 * @param {string[]} keys
 */
function without(object, ...keys) {
  return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
}

/**
 * @param {string} label
 * @param {Record<string, unknown>} web
 * @param {Record<string, unknown>} api
 */
function diffKeys(label, web, api) {
  const name = (/** @type {string} */ key) =>
    label === "" ? key : label.endsWith(".") ? label + key : `${label} ${key}`;
  const keys = [...new Set([...Object.keys(web), ...Object.keys(api)])].sort();
  /** @type {string[]} */
  const out = [];
  for (const key of keys) {
    if (!(key in api)) out.push(`${name(key)}: removed from the API`);
    else if (!(key in web)) out.push(`${name(key)}: added in the API`);
    else if (JSON.stringify(web[key]) !== JSON.stringify(api[key]))
      out.push(`${name(key)}: changed in the API`);
  }
  return out;
}
