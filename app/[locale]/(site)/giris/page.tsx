import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2LoginCard } from "@/components/v2/v2-login-card";
import { V2AuthBenefitsPlate } from "@/components/v2/v2-auth-benefits-plate";
import { PageContainer } from "@/components/patterns/page-container";
import { Home } from "lucide-react";

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

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: "Giriş Yap", path: "/giris" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface="noindex" />

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
      </PageContainer>
    </>
  );
}
