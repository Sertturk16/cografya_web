import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home, ChevronRight, AlertCircle, RefreshCw, GraduationCap } from "lucide-react";
import { Link, getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { readProfileForPage } from "@/lib/profile/profile.server";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ProfileForm } from "@/components/v2/v2-profile-form";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
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
    pathname: "/v2/profil",
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
    redirect(getPathname({ locale, href: "/v2/giris" }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <V2Header />
        <V2LiveTicker />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-10">
          {/* Breadcrumb Navigation */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/v2"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>{t("profile.breadcrumbHome")}</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">{t("profile.breadcrumbCurrent")}</span>
          </nav>

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
                    href="/v2/profil"
                    className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg h-10 px-4 py-2 text-xs bg-primary text-white hover:bg-[var(--color-primary-dark,#7e3a1e)] shadow-sm"
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
                      {t("profile.heading")}
                    </h1>
                  </div>
                  <Badge variant="success" size="default" dot>
                    {t("profile.complete")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("profile.complete")}
                </p>
              </div>
            )}

            {result.kind === "ok" && result.profile.accountRole === "STUDENT" && (
              <div className="max-w-2xl mx-auto w-full">
                <V2ProfileForm locale={locale} profile={result.profile} />
              </div>
            )}
          </div>

          <V2SourcesSection scope="general" />
        </div>
      </div>

      <V2Footer />
    </div>
  );
}
