import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every file the maintained docs name exists.
 *
 * `CLAUDE.md`, `README.md` and `docs/*.md` tell the next reader where to look. A backticked
 * path to a deleted file (`GLOSSARY.md`, a removed component) or a glob that matches nothing
 * (`*.structure.test.tsx` when every such file is `.ts`) sends them nowhere, and nothing else
 * notices. `docs/superpowers/**` is a historical record and is not checked.
 *
 * A reference counts when it is backticked and ends in a source or doc extension. It resolves
 * against the repo root, `docs/`, the workspace root, or, for a bare file name, any file of that
 * name in the repo. A `*` makes it a glob that must match at least one file name.
 */

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = join(repoRoot, "..");

const DOCS = [
  "CLAUDE.md",
  "README.md",
  ...readdirSync(join(repoRoot, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
];

/**
 * Names the docs mention on purpose although they do not exist here: deleted files named as
 * history, and files that live only on a developer's machine.
 */
const ALLOWED_MISSING: Record<string, string> = {
  ".env.prod": "production secrets on the host, never committed",
  "DESIGN.md": "CLAUDE.md forbids creating one; docs/design.md plays that role",
  "PRODUCT.md": "impeccable's name for docs/product.md",
  "foo.test.ts": "conventions.md: an example name, not a file",
  "shadcn/tailwind.css":
    "a package import specifier (app/globals.css), resolved by shadcn's exports",
  "app/layout.tsx": "architecture.md: stated as absent on purpose",
  "redirects.ts": "architecture.md: stated as absent on purpose",
  "*.module.css": "architecture.md/conventions.md: CSS Modules are gone and must stay gone",
  "components/orphan-stylesheets.test.ts": "architecture.md: deleted with the last CSS Module",
  "orphan-stylesheets.test.ts": "conventions.md: the same deleted test, by file name",
  "components/map/map.module.css": "architecture.md: deleted, history of the orphan test",
  "locator-map.module.css": "architecture.md: deleted, history of the orphan test",
  "climate.module.css": "conventions.md: deleted, history of an overflow fix",
  "components/css-module-fixed-widths.test.ts": "conventions.md: deleted census, history",
  "araclar/tools.module.css": "design.md: deleted in T-032, history",
  "ENGINEERING.md": "conventions.md: named as a deleted doc comments must not cite",
  "CONVENTIONS.md": "conventions.md: named as a deleted doc comments must not cite",
};

const REF = /`([^`\s<>{}$…]+\.(?:md|ts|tsx|mjs|js|json|css|yml|yaml))`/g;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "ds-bundle"]);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const allFiles = walk(repoRoot);
const allNames = new Set(allFiles.map((f) => basename(f)));

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*+/g, ".*");
  return new RegExp(`${escaped}$`);
}

/** Whether `ref` names something that exists. */
function resolves(ref: string): boolean {
  // An extension alone (`.test.ts`) or a URL / container path (`/kitaplar/README.md`) is not a
  // repo file reference.
  if (ref.startsWith(".") && !ref.startsWith("./")) return true;
  if (ref.startsWith("/")) return true;
  if (ref.includes("*")) {
    const pattern = globToRegExp(ref.replace(/^.*\*\*\//, ""));
    return allFiles.some((f) => pattern.test(f.slice(repoRoot.length)));
  }
  const clean = ref.replace(/^\.\//, "").replace(/:\d+(-\d+)?$/, "");
  if (!clean.includes("/")) return allNames.has(clean) || existsSync(join(workspaceRoot, clean));
  return (
    [repoRoot, join(repoRoot, "docs"), workspaceRoot].some((base) =>
      existsSync(join(base, clean)),
    ) ||
    // A path written relative to where it lives (`earthquakes/route.ts` under `app/api/`).
    allFiles.some((f) => f.endsWith(`/${clean}`))
  );
}

/** Backticked references in `markdown` that resolve to nothing. */
function missing(markdown: string): string[] {
  return [...markdown.matchAll(REF)]
    .map((m) => m[1] ?? "")
    .filter((ref) => !(ref in ALLOWED_MISSING) && !resolves(ref));
}

describe("doc references", () => {
  it("flags a missing file and an empty glob, and accepts real ones (control)", () => {
    expect(missing("see `GLOSSARY.md` and `components/nope.tsx`")).toEqual([
      "GLOSSARY.md",
      "components/nope.tsx",
    ]);
    expect(missing("tests are `*.structure.test.tsx`")).toEqual(["*.structure.test.tsx"]);
    expect(missing("`app/globals.css`, `*.structure.test.ts`, `copy.md`, `README.md`")).toEqual([]);
  });

  it.each(DOCS)("%s names only files that exist", (doc) => {
    expect(missing(readFileSync(join(repoRoot, doc), "utf8"))).toEqual([]);
  });
});
