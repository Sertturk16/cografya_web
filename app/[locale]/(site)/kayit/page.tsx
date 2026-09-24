import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { AUTH_SURFACE, buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { CardGridSkeleton } from "@/components/patterns/page-skeleton";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2RegisterCard } from "@/components/v2/v2-register-card";
import { V2AuthBenefitsPlate } from "@/components/v2/v2-auth-benefits-plate";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
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
    title: t("register.heading"),
    description: t("register.metaDescription"),
  });
}

async function RegisterCard({ locale }: { locale: Locale }) {
  const provinces = await getProvinces();
  return <V2RegisterCard locale={locale} provinces={provinces} />;
}

export default async function V2RegisterPage({ params }: V2RegisterPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: "Üye Ol", path: "/kayit" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface={AUTH_SURFACE} />

        {/* Same defect and same fix as `/giris` — see that page for the reasoning. `noindex` in
            both locales, so this closes an accessibility gap rather than an SEO one.
            DELIBERATELY NOT the register card's own header, which is `<h2>` at
            `v2-register-card.tsx:359` and switches between "Hesap Oluştur" and "E-posta Doğrulama"
            on CLIENT step state this Server Component cannot see. Promoting that one in place
            would have made the document's only `<h1>` change text mid-flow; the page keeps a
            stable title above it and the card's header stays the section heading it already is. */}
        <PageHero tier="hub" heading={t("register.heading")} />

        {/* 2-Column Auth Workbench: Form on Left/Center, Benefits Showcase on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Register Form Container */}
          <div className="lg:col-span-6 xl:col-span-5 w-full">
            <Suspense fallback={<CardGridSkeleton columns="2" count={1} height="form" />}>
              <RegisterCard locale={locale} />
            </Suspense>
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
