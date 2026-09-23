import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { DELETE_ERROR_MESSAGE_KEY, SAVE_ERROR_MESSAGE_KEY } from "@/lib/measurements/save-error";
import { MeasurementErrorText } from "./v2-tool-workbench";

/**
 * T-080: what the workbench says when a save or delete fails. Each kind renders its own copy, and
 * only an expired session links anywhere: to the localized login page, because signing in again is
 * the fix and clicking save again is not.
 */

const MESSAGES = { tr: trMessages, en: enMessages } as const;

function render(locale: Locale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Istanbul">
      {element}
    </NextIntlClientProvider>,
  );
}

const escape = (text: string) => text.replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("MeasurementErrorText", () => {
  it.each([
    ["tr", "/giris"],
    ["en", "/en/login"],
  ] as const)("%s: an expired session links to the localized login page", (locale, href) => {
    const html = render(
      locale,
      <MeasurementErrorText messageKey={SAVE_ERROR_MESSAGE_KEY["session-expired"]} />,
    );
    expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain(escape(MESSAGES[locale].Measurements.saveError));
  });

  it("uses the same session copy for a delete as for a save", () => {
    expect(DELETE_ERROR_MESSAGE_KEY["session-expired"]).toBe(
      SAVE_ERROR_MESSAGE_KEY["session-expired"],
    );
  });

  it.each(["tr", "en"] as const)(
    "%s: quota, generic save and delete failures each render their own copy, unlinked",
    (locale) => {
      const m = MESSAGES[locale].Measurements;
      const cases = [
        [SAVE_ERROR_MESSAGE_KEY["quota-exceeded"], m.saveQuotaError],
        [SAVE_ERROR_MESSAGE_KEY.failed, m.saveError],
        [DELETE_ERROR_MESSAGE_KEY.failed, m.deleteError],
      ] as const;
      for (const [key, copy] of cases) {
        const html = render(locale, <MeasurementErrorText messageKey={key} />);
        expect(html, key).toBe(escape(copy));
      }
    },
  );
});
