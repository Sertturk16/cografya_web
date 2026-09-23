import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getGameRoundModeTitle } from "@/lib/game/round-mode-tag";
import trMessages from "@/messages/tr.json";

describe("V2GameHistoryStats & Workbench Polish (IRIS A7, IRIS A10, IRIS A11)", () => {
  const statsSource = readFileSync(new URL("./v2-game-history-stats.tsx", import.meta.url), "utf8");
  const workbenchSource = readFileSync(new URL("./v2-tool-workbench.tsx", import.meta.url), "utf8");

  it("IRIS A7: converts raw mode tags to Turkish titles via getGameRoundModeTitle", () => {
    expect(statsSource).toContain("getGameRoundModeTitle(rec.mode)");
    // Must not contain raw rec.mode fallback
    expect(statsSource).not.toContain(": rec.mode}");

    // Test the helper directly
    expect(getGameRoundModeTitle("provinces")).toBe("81 İl Bulma");
    expect(getGameRoundModeTitle("regions")).toBe("7 Bölge Bulma");
    expect(getGameRoundModeTitle("provinces-marmara")).toBe("Marmara Bölgesi İlleri");
    expect(getGameRoundModeTitle("provinces-ege")).toBe("Ege Bölgesi İlleri");
  });

  it("IRIS A10: unlocks 'İlk Adım' only if at least one round has score > 0", () => {
    // Abandoned rounds with score 0 must not unlock achievement
    expect(statsSource).toContain("records.some((r) => r.score > 0)");
    expect(statsSource).not.toContain("unlocked: totalRounds >= 1");
  });

  it("IRIS A11: workbench says saves go to the account, and has aria-live status", () => {
    // The label moved to the catalogue in T-081; the workbench reads it by key.
    expect(workbenchSource).toContain('t("saveDestination")');
    expect(trMessages.ToolWorkbench.saveDestination).toBe("Hesabına kaydedilir");
    expect(workbenchSource).not.toContain("Yerel Hafızaya Sakla");
    expect(JSON.stringify(trMessages.ToolWorkbench)).not.toContain("Yerel Hafızaya Sakla");
    expect(workbenchSource).toContain('role="status"');
    expect(workbenchSource).toContain('aria-live="polite"');
  });
});
