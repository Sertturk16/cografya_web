// @ts-check
/**
 * Writes the token frontmatter at the top of `docs/design.md` from `app/globals.css`
 * (`scripts/lib/design-tokens.mjs` says what goes in and why). impeccable reads that file as the
 * project's DESIGN.md; the prose below the frontmatter is hand-written and never touched here.
 *
 * `pnpm design:tokens` regenerates; `pnpm design:tokens:check` regenerates and fails on any diff,
 * so a token change in `globals.css` without a regenerate, or a hand-edit of the block, is
 * caught in CI the same way the map artifacts are.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import * as prettier from "prettier";

import { extractTokens, renderFrontmatter, spliceFrontmatter } from "./lib/design-tokens.mjs";

const CSS_PATH = fileURLToPath(new URL("../app/globals.css", import.meta.url));
const DESIGN_PATH = fileURLToPath(new URL("../docs/design.md", import.meta.url));

const css = await readFile(CSS_PATH, "utf8");
const md = await readFile(DESIGN_PATH, "utf8");

const spliced = spliceFrontmatter(md, renderFrontmatter(extractTokens(css)));
const options = await prettier.resolveConfig(DESIGN_PATH);
const next = await prettier.format(spliced, { ...options, filepath: DESIGN_PATH });

if (next !== md) {
  await writeFile(DESIGN_PATH, next);
  console.log("docs/design.md: token frontmatter updated");
} else {
  console.log("docs/design.md: token frontmatter up to date");
}
