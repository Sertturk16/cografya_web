import { describe, expect, it, vi } from "vitest";
import {
  SESSION_FLAG_COOKIE_NAME,
  clearSessionFlag,
  hasSessionFlag,
  setSessionFlag,
} from "./session-flag.client";

describe("session-flag.client", () => {
  it("exports the expected cookie name cg_has_session", () => {
    expect(SESSION_FLAG_COOKIE_NAME).toBe("cg_has_session");
  });

  describe("hasSessionFlag with explicit cookieSource", () => {
    it("returns true when cg_has_session=1 is alone", () => {
      expect(hasSessionFlag("cg_has_session=1")).toBe(true);
    });

    it("returns true when cg_has_session=1 is among multiple cookies", () => {
      expect(hasSessionFlag("theme=dark; cg_has_session=1; font=sans")).toBe(true);
      expect(hasSessionFlag("cg_has_session=1; theme=dark")).toBe(true);
      expect(hasSessionFlag("theme=dark; cg_has_session=1")).toBe(true);
    });

    it("returns false when cg_has_session is missing or not 1", () => {
      expect(hasSessionFlag("")).toBe(false);
      expect(hasSessionFlag("cg_has_session=0")).toBe(false);
      expect(hasSessionFlag("theme=dark")).toBe(false);
      expect(hasSessionFlag("not_cg_has_session=1")).toBe(false);
    });
  });

  describe("hasSessionFlag with document.cookie", () => {
    it("reads from document.cookie when document is available", () => {
      vi.stubGlobal("document", { cookie: "cg_has_session=1" });
      expect(hasSessionFlag()).toBe(true);

      vi.stubGlobal("document", { cookie: "theme=dark" });
      expect(hasSessionFlag()).toBe(false);

      vi.unstubAllGlobals();
    });

    it("defaults to true in node test environment when document is undefined", () => {
      vi.stubGlobal("document", undefined);
      expect(hasSessionFlag()).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe("setSessionFlag & clearSessionFlag", () => {
    it("setSessionFlag sets cg_has_session=1 with path and max-age", () => {
      const fakeDoc = { cookie: "" };
      vi.stubGlobal("document", fakeDoc);

      setSessionFlag();
      expect(fakeDoc.cookie).toBe("cg_has_session=1; path=/; samesite=lax; max-age=2592000");

      vi.unstubAllGlobals();
    });

    it("clearSessionFlag sets max-age=0 to expire cookie", () => {
      const fakeDoc = { cookie: "cg_has_session=1" };
      vi.stubGlobal("document", fakeDoc);

      clearSessionFlag();
      expect(fakeDoc.cookie).toBe("cg_has_session=; path=/; max-age=0; samesite=lax");

      vi.unstubAllGlobals();
    });
  });
});
