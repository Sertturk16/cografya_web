import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Home, ChevronRight } from "lucide-react";
import { Link, getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { getSession } from "@/lib/auth/session";
import { readProfileForPage } from "@/lib/profile/profile.server";
import { getProvincesResilient } from "@/lib/api/provinces";
import { getCountriesResilient } from "@/lib/api/countries";
import { getRegionsResilient } from "@/lib/api/regions";
import { getBooksResilient } from "@/lib/api/books";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2MemberHub } from "@/components/v2/v2-member-hub";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface V2MemberHubPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2MemberHubPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildAuthMetadata({
    locale,
    pathname: "/v2/hesabim",
    title: "Hesabım & Üyelik Merkezi — Coğrafya Gurmesi",
    description:
      "Kişisel coğrafya üyelik merkeziniz: favorileriniz, video çözümleriniz, sınav geçmişiniz ve kayıtlı ölçümleriniz.",
  });
}

export default async function V2MemberHubPage({ params }: V2MemberHubPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(getPathname({ locale, href: "/v2/giris" }));
  }

  const profileResult = await readProfileForPage();
  const profile = profileResult.kind === "ok" ? profileResult.profile : null;

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
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <V2Header />
        <V2LiveTicker />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-8">
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
              <span>Ana sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Hesabım</span>
          </nav>

          {/* Member Hub Island */}
          <V2MemberHub
            session={session}
            profile={profile}
            provinces={provinces}
            countries={countries}
            regions={regions}
            books={books}
          />

          <V2SourcesSection scope="general" />
        </main>
      </div>

      <V2Footer />
    </div>
  );
}
