import { describe, expect, it } from "vitest";
import { routing, type AppPathname } from "@/i18n/routing";
import {
  type ApiSlugRoute,
  isEnglishPath,
  matchEnglishPathname,
  type SlugResolver,
  turkishPathFor,
} from "./english-redirect";

/**
 * Where a withdrawn `/en` URL lands (T-105). Pure: the api-backed slug lookups are a fake
 * here, shaped like the real data (countries differ per locale, provinces and books agree).
 */

const SLUGS: Record<ApiSlugRoute, Record<string, string>> = {
  "/dunya/[slug]": { germany: "almanya", "united-arab-emirates": "birlesik-arap-emirlikleri" },
  "/turkiye/[slug]": { istanbul: "istanbul", mugla: "mugla" },
  "/kitaplar/[slug]": { "ayt-cografya": "ayt-cografya" },
};

const resolve: SlugResolver = async (route, enSlug) => SLUGS[route][enSlug] ?? null;

describe("isEnglishPath", () => {
  it.each(["/en", "/en/", "/en/dunya", "/en/sea/black-sea"])("claims %s", (path) => {
    expect(isEnglishPath(path)).toBe(true);
  });

  it.each(["/", "/enerji", "/en-iyi", "/dunya/en", "/deniz"])("leaves %s alone", (path) => {
    expect(isEnglishPath(path)).toBe(false);
  });
});

describe("turkishPathFor — representative URLs", () => {
  it.each([
    ["/en", "/"],
    ["/en/", "/"],
    ["/en/about", "/hakkimizda"],
    ["/en/turkiye", "/turkiye"],
    ["/en/dunya", "/dunya"],
    // A country: the EN slug is not the TR slug, so the template alone cannot answer.
    ["/en/dunya/germany", "/dunya/almanya"],
    ["/en/dunya/united-arab-emirates", "/dunya/birlesik-arap-emirlikleri"],
    // A province: the two columns agree today, and still go through the lookup.
    ["/en/turkiye/istanbul", "/turkiye/istanbul"],
    ["/en/turkiye/regions", "/turkiye/bolge"],
    ["/en/turkiye/region/marmara", "/turkiye/bolge/marmara"],
    // A static EN leaf beats a dynamic one: `continents` is a hub, not a country.
    ["/en/dunya/continents", "/dunya/kita"],
    ["/en/dunya/continent/africa", "/dunya/kita/afrika"],
    ["/en/dunya/continent/north-america", "/dunya/kita/kuzey-amerika"],
    ["/en/sea", "/deniz"],
    ["/en/sea/black-sea", "/deniz/karadeniz"],
    ["/en/sea/coastal-types", "/deniz/kiyi-tipleri"],
    ["/en/game/provinces-by-region/ege", "/oyun/bolge-bolge-il/ege"],
    ["/en/books/ayt-cografya", "/kitaplar/ayt-cografya"],
    ["/en/tools/distance", "/araclar/mesafe-olcme"],
    ["/en/earthquakes/fault-lines", "/deprem/fay-hatlari"],
    ["/en/reset-password/new", "/sifre-sifirlama/yeni"],
    ["/en/account/settings", "/hesabim/ayarlar"],
  ])("%s → %s", async (en, tr) => {
    expect(await turkishPathFor(en, resolve)).toBe(tr);
  });
});

describe("turkishPathFor — nothing withdrawn ends on a 404", () => {
  it.each([
    // Unknown entity → that route's own hub.
    ["/en/dunya/atlantis", "/dunya"],
    ["/en/turkiye/gondor", "/turkiye"],
    ["/en/dunya/continent/atlantis", "/dunya/kita"],
    ["/en/turkiye/region/mordor", "/turkiye/bolge"],
    ["/en/game/provinces-by-region/mordor", "/oyun/bolge-bolge-il"],
    ["/en/books/no-such-book", "/kitaplar"],
    // No template matches → the nearest prefix that does, down to the root.
    ["/en/sea/black-sea/extra", "/deniz/karadeniz"],
    ["/en/tools/nope", "/araclar"],
    ["/en/world", "/"],
    ["/en/no/such/thing", "/"],
  ])("%s → %s", async (en, tr) => {
    expect(await turkishPathFor(en, resolve)).toBe(tr);
  });

  it("lands on the hub when the slug lookup itself fails", async () => {
    const down: SlugResolver = async () => {
      throw new Error("api unreachable");
    };
    expect(await turkishPathFor("/en/dunya/germany", down)).toBe("/dunya");
    expect(await turkishPathFor("/en/turkiye/istanbul", down)).toBe("/turkiye");
  });

  it("asks the api only for the three routes whose slug is per-locale data", async () => {
    const asked: string[] = [];
    const spy: SlugResolver = async (route, slug) => {
      asked.push(route);
      return resolve(route, slug);
    };
    await turkishPathFor("/en/sea/black-sea", spy);
    await turkishPathFor("/en/dunya/continent/africa", spy);
    await turkishPathFor("/en/turkiye/region/ege", spy);
    expect(asked).toEqual([]);
  });
});

describe("every routing.pathnames entry has a way back", () => {
  // One sample value per dynamic segment, valid in both locales, so the expected TR path is
  // the TR template filled with the TR value.
  const SAMPLE: Record<string, { en: string; tr: string }> = {
    "/turkiye/[slug]": { en: "istanbul", tr: "istanbul" },
    "/dunya/[slug]": { en: "germany", tr: "almanya" },
    "/turkiye/bolge/[slug]": { en: "marmara", tr: "marmara" },
    "/dunya/kita/[slug]": { en: "europe", tr: "avrupa" },
    "/oyun/bolge-bolge-il/[bolge]": { en: "ege", tr: "ege" },
    "/kitaplar/[slug]": { en: "ayt-cografya", tr: "ayt-cografya" },
    "/design-system/[category]": { en: "tokens", tr: "tokens" },
  };

  const localized = (entry: string | Readonly<Record<string, string>>, locale: "tr" | "en") =>
    typeof entry === "string" ? entry : (entry[locale] as string);

  for (const [pathname, entry] of Object.entries(routing.pathnames)) {
    it(pathname, async () => {
      const sample = SAMPLE[pathname];
      const fillWith = (template: string, value: string | undefined) =>
        template.replace(/\[\w+\]/, value ?? "");
      if (/\[/.test(pathname)) expect(sample, "add a SAMPLE row for this route").toBeDefined();

      const enPath = `/en${fillWith(localized(entry, "en"), sample?.en)}`.replace(/\/$/, "");
      const trPath = fillWith(localized(entry, "tr"), sample?.tr);
      expect(matchEnglishPathname(enPath.slice(3) || "/")?.pathname).toBe(pathname as AppPathname);
      expect(await turkishPathFor(enPath, resolve)).toBe(trPath);
    });
  }
});
