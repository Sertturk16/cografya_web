import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Home } from "lucide-react";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { AUTH_SURFACE, buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { getSession } from "@/lib/auth/session";
import { readProfileForPage } from "@/lib/profile/profile.server";
import { getProvincesResilient } from "@/lib/api/provinces";
import { getCountriesResilient } from "@/lib/api/countries";
import { getRegionsResilient } from "@/lib/api/regions";
import { getBooksResilient } from "@/lib/api/books";
import type { Profile, Session } from "@/lib/api/types";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { CardGridSkeleton } from "@/components/patterns/page-skeleton";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2MemberHub } from "@/components/v2/v2-member-hub";
import { PageContainer } from "@/components/patterns/page-container";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface V2MemberHubPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2MemberHubPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildAuthMetadata({
    locale,
    pathname: "/hesabim",
    title: "Hesabım",
    description: "Favorilerin, video ilerlemen, oyun geçmişin ve kayıtlı ölçümlerin tek yerde.",
  });
}

async function MemberHub({ session, profile }: { session: Session; profile: Profile | null }) {
  const [rawProvinces, rawCountries, rawRegions, rawBooks] = await Promise.all([
    getProvincesResilient(),
    getCountriesResilient(),
    getRegionsResilient(),
    getBooksResilient(),
  ]);

  const provinces = rawProvinces.map((p) => ({
    plateCode: p.plateCode,
    nameTr: p.nameTr,
    slugTr: p.slugTr,
  }));

  const countries = rawCountries.map((c) => ({
    isoCode: c.isoCode,
    nameTr: c.nameTr,
    slugTr: c.slugTr,
  }));

  const regions = rawRegions.map((r) => ({
    slug: r.slug,
    nameTr: r.nameTr,
  }));

  const books = rawBooks.map((b) => ({
    titleTr: b.titleTr,
    slugTr: b.slugTr,
  }));

  return (
    <V2MemberHub
      session={session}
      profile={profile}
      provinces={provinces}
      countries={countries}
      regions={regions}
      books={books}
    />
  );
}

export default async function V2MemberHubPage({ params }: V2MemberHubPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(getPathname({ locale, href: "/giris" }));
  }

  const profileResult = await readProfileForPage();
  const profile = profileResult.kind === "ok" ? profileResult.profile : null;

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: "Ana sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: "Hesabım", path: "/hesabim" },
  ];

  return (
    <>
      <V2LiveTicker />

      <PageContainer space="tight">
        <Breadcrumbs items={breadcrumbItems} locale={locale} surface={AUTH_SURFACE} />

        {/* Member Hub Island */}
        <Suspense
          fallback={
            <div aria-busy="true">
              <CardGridSkeleton columns="2" count={4} announce={false} />
            </div>
          }
        >
          <MemberHub session={session} profile={profile} />
        </Suspense>
      </PageContainer>
    </>
  );
}
