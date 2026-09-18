import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { AUTH_SURFACE, buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2PasswordResetRequestCard } from "@/components/v2/v2-password-reset-request-card";
import { PageContainer } from "@/components/patterns/page-container";
import { Card } from "@/components/ui/card";

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
    { label: t("breadcrumb.home"), href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: t("reset.heading"), path: "/sifre-sifirlama" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface={AUTH_SURFACE} />

        <div className="max-w-xl">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            {t("reset.heading")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{t("reset.metaDescription")}</p>
          <Card variant="panel" elevation="xl">
            <V2PasswordResetRequestCard />
          </Card>
        </div>
      </PageContainer>
    </>
  );
}
