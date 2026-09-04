import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2LoginCard } from "@/components/v2/v2-login-card";
import { V2AuthBenefitsPlate } from "@/components/v2/v2-auth-benefits-plate";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Home, ChevronRight } from "lucide-react";

export const revalidate = 86400;

interface V2LoginPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return buildMetadata({
    locale,
    surface: "noindex",
    hrefForLocale: () => "/v2/giris",
    title: `${t("login.heading")} — Coğrafya Gurmesi`,
    description: t("login.metaDescription"),
  });
}

export default async function V2LoginPage({ params }: V2LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        {/* V2 Header */}
        <V2Header />

        {/* Live Telemetry Ticker */}
        <V2LiveTicker />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">
          {/* Breadcrumb Navigation */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/v2"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Giriş Yap v2</span>
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

          {/* SECTION: ACADEMIC & SCIENTIFIC DATA SOURCES (KAYNAKÇA) */}
          <V2SourcesSection scope="general" />
        </div>
      </div>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
