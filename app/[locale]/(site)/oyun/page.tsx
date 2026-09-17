import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2GameHub } from "@/components/v2/v2-game-hub";
import { V2GameHistoryStats } from "@/components/v2/v2-game-history-stats";
import { V2GamePedagogyGuide } from "@/components/v2/v2-game-pedagogy-guide";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Home, ChevronRight } from "lucide-react";

export const revalidate = 86400;

interface V2OyunPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2OyunPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    hrefForLocale: () => "/oyun",
    // `trOnly` for the same reason as `/deprem`: zero `getTranslations` calls, no `locale`
    // branch, seventeen lines of Turkish — and, until now, an English URL in the sitemap
    // claiming to be the English version of it. See that page's note; `messages/en.json`'s
    // `Game` namespace is the larger of the two and the wiring is the real fix.
    surface: "trOnly",
    title: "Harita Oyunları & Sınavlar — 81 İl ve Bölge Bulma",
    description:
      "Dilsiz harita üzerinde Türkiye illerini ve coğrafi bölgelerini bularak harita hafızanızı geliştirin.",
  });
}

export default async function V2OyunPage({ params }: V2OyunPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          learningResourceJsonLd({
            name: "Harita Oyunları & Coğrafya Sınavları",
            description: "Dilsiz Türkiye haritası üzerinde illeri ve coğrafi bölgeleri keşfet.",
            path: "/oyun",
            locale,
            learningResourceType: "Game",
            teaches: "Türkiye illeri, coğrafi bölgeleri ve harita konum bilgisi",
          }),
        ]}
      />

      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Harita Oyunları</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Gamepad2 className="size-3.5" />}>
                  Oyunlaştırılmış Coğrafya
                </Badge>
                <Badge variant="secondary" size="sm">
                  3 İnteraktif Sınav Modu
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
                Harita Oyunları &amp; Coğrafya Sınavları
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Dilsiz Türkiye haritası üzerinde illeri doğru bularak puan toplayın, bölge bazlı
                sınavlara katılın ve mekânsal hafızanızı en üst seviyeye çıkarın.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  3 Oyun
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Farklı Sınav &amp; Test Modu
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  81 İl
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Eksiksiz Soru Havuzu
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                  7 Bölge
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Bölgesel Harita Tamamlama
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  %100
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Gerçek Zamanlı Geri Bildirim
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: FULL INTERACTIVE VECTOR MAP GAME ENGINE */}
        <V2GameHub />

        {/* SECTION 2: ACHIEVEMENTS & PERSONAL BESTS */}
        <V2GameHistoryStats />

        {/* SECTION 3: PEDAGOGICAL LEARNING GUIDE */}
        <V2GamePedagogyGuide />

        {/* SECTION 4: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
        <V2SourcesSection scope="oyun" />
      </PageContainer>
    </>
  );
}
