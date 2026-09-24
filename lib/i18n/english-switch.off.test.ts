import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { ENGLISH_ENABLED, routing } from "@/i18n/routing";
import { buildAlternates, buildMetadata } from "@/lib/seo/metadata";
import { sitemapEntriesFor } from "@/lib/seo/sitemap-entries";
import proxy from "@/proxy";

/**
 * `ENGLISH_ENABLED = false` — the shipped position today (T-105). Pinned by mocking the module
 * rather than by reading the constant, so this file keeps testing the OFF position after the
 * switch is flipped back; `english-switch.on.test.ts` is its mirror.
 */
vi.mock("@/i18n/routing", async (importOriginal) => {
  const { routingWithEnglish } = await import("@/lib/test-support/english-switch");
  return routingWithEnglish(await importOriginal(), false);
});

vi.mock("@/lib/i18n/english-slugs.server", () => ({
  resolveEnglishSlug: async (route: string, slug: string) =>
    (
      ({
        "/dunya/[slug]": { germany: "almanya" },
        "/turkiye/[slug]": { istanbul: "istanbul" },
        "/kitaplar/[slug]": {},
      }) as Record<string, Record<string, string>>
    )[route]?.[slug] ?? null,
}));

const COUNTRY = (locale: "tr" | "en") => ({
  pathname: "/dunya/[slug]" as const,
  params: { slug: locale === "en" ? "germany" : "almanya" },
});

const request = (path: string, init?: { cookie?: string }) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: init?.cookie ? { cookie: init.cookie } : {},
  });

describe("ENGLISH_ENABLED = false", () => {
  it("serves Turkish only", () => {
    expect(ENGLISH_ENABLED).toBe(false);
    expect([...routing.locales]).toEqual(["tr"]);
  });

  describe("proxy: every /en URL is a permanent redirect to its Turkish equivalent", () => {
    it.each([
      ["/en", "/"],
      ["/en/dunya", "/dunya"],
      ["/en/turkiye", "/turkiye"],
      ["/en/dunya/germany", "/dunya/almanya"],
      ["/en/turkiye/istanbul", "/turkiye/istanbul"],
      ["/en/sea/black-sea", "/deniz/karadeniz"],
      ["/en/dunya/atlantis", "/dunya"],
    ])("%s → 301 %s", async (from, to) => {
      const response = await proxy(request(from));
      expect(response.status).toBe(301);
      expect(new URL(response.headers.get("location") ?? "").pathname).toBe(to);
    });

    it("keeps the query string — the api's e-mails carry the reset token in it", async () => {
      const response = await proxy(request("/en/reset-password/new?token=abc123"));
      expect(response.status).toBe(301);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe("/sifre-sifirlama/yeni");
      expect(location.searchParams.get("token")).toBe("abc123");
    });

    it("does not bounce a reader whose stored locale is en", async () => {
      // `NEXT_LOCALE=en` from the bilingual days: the Turkish page answers itself (no
      // redirect back to /en) and overwrites the stale cookie, so there is no loop.
      const response = await proxy(request("/dunya", { cookie: "NEXT_LOCALE=en" }));
      expect(response.status).toBeLessThan(300);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie") ?? "").toMatch(/NEXT_LOCALE=tr/);
    });

    it("sends no hreflang Link header", async () => {
      const response = await proxy(request("/dunya"));
      expect(response.headers.get("link") ?? "").not.toMatch(/hreflang/);
    });
  });

  describe("<head>: no English alternate anywhere", () => {
    it("a fully localized page carries tr + x-default only", () => {
      const alternates = buildAlternates("tr", () => "/hakkimizda", "localized");
      expect(alternates.languages).toEqual({ tr: "/hakkimizda", "x-default": "/hakkimizda" });
    });

    it("a per-locale-slug page never points at its English twin", () => {
      const metadata = buildMetadata({
        locale: "tr",
        hrefForLocale: COUNTRY,
        title: "Almanya",
        description: "…",
        surface: "trNarrative",
      });
      expect(JSON.stringify(metadata.alternates)).not.toMatch(/\/en\b|"en"|germany/);
      expect(metadata.openGraph?.alternateLocale).toEqual([]);
    });
  });

  describe("sitemap: Turkish URLs only", () => {
    it.each(["localized", "trNarrative", "trOnly"] as const)("%s surface", (surface) => {
      const entries = sitemapEntriesFor(() => "/hakkimizda", new Date(0), 0.5, surface);
      expect(entries.map((entry) => entry.url)).toEqual(["http://localhost:3000/hakkimizda"]);
      for (const entry of entries) {
        expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(["tr", "x-default"]);
      }
    });
  });
});

describe("no language switcher is rendered", () => {
  // There is none today — V1's went with T-032 — and nothing may bring one back while the
  // English site is withdrawn: it would link every page to a redirect. A switcher is a
  // `locale` handed to next-intl's `Link` or router, or a use of the catalogue's label for it.
  const ROOT = fileURLToPath(new URL("../..", import.meta.url));
  const SWITCHER = [
    /<Link\b[^>]*\blocale=/,
    /\.(?:push|replace)\([^)]*\{[^}]*\blocale\s*:/,
    /localeSwitcherLabel/,
  ];

  function* sources(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) yield* sources(path);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
    }
  }

  it("in app/ or components/", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const file of sources(join(ROOT, dir))) {
        const text = readFileSync(file, "utf8");
        if (SWITCHER.some((pattern) => pattern.test(text))) offenders.push(file.slice(ROOT.length));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the scan recognises a switcher when it sees one", () => {
    expect(SWITCHER.some((p) => p.test(`<Link href={pathname} locale="en">EN</Link>`))).toBe(true);
    expect(SWITCHER.some((p) => p.test(`router.replace(pathname, { locale: next })`))).toBe(true);
  });

  it("the root 404's English half, which links to /en, sits behind the switch", () => {
    const source = readFileSync(join(ROOT, "app/not-found.tsx"), "utf8");
    const guard = source.indexOf("{ENGLISH_ENABLED && (");
    expect(guard).toBeGreaterThan(-1);
    expect(source.indexOf('href="/en"')).toBeGreaterThan(guard);
  });
});
