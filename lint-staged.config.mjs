/**
 * lint-staged runs on staged files only.
 *
 * TypeScript type-checking cannot run per-file (it needs the whole project +
 * tsconfig), so `tsc --noEmit` is returned from a function that ignores the
 * matched filenames and runs once, project-wide, whenever any *.ts/*.tsx is staged.
 *
 * @type {import("lint-staged").Configuration}
 */
const config = {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write", () => "tsc --noEmit"],
  "*.{js,cjs,mjs,json,css,md,yml,yaml}": ["prettier --write"],
};

export default config;
