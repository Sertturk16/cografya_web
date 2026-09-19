import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { fraunces, nunitoSans } from "@/lib/fonts";
import { getSiteUrl, siteConfig } from "@/lib/seo/site";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { V2AuthDialog } from "@/components/v2/v2-auth-dialog";
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
  // A pair, so mobile browser chrome follows the theme instead of staying terracotta on a
  // dark page. The light value is `--color-primary`; the dark value is the near-black the
  // `.dark` block currently paints, and it is PROVISIONAL — T-034 phase C replaces the whole
  // dark palette, and this hex has to move with it. The metadata layer cannot read CSS
  // variables, which is why both are written out here.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#b0522e" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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

  return (
    /* `suppressHydrationWarning`: next-themes' blocking script sets the theme class on
       <html> before React hydrates, so server and client markup differ by design. Without
       it React logs a mismatch on every load. */
    <html
      lang={locale}
      className={`${fraunces.variable} ${nunitoSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          {/* Supplies locale + messages to client components (e.g. the locale
            switcher). v4 auto-inherits the request config; the message catalogue
            is small, so it is not scoped further yet. */}
          <NextIntlClientProvider>
            {/* T-032 PR3: the document shell only. Header, footer, the skip link and the
              single `<main>` moved into `(site)/layout.tsx`, so a reading page cannot ship
              without them and the three fullscreen play screens opt out by living in a
              sibling group rather than by omitting an import somebody has to remember. */}
            {children}
            <Toaster />
            {/* T-057: mounted HERE, beside the other always-on singleton, and not in a route
              group. `requestAuth()` only commits to a module store; this is the one component
              that subscribes to it and renders anything, so a gated control whose tree omits
              it fails silently — the button works, the call lands nowhere. `(site)` owned the
              only mount and justified it with "the play screens have no auth affordances to
              open it from", which was already false when written: `v2-game-screen.tsx`,
              `v2-leaderboard-modal.tsx` and the `V2Header` the game screens render themselves
              add up to six dead calls across the three `(play)` routes. One mount cannot be
              forgotten by a route group that does not exist yet; two would be.
              `components/v2/auth-dialog-reachability.test.ts` holds the invariant. */}
            <V2AuthDialog />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
