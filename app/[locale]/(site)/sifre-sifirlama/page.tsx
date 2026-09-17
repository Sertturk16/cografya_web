import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2PasswordResetRequestCard } from "@/components/v2/v2-password-reset-request-card";
import { PageContainer } from "@/components/patterns/page-container";

interface V2PasswordResetRequestPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: V2PasswordResetRequestPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return buildAuthMetadata({
    locale,
    pathname: "/sifre-sifirlama",
    title: t("reset.metaTitle"),
    description: t("reset.metaDescription"),
  });
}

export default async function V2PasswordResetRequestPage({
  params,
}: V2PasswordResetRequestPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: t("breadcrumb.home"), href: "/", path: "/" },
    { label: t("reset.heading"), path: "/sifre-sifirlama" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface="noindex" />

        <div className="max-w-xl">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            {t("reset.heading")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{t("reset.metaDescription")}</p>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl">
            <V2PasswordResetRequestCard />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
