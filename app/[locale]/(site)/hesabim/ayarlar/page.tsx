import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home } from "lucide-react";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { AUTH_SURFACE, buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { readProfileForPage } from "@/lib/profile/profile.server";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { Profile } from "@/lib/api/types";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { CardGridSkeleton } from "@/components/patterns/page-skeleton";
import { PageContainer } from "@/components/patterns/page-container";
import { H1 } from "@/components/patterns/typography";
import { V2AccountSettings } from "@/components/v2/v2-account-settings";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface AccountSettingsPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: AccountSettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return buildAuthMetadata({
    locale,
    pathname: "/hesabim/ayarlar",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

async function AccountSettings({ locale, profile }: { locale: Locale; profile: Profile }) {
  const rawProvinces = await getProvincesResilient();
  const provinces = rawProvinces.map((p) => ({ plateCode: p.plateCode, nameTr: p.nameTr }));
  return <V2AccountSettings locale={locale} profile={profile} provinces={provinces} />;
}

export default async function AccountSettingsPage({ params }: AccountSettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Settings" });

  const result = await readProfileForPage();

  if (result.kind === "unauthenticated") {
    redirect(getPathname({ locale, href: "/giris" }));
  }

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: t("breadcrumbHome"), href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: t("breadcrumbAccount"), href: "/hesabim", path: "/hesabim" },
    { label: t("breadcrumbCurrent"), path: "/hesabim/ayarlar" },
  ];

  return (
    <PageContainer space="tight">
      <Breadcrumbs items={breadcrumbItems} locale={locale} surface={AUTH_SURFACE} />

      {/* ONE h1 for the page, outside both branches. The alternative — a heading inside the
          loaded branch and another inside the error card — is two reachable h1 elements on
          mutually exclusive conditions, which is the shape `/profil` used to need a named
          exemption for. `H1` is the hub tier from `components/patterns/typography.tsx`, not a
          new spelling: the surface has exactly two h1 tiers and this page is not a third. */}
      <header className="space-y-1.5">
        <H1>{t("heading")}</H1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{t("lede")}</p>
      </header>

      {result.kind === "unavailable" ? (
        <div
          role="alert"
          className="p-8 rounded-3xl border border-destructive/20 bg-card text-center space-y-3 max-w-lg mx-auto shadow-sm"
        >
          <AlertCircle className="size-8 text-destructive mx-auto" />
          <p className="text-base font-bold text-foreground">{t("loadError")}</p>
          <p className="text-xs text-muted-foreground">{t("loadErrorHint")}</p>
        </div>
      ) : (
        <Suspense fallback={<CardGridSkeleton columns="2" count={4} />}>
          <AccountSettings locale={locale} profile={result.profile} />
        </Suspense>
      )}
    </PageContainer>
  );
}
