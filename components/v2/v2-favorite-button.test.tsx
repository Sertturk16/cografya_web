import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { stripComments } from "@/lib/test-support/strip-comments";
import { FavoriteFailureText, V2FavoriteButton } from "./v2-favorite-button";

/**
 * T-080: the favorite toggle reported every failure as "Kaydedilemedi, tekrar dene." in
 * hardcoded Turkish. An expired session (401) is not fixed by trying again, so it now gets its own
 * copy with a link to the login page, and every string comes from the `Favorites` catalogue.
 * Favorites carry no quota (no api limit, no BFF quota code), so a 403 stays a plain failure; the
 * mapping itself is tested in `lib/http/mutation-error.test.ts` and `lib/favorites/client.test.ts`.
 */

const MESSAGES = { tr: trMessages, en: enMessages } as const;

function render(locale: Locale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Istanbul">
      {element}
    </NextIntlClientProvider>,
  );
}

describe("FavoriteFailureText", () => {
  it.each([
    ["tr", "/giris"],
    ["en", "/en/login"],
  ] as const)("%s: an expired session links to the localized login page", (locale, href) => {
    const html = render(locale, <FavoriteFailureText code="session-expired" />);
    expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain(MESSAGES[locale].Favorites.saveError);
  });

  it.each(["tr", "en"] as const)("%s: any other failure says try again, with no link", (locale) => {
    const html = render(locale, <FavoriteFailureText code="failed" />);
    expect(html).toBe(MESSAGES[locale].Favorites.saveError.replace(/'/g, "&#x27;"));
    expect(html).not.toContain("<a");
  });
});

describe("V2FavoriteButton", () => {
  it.each(["tr", "en"] as const)("%s: renders its visible label from the catalogue", (locale) => {
    const html = render(
      locale,
      <V2FavoriteButton target={{ kind: "province", plateCode: "34" }} />,
    );
    expect(html).toContain(MESSAGES[locale].Favorites.addLabel);
  });

  const code = stripComments(
    readFileSync(new URL("./v2-favorite-button.tsx", import.meta.url), "utf8"),
  );

  it("keeps no Turkish copy in source", () => {
    expect(code).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
    expect(code).not.toContain("Kaydedilemedi");
  });

  it("records WHY a toggle failed and renders it as an alert", () => {
    expect(code).toContain("setFailure(result.code);");
    const at = code.indexOf("<FavoriteFailureText code={failure} />");
    expect(at, "the failure copy is not rendered").toBeGreaterThan(-1);
    expect(code.slice(code.lastIndexOf("<span", at), at)).toContain('role="alert"');
  });
});
