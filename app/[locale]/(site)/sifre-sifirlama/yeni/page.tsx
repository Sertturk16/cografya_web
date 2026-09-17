import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2PasswordResetConfirmCard } from "@/components/v2/v2-password-reset-confirm-card";
import { PageContainer } from "@/components/patterns/page-container";

interface V2PasswordResetConfirmPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: V2PasswordResetConfirmPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return buildAuthMetadata({
    locale,
    pathname: "/sifre-sifirlama/yeni",
    title: t("resetNew.metaTitle"),
    description: t("resetNew.metaDescription"),
  });
}

export default async function V2PasswordResetConfirmPage({
  params,
}: V2PasswordResetConfirmPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: t("breadcrumb.home"), href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: t("reset.heading"), href: "/sifre-sifirlama", path: "/sifre-sifirlama" },
    { label: t("resetNew.heading"), path: "/sifre-sifirlama/yeni" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface="noindex" />

        <div className="max-w-xl">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            {t("resetNew.heading")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{t("resetNew.metaDescription")}</p>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl">
            <V2PasswordResetConfirmCard />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
