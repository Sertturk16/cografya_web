import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";
import { repoRoot, runtimeImportsOf, walk } from "@/lib/test-support/import-closure";
import { stripComments } from "@/lib/test-support/strip-comments";
import { CLIENT_MESSAGE_NAMESPACES, pickClientMessages } from "./client-messages";

/**
 * THE CLIENT CATALOGUE COVERS EVERY NAMESPACE A CLIENT COMPONENT READS, AND NOTHING ELSE.
 *
 * The locale layout passes `pickClientMessages(messages)` to `NextIntlClientProvider` instead of
 * the whole catalogue, which next-intl otherwise serialises into every page's RSC payload. The
 * cost of a namespace missing from that list is silent: next-intl logs `MISSING_MESSAGE` in the
 * browser and renders the dotted key as visible text, with typecheck, lint and the build green.
 *
 * "Client" here is the RUNTIME import closure of every `"use client"` file, not the files that
 * carry the directive: a hook or component without it (`use-search-combobox.ts`,
 * `page-skeleton.tsx`) runs in the browser as soon as a client file imports it.
 */

const SOURCE_ROOTS = ["app", "components", "lib", "i18n"] as const;

/** next-intl/use-intl value imports a client file may use. Anything else reads config or
 * messages this scanner cannot see (`useMessages`, `useFormatter`, a nested provider, …). */
const ALLOWED_CLIENT_IMPORTS = new Set(["useTranslations", "useLocale", "hasLocale"]);

interface Scan {
  namespaces: string[];
  violations: string[];
}

/** Namespaces a source reads through `useTranslations`, and every access it cannot resolve. */
function scanSource(source: string): Scan {
  const code = stripComments(source);
  const namespaces: string[] = [];
  const violations: string[] = [];

  for (const call of code.matchAll(/\buseTranslations\s*\(([^)]*)\)/g)) {
    const arg = call[1]!.trim();
    const literal = arg.match(/^["']([^"'`]+)["']$/);
    if (literal) namespaces.push(literal[1]!);
    else
      violations.push(
        arg === ""
          ? "useTranslations() without a namespace reads the whole catalogue"
          : `useTranslations(${arg}) has a computed namespace`,
      );
  }

  const importPattern = /\bimport\s+([^;]*?)\s+from\s*["'](next-intl|use-intl)(?:\/react)?["']/g;
  for (const match of code.matchAll(importPattern)) {
    const clause = match[1]!.trim();
    if (/^type\b/.test(clause)) continue;
    const braces = clause.match(/^\{([^}]*)\}$/);
    if (!braces) {
      violations.push(`import ${clause} from "${match[2]}" is not a plain named import`);
      continue;
    }
    for (const member of braces[1]!.split(",").map((m) => m.trim())) {
      if (member === "" || /^type\s/.test(member)) continue;
      if (!ALLOWED_CLIENT_IMPORTS.has(member)) {
        violations.push(`imports \`${member}\` from "${match[2]}"`);
      }
    }
  }

  return { namespaces, violations };
}

/** Used namespaces that no provided entry covers (an entry covers itself and its children). */
function uncoveredNamespaces(used: Iterable<string>, provided: readonly string[]): string[] {
  return [...new Set(used)]
    .filter((ns) => !provided.some((entry) => ns === entry || ns.startsWith(`${entry}.`)))
    .sort();
}

const isClientFile = (path: string) =>
  /^["']use client["']/.test(readFileSync(path, "utf8").trimStart());

function clientClosure(): Set<string> {
  const entries = SOURCE_ROOTS.flatMap((root) => walk(join(repoRoot, root))).filter(isClientFile);
  const seen = new Set(entries);
  const queue = [...entries];
  while (queue.length > 0) {
    for (const next of runtimeImportsOf(queue.pop()!)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

const closure = clientClosure();
const usage = new Map<string, string[]>();
const violations: string[] = [];
for (const file of closure) {
  const label = relative(repoRoot, file);
  const scan = scanSource(readFileSync(file, "utf8"));
  for (const ns of scan.namespaces) usage.set(ns, [...(usage.get(ns) ?? []), label]);
  violations.push(...scan.violations.map((v) => `${label}: ${v}`));
}

const resolveNode = (catalogue: unknown, dotted: string): unknown =>
  dotted
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalogue,
    );

describe("the client-message scanner itself", () => {
  it("walks a real client graph and finds real namespaces", () => {
    expect(closure.size, "files in the client import closure").toBeGreaterThan(100);
    expect(usage.size, "distinct client namespaces").toBeGreaterThanOrEqual(8);
    expect(
      [...usage.values()].flat().length,
      "useTranslations call sites in client files",
    ).toBeGreaterThan(30);
  });

  it("reads literal namespaces, nested ones included", () => {
    expect(
      scanSource(`const t = useTranslations("A");\nconst u = useTranslations('B.c');`),
    ).toEqual({ namespaces: ["A", "B.c"], violations: [] });
  });

  it("flags access it cannot resolve to a namespace", () => {
    expect(scanSource(`useTranslations()`).violations).toHaveLength(1);
    expect(scanSource(`useTranslations(ns)`).violations).toHaveLength(1);
    expect(scanSource(`useTranslations(\`A\`)`).violations).toHaveLength(1);
    expect(scanSource(`import { useMessages } from "next-intl";`).violations).toHaveLength(1);
    expect(scanSource(`import { useFormatter } from "use-intl";`).violations).toHaveLength(1);
    expect(
      scanSource(`import { useTranslations as useT } from "next-intl";`).violations,
    ).toHaveLength(1);
    expect(scanSource(`import * as intl from "next-intl";`).violations).toHaveLength(1);
    expect(
      scanSource(`import { NextIntlClientProvider } from "next-intl";`).violations,
    ).toHaveLength(1);
  });

  it("allows the hooks that need no messages and type-only imports", () => {
    expect(
      scanSource(
        `import { useLocale, useTranslations, type Locale } from "next-intl";\n` +
          `import type { Messages } from "next-intl";`,
      ).violations,
    ).toEqual([]);
  });

  it("reports a client namespace the provider list does not cover", () => {
    expect(uncoveredNamespaces(["A", "B.c", "D.e"], ["A", "B", "D.f"])).toEqual(["D.e"]);
  });
});

describe("CLIENT_MESSAGE_NAMESPACES", () => {
  it("every client message access is a literal namespace through useTranslations", () => {
    expect(violations).toEqual([]);
  });

  it("covers every namespace a client component reads", () => {
    const missing = uncoveredNamespaces(usage.keys(), CLIENT_MESSAGE_NAMESPACES);
    expect(
      missing.map((ns) => `${ns} (${usage.get(ns)!.join(", ")})`),
      "add these to CLIENT_MESSAGE_NAMESPACES in lib/i18n/client-messages.ts",
    ).toEqual([]);
  });

  it("lists nothing a client component does not read", () => {
    // Exact, so the list cannot keep a namespace alive after its last client reader goes: a
    // stale entry is catalogue text shipped to every page for nobody.
    const stale = CLIENT_MESSAGE_NAMESPACES.filter((entry) => !usage.has(entry));
    expect(stale).toEqual([]);
  });

  it("is free of duplicates and of entries another entry already covers", () => {
    const redundant = CLIENT_MESSAGE_NAMESPACES.filter(
      (entry, i) =>
        CLIENT_MESSAGE_NAMESPACES.indexOf(entry) !== i ||
        CLIENT_MESSAGE_NAMESPACES.some((other) => entry.startsWith(`${other}.`)),
    );
    expect(redundant).toEqual([]);
  });

  it.each([
    ["tr", tr],
    ["en", en],
  ])("names a namespace object in %s.json for every entry", (_locale, catalogue) => {
    const absent = CLIENT_MESSAGE_NAMESPACES.filter((entry) => {
      const node = resolveNode(catalogue, entry);
      return typeof node !== "object" || node === null;
    });
    expect(absent).toEqual([]);
  });
});

describe("pickClientMessages", () => {
  it("keeps only the listed namespaces, nested paths under their parent", () => {
    const messages = {
      Home: { statProvincesLabel: "il" },
      Common: { loading: "…", unsavedChanges: { title: "t" } },
      Auth: { login: "Giriş" },
    };
    expect(pickClientMessages(messages, ["Auth", "Common.unsavedChanges", "Missing.x"])).toEqual({
      Auth: { login: "Giriş" },
      Common: { unsavedChanges: { title: "t" } },
    });
  });

  it("drops server-only namespaces from the real catalogue", () => {
    const picked = pickClientMessages(tr);
    expect(Object.keys(picked).sort()).toEqual(
      [...new Set(CLIENT_MESSAGE_NAMESPACES.map((entry) => entry.split(".")[0]!))].sort(),
    );
    expect(JSON.stringify(picked)).not.toContain("statProvincesLabel");
    expect(JSON.stringify(picked).length).toBeLessThan(JSON.stringify(tr).length / 2);
  });
});

describe("the locale layout", () => {
  const layout = stripComments(readFileSync(join(repoRoot, "app/[locale]/layout.tsx"), "utf8"));

  it("passes the picked catalogue to its one NextIntlClientProvider", () => {
    expect(layout.match(/<NextIntlClientProvider\b/g)).toHaveLength(1);
    expect(layout).toMatch(
      /<NextIntlClientProvider\s+messages=\{pickClientMessages\(\s*await getMessages\(\)\s*\)\}/,
    );
  });
});
