// Compiles .design-sync/ds.css (the site's app/globals.css + the next/font variables) with the
// site's own Tailwind v4 PostCSS plugin into .design-sync/ds.compiled.css, the converter's
// cssEntry. Tailwind scans the repo exactly as the Next build does (same @source rules), so the
// output carries every utility the site and the authored previews use.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const from = resolve(here, "ds.css");
const to = resolve(here, "ds.compiled.css");
const result = await postcss([tailwind({ base: root })]).process(readFileSync(from, "utf8"), {
  from,
  to,
});
// The Google Fonts @import must stay first; postcss-import-style hoisting is not applied here,
// so lift it back to the top of the compiled file.
const fontImport = /@import url\("https:\/\/fonts\.googleapis\.com[^;]+;\n?/;
const match = result.css.match(fontImport);
const css = match ? match[0] + result.css.replace(fontImport, "") : result.css;
writeFileSync(to, css);
console.error(`ds.compiled.css: ${(css.length / 1024).toFixed(0)} KB`);
