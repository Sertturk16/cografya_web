import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2GameHub } from "@/components/v2/v2-game-hub";
import { V2GameHistoryStats } from "@/components/v2/v2-game-history-stats";
import { V2GamePedagogyGuide } from "@/components/v2/v2-game-pedagogy-guide";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
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
    surface: "noindex",
    hrefForLocale: () => "/v2/oyun",
    title: "Harita Oyunları & Sınavlar v2 — 81 İl ve Bölge Bulma",
    description:
      "Dilsiz harita üzerinde Türkiye illerini ve coğrafi bölgelerini bularak harita hafızanızı geliştirin.",
  });
}

export default async function V2OyunPage({ params }: V2OyunPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          learningResourceJsonLd({
            name: "Harita Oyunları & Coğrafya Sınavları v2",
            description: "Dilsiz Türkiye haritası üzerinde illeri ve coğrafi bölgeleri keşfet.",
            path: "/v2/oyun",
            locale,
            learningResourceType: "Game",
            teaches: "Türkiye illeri, coğrafi bölgeleri ve harita konum bilgisi",
          }),
        ]}
      />

      <div>
        {/* V2 Header */}
        <V2Header />

        {/* Live Telemetry Ticker */}
        <V2LiveTicker />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">
          {/* Breadcrumb & Header Hero */}
          <div className="space-y-4">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Link
                href="/v2"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Home className="size-3.5" />
                <span>Ana Sayfa</span>
              </Link>
              <ChevronRight className="size-3.5" />
              <span className="text-foreground font-semibold">Harita Oyunları v2</span>
            </nav>

            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" icon={<Gamepad2 className="size-3.5" />}>
                    Oyunlaştırılmış Coğrafya v2
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    3 İnteraktif Sınav Modu
                  </Badge>
                </div>

                <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
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
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">
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
        </div>
      </div>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
