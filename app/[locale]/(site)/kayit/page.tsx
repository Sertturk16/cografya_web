import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2RegisterCard } from "@/components/v2/v2-register-card";
import { V2AuthBenefitsPlate } from "@/components/v2/v2-auth-benefits-plate";
import { PageContainer } from "@/components/patterns/page-container";
import { getProvinces } from "@/lib/api/provinces";
import { Home } from "lucide-react";

/**
 * `force-dynamic`: the province list feeds a REQUIRED registration-form field. The previous
 * `revalidate = 86400` meant a build-time api outage could bake an empty province list into
 * this route and serve it for up to 24 hours before ISR self-healed — the worst window of
 * this bug class found in the repo (T-020's bug class). Freshness/caching risk is negligible
 * here: this is a low-traffic authenticated/transactional flow, not a content hub.
 */
export const dynamic = "force-dynamic";

interface V2RegisterPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2RegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  // `buildAuthMetadata`, not `buildMetadata`: these shells predated the AUTH_PATHNAMES
  // centralization and called the general helper with the surface spelled out by hand, which
  // is exactly the way a page gets the surface wrong. Now that they serve `/kayit` — an
  // AUTH_PATHNAMES member — the G1 gate in `lib/seo/auth-routes.test.ts` requires the helper,
  // and the helper is the single place the noindex surface is decided.
  return buildAuthMetadata({
    locale,
    pathname: "/kayit",
    title: `${t("register.heading")} — Coğrafya Gurmesi`,
    description: t("register.metaDescription"),
  });
}

export default async function V2RegisterPage({ params }: V2RegisterPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const provinces = await getProvinces();

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: "Üye Ol", path: "/kayit" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface="noindex" />

        {/* 2-Column Auth Workbench: Form on Left/Center, Benefits Showcase on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Register Form Container */}
          <div className="lg:col-span-6 xl:col-span-5 w-full">
            <V2RegisterCard locale={locale} provinces={provinces} />
          </div>

          {/* Value Proposition & Feature Showcase */}
          <div className="lg:col-span-6 xl:col-span-7">
            <V2AuthBenefitsPlate mode="register" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
