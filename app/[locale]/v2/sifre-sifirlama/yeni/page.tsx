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
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2PasswordResetConfirmCard } from "@/components/v2/v2-password-reset-confirm-card";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";

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
    pathname: "/v2/sifre-sifirlama/yeni",
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <V2Header />
        <V2LiveTicker />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">
          <Breadcrumb className="text-xs">
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/v2" />}>
                  <Home className="size-3.5" aria-hidden="true" />
                  <span>{t("breadcrumb.home")}</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/v2/sifre-sifirlama" />}>
                  {t("reset.heading")}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold">{t("resetNew.heading")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="max-w-xl">
            <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
              {t("resetNew.heading")}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">{t("resetNew.metaDescription")}</p>
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl">
              <V2PasswordResetConfirmCard />
            </div>
          </div>

          <V2SourcesSection scope="general" />
        </div>
      </div>

      <V2Footer />
    </div>
  );
}
