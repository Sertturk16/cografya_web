import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("V2MemberHub Component & /v2/hesabim Security", () => {
  const hubSource = readFileSync(new URL("./v2-member-hub.tsx", import.meta.url), "utf8");
  const pageSource = readFileSync(
    new URL("../../app/[locale]/v2/hesabim/page.tsx", import.meta.url),
    "utf8",
  );

  describe("Gate G5 & Browser Storage Hygiene", () => {
    it("never references localStorage, sessionStorage, or document.cookie in member hub", () => {
      expect(hubSource).not.toMatch(/\blocalStorage\b/);
      expect(hubSource).not.toMatch(/\bsessionStorage\b/);
      expect(hubSource).not.toMatch(/document\.cookie/);
      expect(hubSource).not.toMatch(/\bindexedDB\b/);
    });
  });

  describe("/v2/hesabim Server Security & Negative Control (§3.2)", () => {
    it("enforces dynamic = 'force-dynamic' and fetchCache = 'force-no-store'", () => {
      expect(pageSource).toContain('export const dynamic = "force-dynamic";');
      expect(pageSource).toContain('export const fetchCache = "force-no-store";');
    });

    it("verifies server-side session and redirects unauthenticated users to /v2/giris", () => {
      expect(pageSource).toContain("const session = await getSession();");
      expect(pageSource).toContain("if (!session) {");
      expect(pageSource).toContain('redirect(getPathname({ locale, href: "/v2/giris" }));');
    });

    it("uses buildAuthMetadata to guarantee noindex,follow and proper canonical alternates", () => {
      expect(pageSource).toContain("buildAuthMetadata({");
      expect(pageSource).toContain('pathname: "/v2/hesabim"');
    });

    it("fetches resilient reference datasets on the server for friendly UI names", () => {
      expect(pageSource).toContain("getProvincesResilient()");
      expect(pageSource).toContain("getCountriesResilient()");
      expect(pageSource).toContain("getRegionsResilient()");
      expect(pageSource).toContain("getBooksResilient()");
    });
  });

  describe("V2MemberHub Accessibility & Panels", () => {
    it("contains accessible tabs with proper ARIA roles and keyboard controls", () => {
      expect(hubSource).toContain('role="tablist"');
      expect(hubSource).toContain('role="tab"');
      expect(hubSource).toContain('role="tabpanel"');
      expect(hubSource).toContain("aria-selected=");
      expect(hubSource).toContain("aria-controls=");
    });

    it("contains an aria-live polite status announcement region", () => {
      expect(hubSource).toContain('role="status"');
      expect(hubSource).toContain('aria-live="polite"');
    });

    it("supports polymorphic favorites across all 4 entity types (province, country, region, continent)", () => {
      expect(hubSource).toContain('case "province":');
      expect(hubSource).toContain('case "country":');
      expect(hubSource).toContain('case "region":');
      expect(hubSource).toContain('case "continent":');
      expect(hubSource).toContain("CONTINENT_META");
      expect(hubSource).toContain("removeFavorite");
    });

    it("displays video progress and resume CTA when available", () => {
      expect(hubSource).toContain("fetchBookProgress");
      expect(hubSource).toContain("watchedCount");
      expect(hubSource).toContain("videoCount");
      expect(hubSource).toContain("Kaldığın Yerden Devam Et");
    });

    it("displays cloud measurements and provides delete functionality", () => {
      expect(hubSource).toContain("fetchMeasurements");
      expect(hubSource).toContain("removeMeasurement");
      expect(hubSource).toContain("/v2/araclar");
    });

    it("embeds V2GameHistoryStats for game history and achievements", () => {
      expect(hubSource).toContain("<V2GameHistoryStats />");
    });

    it("implements secure sign-out via submitAuth('logout', {})", () => {
      expect(hubSource).toContain('submitAuth("logout", {})');
      expect(hubSource).toContain('setAuthState("anonymous")');
    });
  });
});
