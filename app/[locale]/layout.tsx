import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthMount } from "@/components/auth/auth-mount";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { fraunces, nunitoSans } from "@/lib/fonts";
import { getSiteUrl, siteConfig } from "@/lib/seo/site";
import "../globals.css";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Root viewport (this locale layout IS the root layout in the next-intl setup).
// `themeColor` tints mobile browser chrome; the hex mirrors the Terra
// `--color-primary` token (globals.css) — the metadata layer cannot read CSS vars.
export const viewport: Viewport = {
  themeColor: "#b0522e",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return {
    // Resolves every page's relative canonical/hreflang/OG URLs (CONVENTIONS §6 #2).
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: t("metaTitle"),
      template: `%s · ${siteConfig.name}`,
    },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enables static rendering for this request's locale.
  setRequestLocale(locale);
  const t = await getTranslations("Common");

  return (
    <html lang={locale} className={`${fraunces.variable} ${nunitoSans.variable}`}>
      <body>
        {/* Supplies locale + messages to client components (e.g. the locale
            switcher). v4 auto-inherits the request config; the message catalogue
            is small, so it is not scoped further yet. */}
        <NextIntlClientProvider>
          <a href="#main-content" className="skip-link">
            {t("skipToContent")}
          </a>
          <SiteHeader locale={locale} />
          {/* tabIndex={-1} makes the skip-link target programmatically focusable so
              AT focus actually moves here on activation — Safari/VoiceOver do not
              focus a plain id target otherwise (a11y). */}
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
          {/* Mounted once, site-wide (uyelik-auth-redesign plan §5.7) — renders nothing until
              a gated action first opens it; see `AuthMount`'s own docblock for the SEO/CWV
              reasoning. */}
          <AuthMount locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
