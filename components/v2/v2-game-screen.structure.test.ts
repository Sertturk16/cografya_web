import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(): string {
  const url = new URL("./v2-game-screen.tsx", import.meta.url);
  return readFileSync(url, "utf8");
}

describe("V2GameScreen structural contract and auth gate", () => {
  const source = readSource();

  it("gates game start behind authentication via requestAuth('gameRound')", () => {
    expect(source).toContain('requestAuth("gameRound")');
    expect(source).toContain("handleStartGameClick");
    expect(source).toContain('authState !== "authenticated"');
  });

  it("wires handleStartGameClick to both 'Sınavı Başlat' and 'Tekrar Oyna' buttons", () => {
    expect(source).toMatch(/onClick=\{handleStartGameClick\}[\s\S]*?Sınavı Başlat/);
    expect(source).toMatch(/onClick=\{handleStartGameClick\}[\s\S]*?Tekrar Oyna/);
  });

  it("resumes and automatically starts the round when authentication succeeds", () => {
    expect(source).toContain("consumeResolved(id)");
    expect(source).toContain("modal.resolvedRequestId");
    const resumeIndex = source.indexOf("// Resume after authentication");
    expect(resumeIndex).toBeGreaterThan(-1);
    const resumeBlock = source.slice(resumeIndex, resumeIndex + 300);
    expect(resumeBlock).toContain("startRound()");
  });

  it("automatically saves the round on completion without manual button click", () => {
    expect(source).toContain("// Auto-save round to API once finished");
    expect(source).toContain("submitGameRound");
    expect(source).toContain('saveStatus === "idle"');
    expect(source).not.toContain("Skoru Profilime Kaydet");
    expect(source).not.toContain("Skoru Kaydet (Giriş Yap)");
  });

  it("renders auto-save status feedback (pending, saved, failed) in game over screen", () => {
    expect(source).toContain("Skorunuz profilinize kaydediliyor...");
    expect(source).toContain("Skor profilinize kaydedildi");
    expect(source).toContain("Skor kaydedilemedi");
  });

  describe("touch pinch-zoom + pan (T-015)", () => {
    it("reuses the shared pinch-ratio math instead of re-deriving it from raw touch deltas", () => {
      expect(source).toContain('from "@/lib/map/zoom-pan"');
      expect(source).toContain("zoomFromPinch(");
    });

    it("filters every touch handler to pointerType, so a mouse click never double-fires", () => {
      const guardCount = (source.match(/if \(e\.pointerType !== "touch"\) return;/g) ?? []).length;
      expect(guardCount).toBeGreaterThanOrEqual(3); // down, move, up (+ cancel reuses up)
    });
  });

  describe("smart region focus on reveal (T-015)", () => {
    it("pans to the revealed answer without ever changing zoom (no auto-zoom to an OPEN answer)", () => {
      const start = source.indexOf("const panToRevealedPlates = ");
      expect(start).toBeGreaterThan(-1);
      const end = source.indexOf("\n  );", start);
      const body = source.slice(start, end);
      expect(body).toContain("setPan(");
      expect(body).not.toContain("setZoom(");
    });

    it("unions the whole region's provinces when the target is a region, not one plate", () => {
      const start = source.indexOf("const revealedPlates =");
      expect(start).toBeGreaterThan(-1);
      const block = source.slice(start, start + 300);
      expect(block).toContain('mode === "regions"');
      expect(block).toContain("s.target?.region === currentTarget.id");
    });
  });

  describe("landscape / fullscreen entry (T-015)", () => {
    it("wires the shared landscape hook to the game arena's own container ref", () => {
      expect(source).toContain('from "@/lib/map/use-landscape-mode.client"');
      expect(source).toContain("useLandscapeMode(mapArenaRef)");
    });
  });
});
