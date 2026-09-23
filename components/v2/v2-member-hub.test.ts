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
    // Four, not five. T-061 deleted the "profile" panel: it rendered the same values the hero
    // already summarised, read-only, and its two buttons led to a page that now redirects here.
    // Account management lives at `/hesabim/ayarlar`, which the hero links to.
    const PANELS = ["favorites", "videos", "games", "measurements"] as const;

    it("routes its four member panels through the shared Tabs primitive", () => {
      expect(hubSource).toContain('from "@/components/ui/tabs"');
      expect(hubSource).toContain("<TabsList");
      expect(hubSource).toContain("onValueChange=");
    });

    // A bare `toContain('value="favorites"')` is satisfied by the TRIGGER alone, and a bare
    // `toContain("<TabsContent")` by any one panel, so three of the four could be deleted and
    // this block would stay green. Each half of each pair is therefore matched on its own tag.
    it.each(PANELS)("keeps both the trigger and the panel for %s", (panel) => {
      expect(hubSource, `the ${panel} trigger is gone`).toMatch(
        new RegExp(`<TabsTrigger\\s+value="${panel}"`),
      );
      expect(hubSource, `the ${panel} panel is gone`).toMatch(
        new RegExp(`<TabsContent\\s+value="${panel}"`),
      );
    });

    it("draws the tab focus outline inside the scrolling strip, where an outset one is clipped", () => {
      // The strip is `overflow-x-auto`, which clips vertically too, and each tab sits flush with
      // its top edge: the site's outset 3px outline lost its top side at every width (T-058).
      expect(hubSource).toMatch(
        /<TabsList[^>]*overflow-x-auto[^>]*\*:focus-visible:outline-2 \*:focus-visible:-outline-offset-2/,
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

    // The hub used to carry its own sign-out button, the THIRD copy on a signed-in page —
    // beside the header's desktop button and the mobile menu's item. T-061 removed it, and
    // this case is the ratchet that keeps it removed: the header owns signing out, and a
    // member should not have to wonder which of three buttons is the real one.
    it("does not sign out — the header owns that, and the hub no longer duplicates it", () => {
      expect(hubSource).not.toContain('submitAuth("logout"');
      expect(hubSource).not.toContain("Güvenli Çıkış");
    });

    it("sends account management to /hesabim/ayarlar, and nowhere else", () => {
      expect(hubSource).toContain('href="/hesabim/ayarlar"');
      // The completion prompt deep-links into the education section of the same page.
      expect(hubSource).toContain('pathname: "/hesabim/ayarlar"');
      // The three doors are one. `/profil` is a redirect now; a link to it here would send a
      // member through an extra hop for no reason.
      expect(hubSource).not.toContain('href="/profil"');
    });
  });
});
