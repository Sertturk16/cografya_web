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
import { V2VerifyEmailCard } from "@/components/v2/v2-verify-email-card";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";

interface V2VerifyEmailPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2VerifyEmailPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return buildAuthMetadata({
    locale,
    pathname: "/e-posta-dogrulama",
    title: t("verify.metaTitle"),
    description: t("verify.metaDescription"),
  });
}

export default async function V2VerifyEmailPage({ params }: V2VerifyEmailPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <>
      <V2LiveTicker />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">
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
              <BreadcrumbPage className="font-semibold">{t("verify.heading")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="max-w-xl">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            {t("verify.heading")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{t("verify.metaDescription")}</p>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl">
            <V2VerifyEmailCard locale={locale} />
          </div>
        </div>

        <V2SourcesSection scope="general" />
      </div>
    </>
  );
}
