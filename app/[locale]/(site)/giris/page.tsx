import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2LoginCard } from "@/components/v2/v2-login-card";
import { V2AuthBenefitsPlate } from "@/components/v2/v2-auth-benefits-plate";
import { Home, ChevronRight } from "lucide-react";

export const revalidate = 86400;

interface V2LoginPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  // `buildAuthMetadata`, not `buildMetadata`: these shells predated the AUTH_PATHNAMES
  // centralization and called the general helper with the surface spelled out by hand, which
  // is exactly the way a page gets the surface wrong. Now that they serve `/giris` — an
  // AUTH_PATHNAMES member — the G1 gate in `lib/seo/auth-routes.test.ts` requires the helper,
  // and the helper is the single place the noindex surface is decided.
  return buildAuthMetadata({
    locale,
    pathname: "/giris",
    title: `${t("login.heading")} — Coğrafya Gurmesi`,
    description: t("login.metaDescription"),
  });
}

export default async function V2LoginPage({ params }: V2LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* V2 Header */}

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="size-3.5" />
            <span>Ana Sayfa</span>
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-semibold">Giriş Yap</span>
        </nav>

        {/* 2-Column Auth Workbench: Form on Left/Center, Benefits Showcase on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Container */}
          <div className="lg:col-span-6 xl:col-span-5 w-full">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl">
              <V2LoginCard locale={locale} />
            </div>
          </div>

          {/* Value Proposition & Feature Showcase */}
          <div className="lg:col-span-6 xl:col-span-7 h-full">
            <V2AuthBenefitsPlate mode="login" />
          </div>
        </div>
      </div>

      {/* Modern V2 Footer */}
    </>
  );
}
