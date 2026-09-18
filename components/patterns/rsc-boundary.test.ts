import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { repoRoot, walk, runtimeImportsOf } from "@/lib/test-support/import-closure";

/**
 * NO CLIENT COMPONENT MAY TRANSITIVELY REACH A `server-only` MODULE.
 *
 * ## The regression this closes
 *
 * `components/patterns/breadcrumbs.tsx` (Task 6) exported one `Breadcrumbs` that rendered a
 * visible `<nav>` AND the matching `BreadcrumbList` JSON-LD, the second half built from
 * `lib/seo/json-ld`, whose first line is `import "server-only"`. Task 7 then rendered that
 * component from two Client Components (`v2-game-screen.tsx`,
 * `v2-sea-basin-detail-view.tsx`), and the `/design-system` specimen (`duzen.tsx`) rendered it
 * from a third. `pnpm build` fails on this deterministically —
 * `'server-only' cannot be imported from a Client Component module` — but `pnpm build` was
 * forbidden during those two tasks (the orchestrator's own error, recorded in
 * `docs/architecture.md`), so nothing ran it and the break shipped through three tasks.
 * Nothing else in the suite would have caught it either: `vitest` runs in `node` env
 * (`vitest.config.ts`), where `server-only`'s own runtime guard (`typeof window ===
 * 'undefined'`) never throws — the failure is a Turbopack/webpack BUILD-time module-graph
 * check, invisible to every unit test that renders these components directly.
 *
 * ## Why this is a graph walk and not a grep
 *
 * A repo-wide `grep 'import "server-only"'` inside a `"use client"` file would read zero here
 * even on the exact regression above: no client FILE ever wrote that import literally. The
 * chain was always indirect — `v2-sea-basin-detail-view.tsx` (client) imported `Breadcrumbs`
 * from `breadcrumbs.tsx`, and `breadcrumbs.tsx` imported `breadcrumbJsonLd`/`JsonLd` from
 * `json-ld.tsx`, which is where the literal import lives. `components/orphan.test.ts`
 * already solved the general form of this problem — "what does a file really reach, through
 * however many intermediate modules" — for a different question (does a primitive have a
 * product call site). Its resolver (`walk`/`resolveSpecifier`) is extracted to
 * `lib/test-support/import-closure.ts` and reused here rather than rewritten, per the same
 * principle that resolver embodies: one graph walk, not a second copy that can drift from the
 * first.
 *
 * The type-erasure rule this test needed is now the resolver's only rule, and T-042 is why.
 * `lib/auth/submit.client.ts` (`"use client"`) writes `import type { AuthBffCode } from
 * "./transport.server"`, and `transport.server.ts` carries `import "server-only"`, yet
 * `pnpm build` passes: a type-only import compiles to nothing, so it is not a real edge in the
 * graph a bundler actually builds. `runtimeImportsOf` is the type-erasure-aware reader this test
 * uses — measured against the live tree before it existed: swapping it in dropped 21 files this
 * scanner had wrongly flagged, every one of them a type-only `…transport.server` import, none of
 * them a real `pnpm build` failure. `orphan.test.ts` used to walk type edges too, on the
 * reasoning that over-following one "only widens a reachability set and can never hide a real
 * orphan"; that is exactly backwards for a reachability question, and `closureFrom` now walks
 * the same runtime edges this file does.
 *
 * ## Why the split fix is TWO FILES, not two exports in one
 *
 * The first fix attempt kept `BreadcrumbsNav` and `Breadcrumbs` as two exports of the SAME
 * `breadcrumbs.tsx`. `pnpm build` still failed, identically — Turbopack's Client/Server
 * boundary check is per MODULE, not per export: a file that imports `lib/seo/json-ld`
 * ANYWHERE in it poisons every consumer of that file, including one that only ever imports the
 * other export. `components/patterns/breadcrumbs-nav.tsx` exists as its own file for exactly
 * this reason (see its own docblock) — proof, not assertion, that the fix has to draw the line
 * at the FILE boundary, which is also why this test walks files, never exports.
 */

/**
 * The product surface, PLUS the showcase — deliberately wider than
 * `components/orphan.test.ts`'s `PRODUCT_ROOTS`. That file excludes `/design-system` on
 * purpose, for a question where showcase-only reachability is the thing being measured. This
 * scanner asks a different question — "does `pnpm build` break" — and `/design-system` is a
 * real route Next.js actually compiles: one of the THREE original offenders,
 * `components/showcase/specimens/duzen.tsx`, lived there. Excluding it here would have left a
 * third of the regression this test exists to catch permanently invisible to it.
 */
const PRODUCT_ROOTS = [
  "app/[locale]/layout.tsx",
  "app/[locale]/(site)",
  "app/[locale]/(play)",
  "components/v2",
  "components/patterns",
  "components/air",
  "components/book",
  "components/climate",
  "components/earthquake",
  "components/game",
  "components/home",
  "components/map",
  "components/marine",
  "components/site-search",
] as const;

const SHOWCASE_ROOTS = ["app/[locale]/design-system", "components/showcase"] as const;

/**
 * `components/orphan.test.ts` audits `components/**` rather than rooting at it — every file
 * there is the TARGET of that test's question ("is this component reachable"), never a root to
 * walk outward from. That is correct there and wrong here: a `"use client"`
 * file that lives IN `components/ui` reaching `server-only` is exactly as fatal to `pnpm build`
 * as one under `components/v2`, and nine of `components/ui`'s files carry the directive today
 * (`accordion`, `custom-select`, `dialog`, `progress`, `sheet`, `sonner`, `table`, `tabs`,
 * `tooltip`). Found by review round 1 walking all 12 files this list closes the gap on by
 * hand and confirming them clean — this list is what makes that a standing guarantee instead of
 * a one-time check. `components/theme-provider.tsx`, `app/global-error.tsx` and
 * `app/not-found.tsx` are the other three: real, always-mounted files with no home in either
 * `PRODUCT_ROOTS` or `SHOWCASE_ROOTS` (the app-root special files sit ABOVE
 * `app/[locale]`, the same reason `orphan.test.ts` roots `app/[locale]/layout.tsx` explicitly
 * rather than relying on a root that would miss it).
 */
const ROOT_LEVEL_ROOTS = [
  "components/ui",
  "components/theme-provider.tsx",
  "app/global-error.tsx",
  "app/not-found.tsx",
] as const;

const SCAN_ROOTS = [...PRODUCT_ROOTS, ...SHOWCASE_ROOTS, ...ROOT_LEVEL_ROOTS] as const;

const label = (path: string) => relative(repoRoot, path);
const sourceOf = (path: string) => stripComments(readFileSync(path, "utf8"));

/**
 * Next.js's own rule for the directive: it must be the file's FIRST statement. Checked against
 * the raw source, anchored at the very start (`trimStart()`, nothing else) — never a substring
 * search — so a docblock that merely QUOTES `"use client"` in prose is never mistaken for the
 * real thing. Not hypothetical: `components/patterns/breadcrumbs-nav.tsx`'s own docblock (this
 * file's neighbour) does exactly that, narrating this same regression, and is a live negative
 * control below.
 */
function isClientFile(path: string): boolean {
  const raw = readFileSync(path, "utf8").trimStart();
  return raw.startsWith('"use client"') || raw.startsWith("'use client'");
}

const SERVER_ONLY_IMPORT = /import\s+["']server-only["']/;

/** Whether `path` ITSELF, directly, writes the literal `server-only` poison-pill import. */
function importsServerOnlyDirectly(path: string): boolean {
  return SERVER_ONLY_IMPORT.test(sourceOf(path));
}

function surfaceFiles(): string[] {
  return SCAN_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)));
}

function clientFilesOnSurface(): string[] {
  return surfaceFiles().filter(isClientFile).sort();
}

/**
 * Breadth-first from `start` over the real RUNTIME import graph (`runtimeImportsOf`, from
 * `lib/test-support/import-closure.ts` — type-erasure-aware, see the file docblock above for
 * why the plain `importsOf` `orphan.test.ts` uses is the wrong tool here). Returns the shortest
 * file-to-file chain from `start` to the first module that directly imports `server-only`, or
 * `null` if none exists. `start` itself is checked first: a client file that writes the literal
 * import itself is the same bug, one hop shorter.
 */
function findServerOnlyChain(start: string): string[] | null {
  const cameFrom = new Map<string, string | null>([[start, null]]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (importsServerOnlyDirectly(current)) {
      const chain: string[] = [];
      let node: string | null = current;
      while (node !== null) {
        chain.unshift(node);
        node = cameFrom.get(node) ?? null;
      }
      return chain;
    }
    for (const next of runtimeImportsOf(current)) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, current);
      queue.push(next);
    }
  }
  return null;
}

describe("the RSC-boundary scanner itself", () => {
  // ANTI-VACUITY, same idea as orphan.test.ts's own "the import closure itself" block: every
  // assertion in the describe block below is "no offenders found", which a broken scanner
  // (an empty walk, a resolver that never resolves, a regex that never matches) would also
  // report. These prove the machinery underneath actually ran and actually works, on the real
  // tree, before the silence below is trusted.

  it("walked a real, non-trivial slice of the surface", () => {
    expect(surfaceFiles().length).toBeGreaterThan(150);
  });

  it('found real "use client" files on it, components/ui/ included', () => {
    // Measured against the live tree after `ROOT_LEVEL_ROOTS` closed the gap review round 1
    // found: 60 today (up from the ~40 `PRODUCT_ROOTS` + `SHOWCASE_ROOTS` alone would find),
    // components/ui/'s 9 included.
    expect(clientFilesOnSurface().length).toBeGreaterThan(40);
    expect(clientFilesOnSurface().map(label)).toContain("components/ui/dialog.tsx");
  });

  it("recognizes a real client file — positive control", () => {
    expect(isClientFile(join(repoRoot, "components/v2/v2-game-screen.tsx"))).toBe(true);
  });

  it("does not fire on a real server file — negative control", () => {
    expect(isClientFile(join(repoRoot, "components/patterns/breadcrumbs.tsx"))).toBe(false);
  });

  it("only the file's first statement counts, not the string appearing anywhere in it", () => {
    // `breadcrumbs-nav.tsx` narrates this exact regression in its own docblock, quoting
    // `"use client"` verbatim, without being one. If the check were a substring search instead
    // of an anchor, this file would be the first false positive it produced.
    expect(isClientFile(join(repoRoot, "components/patterns/breadcrumbs-nav.tsx"))).toBe(false);
  });

  it("recognizes the real server-only import in lib/seo/json-ld.tsx — positive control", () => {
    expect(importsServerOnlyDirectly(join(repoRoot, "lib/seo/json-ld.tsx"))).toBe(true);
  });

  it("does not fire on a file that only imports FROM a server-only module — negative control", () => {
    // `breadcrumbs.tsx` imports `breadcrumbJsonLd`/`JsonLd` FROM `json-ld.tsx`; it never writes
    // the literal `import "server-only"` line itself. Telling these apart is the entire reason
    // this is a graph walk and not a repo-wide grep (see the file docblock above).
    expect(importsServerOnlyDirectly(join(repoRoot, "components/patterns/breadcrumbs.tsx"))).toBe(
      false,
    );
  });

  it("a docblock quoting the import string does not count — comment stripping applied", () => {
    const stripped = stripComments('// import "server-only" — legacy note, not live code');
    expect(SERVER_ONLY_IMPORT.test(stripped)).toBe(false);
  });

  it("resolves a real DIRECT edge — breadcrumbs.tsx to lib/seo/json-ld.tsx", () => {
    // `Breadcrumbs` imports `breadcrumbJsonLd`/`JsonLd` from `json-ld.tsx` directly — one real
    // hop, and deterministic (unlike a multi-file page, which may have a shorter path to some
    // OTHER server-only module through an unrelated import; the test below covers that shape).
    const chain = findServerOnlyChain(join(repoRoot, "components/patterns/breadcrumbs.tsx"));
    expect(chain?.map(label)).toEqual([
      "components/patterns/breadcrumbs.tsx",
      "lib/seo/json-ld.tsx",
    ]);
  });

  it("resolves a real TRANSITIVE (2+ hop) chain — proof against the live tree, not just a direct edge", () => {
    // `turkiye/page.tsx` (server) imports several modules that each eventually reach a
    // `server-only` file, so the SHORTEST one BFS returns is not pinned exactly here (it can
    // shift as other imports on the page change) — what matters, and IS pinned, is that the
    // walk had to cross at least one intermediate file to get there, and that the file it
    // landed on really does carry the literal import, i.e. the answer is not a stalled
    // one-hop guess.
    const chain = findServerOnlyChain(join(repoRoot, "app/[locale]/(site)/turkiye/page.tsx"));
    expect(chain).not.toBeNull();
    expect(chain!.length).toBeGreaterThan(1);
    const last = chain![chain!.length - 1]!;
    expect(importsServerOnlyDirectly(last)).toBe(true);
  });

  it("finds no chain where none exists — proof null is a real answer, not a stalled walk", () => {
    expect(
      findServerOnlyChain(join(repoRoot, "components/patterns/breadcrumbs-nav.tsx")),
    ).toBeNull();
  });
});

/**
 * "The surface" here is `SCAN_ROOTS`: `PRODUCT_ROOTS` + `SHOWCASE_ROOTS` + `ROOT_LEVEL_ROOTS`.
 * That is every directory Next.js actually compiles into the app except `app/api/**` (BFF route
 * handlers, which run server-only by construction and carry no `"use client"` files) and the
 * five generated artifacts (`lib/api/schema.ts`, `lib/map/*.generated.ts` — not components, and
 * excluded from lint/prettier the same way, `CLAUDE.md`). The describe title says "no client
 * file on the surface" rather than "in the repo" for that reason — a real, named boundary, not
 * an unstated one.
 */
describe("no client file on the surface transitively reaches a server-only module", () => {
  it('every "use client" file\'s import closure is free of server-only', () => {
    const offenders = clientFilesOnSurface()
      .map((file) => ({ file, chain: findServerOnlyChain(file) }))
      .filter((entry): entry is { file: string; chain: string[] } => entry.chain !== null);

    const message = offenders
      .map(
        ({ file, chain }) =>
          `${label(file)} reaches server-only via:\n    ${chain.map(label).join("\n    -> ")}`,
      )
      .join("\n\n");

    expect(
      offenders.map((offender) => label(offender.file)),
      message,
    ).toEqual([]);
  });
});
