import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home, AlertCircle, RefreshCw, GraduationCap } from "lucide-react";
import { Link, getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { AUTH_SURFACE, buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { readProfileForPage } from "@/lib/profile/profile.server";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ProfileForm } from "@/components/v2/v2-profile-form";
import { PageContainer } from "@/components/patterns/page-container";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface V2ProfilePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2ProfilePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return buildAuthMetadata({
    locale,
    pathname: "/profil",
    title: `${t("profile.metaTitle")} — Coğrafya Gurmesi`,
    description: t("profile.metaDescription"),
  });
}

export default async function V2ProfilePage({ params }: V2ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  const result = await readProfileForPage();

  if (result.kind === "unauthenticated") {
    redirect(getPathname({ locale, href: "/giris" }));
  }

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    {
      label: t("profile.breadcrumbHome"),
      href: "/",
      path: "/",
      icon: <Home className="size-3.5" />,
    },
    { label: t("profile.breadcrumbCurrent"), path: "/profil" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer space="tight">
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface={AUTH_SURFACE} />

        {/* Main Content Area */}
        <div>
          {result.kind === "unavailable" && (
            <div
              role="alert"
              className="p-8 rounded-3xl border border-destructive/20 bg-card text-center space-y-4 max-w-lg mx-auto shadow-sm"
            >
              <AlertCircle className="size-8 text-destructive mx-auto" />
              <h2 className="text-base font-bold text-foreground">{t("profile.loadError")}</h2>
              <div>
                <Link
                  href="/profil"
                  className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg h-10 px-4 py-2 text-xs bg-primary text-white hover:bg-primary shadow-sm"
                >
                  <RefreshCw className="size-3.5 mr-2" />
                  {t("profile.retry")}
                </Link>
              </div>
            </div>
          )}

          {result.kind === "ok" && result.profile.accountRole === "TEACHER" && (
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6 max-w-2xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <GraduationCap className="size-5" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">
                    {t("profile.teacherHeading")}
                  </h1>
                </div>
                <Badge variant="success" size="default" dot>
                  {t("profile.complete")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("profile.teacherDescription")}
              </p>
            </div>
          )}

          {result.kind === "ok" && result.profile.accountRole === "STUDENT" && (
            <div className="max-w-2xl mx-auto w-full">
              <V2ProfileForm locale={locale} profile={result.profile} />
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
