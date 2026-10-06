import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { V2FavoriteButton, favoriteBusyLabelKey } from "./v2-favorite-button";
import { V2GameHistoryStats } from "./v2-game-history-stats";
import { leaderboardBody } from "./v2-leaderboard-modal";
import { measurementSaveLabelKey } from "./v2-tool-workbench";

/**
 * T-165: the server render of a `useAuthSession()` consumer is its `"checking"` render (the
 * store's server snapshot), which is also what a signed-in reader sees until the check answers.
 * None of it may be guest content. T-167: a press that waits for the check never says
 * "Kaydediliyor…" before a save has started.
 */

function render(element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      {element}
    </NextIntlClientProvider>,
  );
}

describe("V2GameHistoryStats while checking", () => {
  it("shows no sign-in banner", () => {
    const html = render(<V2GameHistoryStats />);
    expect(html).not.toContain("Oynamak için giriş yap");
    expect(html).not.toContain("Giriş Yap veya Kayıt Ol");
    expect(html).toContain("Rozetlerin");
  });
});

describe("V2FavoriteButton while checking", () => {
  it.each(["default", "iconOnly"] as const)(
    "%s: no lock and no sign-in name, the plain add name",
    (variant) => {
      const html = render(
        <V2FavoriteButton target={{ kind: "province", plateCode: "34" }} variant={variant} />,
      );
      expect(html).not.toContain(trMessages.Favorites.signInRequiredAria);
      expect(html).not.toContain("lucide-lock");
      expect(html).toContain(`aria-label="${trMessages.Favorites.addAria}"`);
    },
  );
});

describe("favoriteBusyLabelKey (T-167)", () => {
  it("says the session is being checked while the press waits", () => {
    expect(favoriteBusyLabelKey({ pending: false, waiting: true })).toBe("checkingSessionLabel");
  });

  it("says saving only once the save request runs", () => {
    expect(favoriteBusyLabelKey({ pending: true, waiting: false })).toBe("savingLabel");
  });

  it("is idle otherwise", () => {
    expect(favoriteBusyLabelKey({ pending: false, waiting: false })).toBeNull();
  });
});

describe("measurementSaveLabelKey (T-167)", () => {
  it("keeps the idle text while the press only waits for the session (the spinner says why)", () => {
    expect(measurementSaveLabelKey({ saving: false, waiting: true, saved: false })).toBe(
      "saveLabel",
    );
  });

  it("says saving only once the save request runs", () => {
    expect(measurementSaveLabelKey({ saving: true, waiting: false, saved: false })).toBe(
      "savingLabel",
    );
    expect(measurementSaveLabelKey({ saving: false, waiting: false, saved: true })).toBe(
      "savedLabel",
    );
    expect(measurementSaveLabelKey({ saving: false, waiting: false, saved: false })).toBe(
      "saveLabel",
    );
  });

  it("labels the waiting spinner with the session check", () => {
    const code = readFileSync(new URL("./v2-tool-workbench.tsx", import.meta.url), "utf8");
    const spinner =
      'saveGate.waiting ? ( <Spinner size="default" label={tMeasurements("checkingSessionLabel")}';
    expect(code.replace(/\s+/g, " ").includes(spinner), "the waiting spinner's label").toBe(true);
  });
});

describe("leaderboardBody", () => {
  const base = { loading: false, error: null, hasItems: true } as const;

  it("shows the loading state while checking, never the sign-in panel", () => {
    expect(leaderboardBody({ ...base, authState: "checking" })).toBe("loading");
  });

  it("asks a guest to sign in", () => {
    expect(leaderboardBody({ ...base, authState: "anonymous" })).toBe("sign-in");
  });

  it("follows the fetch for a signed-in reader", () => {
    expect(leaderboardBody({ ...base, authState: "authenticated", loading: true })).toBe("loading");
    expect(leaderboardBody({ ...base, authState: "authenticated", error: "failed" })).toBe(
      "failed",
    );
    expect(leaderboardBody({ ...base, authState: "authenticated", hasItems: false })).toBe("empty");
    expect(leaderboardBody({ ...base, authState: "authenticated" })).toBe("table");
  });
});
