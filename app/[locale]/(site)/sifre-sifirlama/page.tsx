import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        <Breadcrumb className="text-xs">
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/" />}>
                <Home className="size-3.5" aria-hidden="true" />
                <span>{t("breadcrumb.home")}</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold">{t("reset.heading")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

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
