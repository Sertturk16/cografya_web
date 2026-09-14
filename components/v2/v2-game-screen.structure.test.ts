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
});
