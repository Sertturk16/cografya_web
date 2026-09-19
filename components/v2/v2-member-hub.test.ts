import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("V2MemberHub Component & /v2/hesabim Security", () => {
  const hubSource = readFileSync(new URL("./v2-member-hub.tsx", import.meta.url), "utf8");
  const pageSource = readFileSync(
    new URL("../../app/[locale]/(site)/hesabim/page.tsx", import.meta.url),
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

  describe("/hesabim Server Security & Negative Control (§3.2)", () => {
    it("enforces dynamic = 'force-dynamic' and fetchCache = 'force-no-store'", () => {
      expect(pageSource).toContain('export const dynamic = "force-dynamic";');
      expect(pageSource).toContain('export const fetchCache = "force-no-store";');
    });

    it("verifies server-side session and redirects unauthenticated users to /v2/giris", () => {
      expect(pageSource).toContain("const session = await getSession();");
      expect(pageSource).toContain("if (!session) {");
      expect(pageSource).toContain('redirect(getPathname({ locale, href: "/giris" }));');
    });

    it("uses buildAuthMetadata to guarantee noindex,follow and proper canonical alternates", () => {
      expect(pageSource).toContain("buildAuthMetadata({");
      expect(pageSource).toContain('pathname: "/hesabim"');
    });

    it("fetches resilient reference datasets on the server for friendly UI names", () => {
      expect(pageSource).toContain("getProvincesResilient()");
      expect(pageSource).toContain("getCountriesResilient()");
      expect(pageSource).toContain("getRegionsResilient()");
      expect(pageSource).toContain("getBooksResilient()");
    });
  });

  describe("V2MemberHub Accessibility & Panels", () => {
    // T-031d Task 15: the hub no longer writes role="tablist" / role="tab" / role="tabpanel"
    // itself — components/v2/tablist-adoption.test.ts forbids that under components/v2, because
    // the hand-rolled version here carried the roles and the aria-* correctly but no onKeyDown,
    // so ARIA APG's Left/Right requirement went unmet. The five panels now go through
    // components/ui/tabs.tsx (Base UI Tabs), which supplies every role, aria-* and the roving
    // tabindex/arrow-key behaviour at runtime; this test checks the hub still routes through it
    // rather than re-inlining the tablist, and that none of the five panels was dropped.
    const PANELS = ["favorites", "videos", "games", "measurements", "profile"] as const;

    it("routes its five member panels through the shared Tabs primitive", () => {
      expect(hubSource).toContain('from "@/components/ui/tabs"');
      expect(hubSource).toContain("<TabsList");
      expect(hubSource).toContain("onValueChange=");
    });

    // A bare `toContain('value="favorites"')` is satisfied by the TRIGGER alone, and a bare
    // `toContain("<TabsContent")` by any one panel, so four of the five could be deleted and
    // this block would stay green. Each half of each pair is therefore matched on its own tag.
    it.each(PANELS)("keeps both the trigger and the panel for %s", (panel) => {
      expect(hubSource, `the ${panel} trigger is gone`).toMatch(
        new RegExp(`<TabsTrigger\\s+value="${panel}"`),
      );
      expect(hubSource, `the ${panel} panel is gone`).toMatch(
        new RegExp(`<TabsContent\\s+value="${panel}"`),
      );
    });

    it("keeps the games panel mounted while it is deselected", () => {
      // Base UI's Tabs.Panel unmounts a deselected panel by default. V2GameHistoryStats fetches
      // /game-rounds from a mount effect into its own state, so without this the panel refetches
      // on every selection — once per keypress while an arrow key repeats across the tablist.
      expect(hubSource).toMatch(/<TabsContent\s+value="games"[^>]*\skeepMounted/);
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
      expect(hubSource).toContain("/araclar");
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
