import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { ENGLISH_ENABLED, routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo/metadata";
import { sitemapEntriesFor } from "@/lib/seo/sitemap-entries";
import proxy from "@/proxy";

/**
 * `ENGLISH_ENABLED = true` — the position that restores `/en` (T-105). The mirror of
 * `english-switch.off.test.ts`: flipping the switch back must bring every English surface
 * back without a code change anywhere else.
 */
vi.mock("@/i18n/routing", async (importOriginal) => {
  const { routingWithEnglish } = await import("@/lib/test-support/english-switch");
  return routingWithEnglish(await importOriginal(), true);
});

vi.mock("@/lib/i18n/english-slugs.server", () => ({
  resolveEnglishSlug: async () => {
    throw new Error("the redirect must not run while English is served");
  },
}));

const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

describe("ENGLISH_ENABLED = true", () => {
  it("serves both locales", () => {
    expect(ENGLISH_ENABLED).toBe(true);
    expect([...routing.locales]).toEqual(["tr", "en"]);
  });

  it.each(["/en", "/en/dunya", "/en/sea/black-sea"])(
    "proxy serves %s, no redirect",
    async (path) => {
      const response = await proxy(request(path));
      expect(response.status).toBeLessThan(300);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("proxy sends the hreflang Link header again", async () => {
    const response = await proxy(request("/dunya"));
    expect(response.headers.get("link") ?? "").toMatch(/hreflang="en"/);
  });

  it("a fully localized page carries its English alternate again", () => {
    expect(buildAlternates("tr", () => "/hakkimizda", "localized").languages).toEqual({
      tr: "/hakkimizda",
      en: "/en/about",
      "x-default": "/hakkimizda",
    });
  });

  it("the sitemap lists the English URL of a localized page again", () => {
    const urls = sitemapEntriesFor(() => "/hakkimizda", new Date(0), 0.5).map((e) => e.url);
    expect(urls).toEqual(["http://localhost:3000/hakkimizda", "http://localhost:3000/en/about"]);
  });
});

/**
 * The existing SEO and routing suites, re-run in this position. Each is parametrised over
 * `routing.locales`, so under the shipped `false` it only exercises Turkish; importing it here
 * registers its cases again against the two-locale table, which keeps the English half of
 * every one of them honest while it is switched off.
 */
describe("existing suites, English on", async () => {
  await import("@/lib/seo/indexing.test");
  await import("@/lib/seo/metadata.test");
  await import("@/lib/seo/sitemap-entries.test");
  await import("@/lib/seo/auth-routes.test");
  await import("@/lib/tools/tool-registry.test");
});
