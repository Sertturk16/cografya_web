import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo/site";
import { Breadcrumbs, type BreadcrumbTrailItem } from "./breadcrumbs";

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

  it("renders the linked crumb's href, not just its label", () => {
    // The component casts `item.href` (`as unknown as ComponentProps<typeof Link>["href"]`)
    // to get past next-intl's typed `Link` rejecting `AppPathname`'s dynamic-route members —
    // CLAUDE.md's sanctioned escape, but one that bypasses type checking on the exact value
    // that becomes the href. And this test renders through a `NextIntlClientProvider`, a path
    // with no prior precedent in this repo. Asserting the literal `href="/"` covers both: the
    // cast produced the right string, and the provider renders a production-shaped anchor.
    const html = renderWithIntl(
      "tr",
      <Breadcrumbs items={TRAIL} locale="tr" surface="localized" />,
    );
    expect(html).toContain('href="/"');
  });

  it("never emits a second aria-current when a middle item has no href", () => {
    // The component's own condition used to read `index === last || item.href === undefined`
    // — ANY href-less item satisfied that, not only the last one, so a middle item that omits
    // `href` (nothing to link to, but not the page you're on) rendered through `BreadcrumbPage`
    // too and emitted a SECOND `aria-current="page"`. Only the last item may ever be current.
    const trailWithGap = [
      { label: "Ana Sayfa", href: "/" as const, path: "/" },
      { label: "Ortadaki (href yok)", path: "/ortada" },
      { label: "CBS Araçları", path: "/araclar" },
    ];
    const html = renderWithIntl(
      "tr",
      <Breadcrumbs items={trailWithGap} locale="tr" surface="localized" />,
    );
    const occurrences = html.match(/aria-current="page"/g) ?? [];
    expect(occurrences).toHaveLength(1);
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

  it("renders an item's icon and marks it aria-hidden", () => {
    // The owner ruling: the Home icon that preceded "Ana Sayfa" on all 31 hand-written trails
    // stays. It must never be announced on its own — a screen reader that hears the icon AND
    // "Ana Sayfa" is told the same thing twice, on the one component whose job is closing an
    // accessibility gap, not opening one.
    const trailWithIcon: BreadcrumbTrailItem[] = [
      { label: "Ana Sayfa", href: "/", path: "/", icon: <svg data-testid="home-icon" /> },
      { label: "CBS Araçları", path: "/araclar" },
    ];
    const html = renderWithIntl(
      "tr",
      <Breadcrumbs items={trailWithIcon} locale="tr" surface="localized" />,
    );
    expect(html).toContain('data-testid="home-icon"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("never lets the icon reach the JSON-LD", () => {
    // `breadcrumbJsonLd` takes `{ name, path }` — a ReactNode has no business near structured
    // data. Asserts the emitted BreadcrumbList carries only the icon-less item's `name`/`item`
    // pair, never a serialised trace of the icon element itself.
    const trailWithIcon: BreadcrumbTrailItem[] = [
      { label: "Ana Sayfa", href: "/", path: "/", icon: <svg data-testid="home-icon" /> },
      { label: "CBS Araçları", path: "/araclar" },
    ];
    const html = renderWithIntl(
      "tr",
      <Breadcrumbs items={trailWithIcon} locale="tr" surface="localized" />,
    );
    const scriptMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const schema = JSON.parse(scriptMatch![1]!);
    expect(schema.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "CBS Araçları", item: absoluteUrl("/araclar") },
    ]);
    // Belt and braces against the exact origin above ever drifting: no trace of the icon's own
    // element shape (its data-testid, its tag name) leaks into the JSON-LD payload at all.
    expect(scriptMatch![1]).not.toContain("home-icon");
    expect(scriptMatch![1]).not.toContain("svg");
  });
});
