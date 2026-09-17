import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import { Breadcrumbs } from "./breadcrumbs";

const TRAIL = [
  { label: "Ana Sayfa", href: "/" as const, path: "/" },
  { label: "CBS Araçları", path: "/araclar" },
];

/**
 * `@/i18n/navigation`'s `Link` reads the active locale through `useLocale()`, which throws
 * ("No intl context found") without a provider — vitest resolves next-intl's client bundle
 * here (no `react-server` condition set, unlike a real RSC render), so the component needs
 * the same provider a real client tree would have above it. `messages` is omitted: `Link`
 * only reads the locale, and `Breadcrumbs` renders no translated strings of its own.
 */
function renderWithIntl(locale: Locale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale}>{element}</NextIntlClientProvider>,
  );
}

describe("Breadcrumbs", () => {
  it("marks the current page with aria-current", () => {
    // Not cosmetic. `aria-current` occurs zero times across the product surface today: 28
    // pages render a trail whose last item is a plain styled span, so assistive technology
    // is never told which crumb is the page you are on.
    const html = renderWithIntl(
      "tr",
      <Breadcrumbs items={TRAIL} locale="tr" surface="localized" />,
    );
    expect(html).toContain('aria-current="page"');
  });

  it("renders a real list, not a row of spans", () => {
    const html = renderWithIntl(
      "tr",
      <Breadcrumbs items={TRAIL} locale="tr" surface="localized" />,
    );
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
  });

  it("emits BreadcrumbList JSON-LD from the same array on an indexable page", () => {
    const html = renderWithIntl(
      "tr",
      <Breadcrumbs items={TRAIL} locale="tr" surface="localized" />,
    );
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"name":"CBS Araçları"');
  });

  it("emits no JSON-LD on a page this locale cannot index", () => {
    // The gate is computed from the surface, never passed per page: a per-page boolean is how
    // 24 files ended up with a visible trail and no structured data.
    const html = renderWithIntl("en", <Breadcrumbs items={TRAIL} locale="en" surface="trOnly" />);
    expect(html).not.toContain("BreadcrumbList");
  });
});
