import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { label, readSource, repoRoot, walkPages } from "@/lib/test-support/composition-scan";
import { siteConfig } from "./site";

/**
 * The brand appears once in every page title.
 *
 * The root layout (`app/[locale]/layout.tsx`) sets the title template `%s · <brand>`, so a
 * relative page title that already carries the brand renders it twice:
 * "Karadeniz … | Coğrafya Gurmesi · Coğrafya Gurmesi". Home, the four sea basins, the region and
 * continent hubs, every region page and four account pages shipped exactly that. A title that
 * must carry the brand itself opts out of the template with `titleAbsolute: true` (or Next's
 * `{ absolute }`), which is what `/` does with `Home.metaTitle`.
 *
 * The check reads each page's `generateMetadata` source: every `title:` expression, the string
 * literals in it and the `t("…")` keys it reads, resolved against both message catalogues.
 * Titles that come from the API (`region.metaTitle`) are data and out of its reach.
 */

const BRAND = siteConfig.name;

type Catalogue = Record<string, unknown>;
const catalogues: Record<string, Catalogue> = {
  tr: JSON.parse(readFileSync(join(repoRoot, "messages/tr.json"), "utf8")) as Catalogue,
  en: JSON.parse(readFileSync(join(repoRoot, "messages/en.json"), "utf8")) as Catalogue,
};

function lookup(catalogue: Catalogue, path: string): string | undefined {
  let node: unknown = catalogue;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** The `generateMetadata` function (or `metadata` export) of a page, comment-stripped. */
function metadataSource(source: string): string | null {
  const start = Math.max(
    source.indexOf("export async function generateMetadata"),
    source.indexOf("export const metadata"),
  );
  if (start === -1) return null;
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end === -1 ? undefined : end);
}

/** Each `title:` property with its continuation lines (a ternary spans several). */
function titleExpressions(body: string): string[] {
  const lines = body.split("\n");
  const out: string[] = [];
  lines.forEach((line, index) => {
    const match = /^(\s*)title:/.exec(line);
    if (!match) return;
    const indent = match[1]?.length ?? 0;
    const parts = [line];
    for (const next of lines.slice(index + 1)) {
      const nextIndent = /^\s*/.exec(next)?.[0].length ?? 0;
      if (next.trim() === "" || nextIndent <= indent) break;
      parts.push(next);
    }
    out.push(parts.join("\n"));
  });
  return out;
}

interface TitleFinding {
  file: string;
  expression: string;
  /** Where the brand came from: a literal, or `Namespace.key (locale)`. */
  brandSources: string[];
  absolute: boolean;
  resolvedKeys: number;
}

function scan(file: string): TitleFinding[] {
  const body = metadataSource(readSource(file));
  if (body === null) return [];
  const namespaces = [
    ...body.matchAll(/namespace:\s*"([\w.]+)"/g),
    ...body.matchAll(/getTranslations\(\s*"([\w.]+)"\s*\)/g),
  ].map((m) => m[1] ?? "");
  const absolute = /titleAbsolute:\s*true/.test(body) || /\babsolute:/.test(body);

  return titleExpressions(body).map((expression) => {
    const brandSources: string[] = [];
    if (expression.includes(BRAND) || expression.includes("siteConfig.name")) {
      brandSources.push("literal");
    }
    let resolvedKeys = 0;
    for (const [, key] of expression.matchAll(/\bt\(\s*"([\w.]+)"/g)) {
      for (const ns of namespaces) {
        for (const [locale, catalogue] of Object.entries(catalogues)) {
          const value = lookup(catalogue, `${ns}.${key}`);
          if (value === undefined) continue;
          resolvedKeys += 1;
          if (value.includes(BRAND)) brandSources.push(`${ns}.${key} (${locale})`);
        }
      }
    }
    return { file: label(file), expression, brandSources, absolute, resolvedKeys };
  });
}

const findings = walkPages().flatMap(scan);

describe("page titles carry the brand once", () => {
  it("scans the real tree (anti-vacuity)", () => {
    expect(new Set(findings.map((f) => f.file)).size).toBeGreaterThan(25);
    expect(findings.reduce((sum, f) => sum + f.resolvedKeys, 0)).toBeGreaterThan(10);
  });

  it("sees the brand in the home title and finds it absolute (positive control)", () => {
    const home = findings.find((f) => f.file === join("app", "[locale]", "(site)", "page.tsx"));
    expect(home?.brandSources.length ?? 0).toBeGreaterThan(0);
    expect(home?.absolute).toBe(true);
  });

  it("no relative title already contains the brand the root template appends", () => {
    const doubled = findings
      .filter((f) => f.brandSources.length > 0 && !f.absolute)
      .map((f) => `${f.file}: ${f.brandSources.join(", ")}\n${f.expression.trim()}`);
    expect(doubled).toEqual([]);
  });
});
