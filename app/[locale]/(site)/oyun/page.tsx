import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2GameHub } from "@/components/v2/v2-game-hub";
import { V2GameHistoryStats } from "@/components/v2/v2-game-history-stats";
import { V2GamePedagogyGuide } from "@/components/v2/v2-game-pedagogy-guide";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Home } from "lucide-react";
import { Card } from "@/components/ui/card";

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
    title: "Harita Oyunları — Dilsiz Haritada 81 İl ve Bölge Bulma",
    description:
      "Dilsiz Türkiye haritasında 81 ili ve 7 coğrafi bölgeyi bul. Üç oyun var: bölge bulma, 81 il bulma ve bölge bölge il bulma. Takılırsan ipucu al.",
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
            name: "Harita Oyunları",
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
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Harita Oyunları", path: "/oyun" },
            ]}
            locale={locale}
            surface="trOnly"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Harita Oyunları"
              lede={
                <>
                  Dilsiz haritada il ve bölge adları yazmaz. Sorulan yeri bulup tıkladıkça puan
                  toplarsın.
                </>
              }
            />

            {/* Metric Strip */}
            <StatGrid gutter="hero">
              <StatTile label="Aşağıdan birini seç" fact="3 Oyun" tone="primary" />
              <StatTile label="Türkiye'nin tüm illeri" fact="81 İl" tone="secondary" />
              <StatTile label="Bölgeyi ya da illerini bul" fact="7 Bölge" tone="accent" />
              <StatTile label="Klasik, zamana karşı, alıştırma" fact="3 Zorluk" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: FULL INTERACTIVE VECTOR MAP GAME ENGINE */}
        <V2GameHub />

        {/* SECTION 2: ACHIEVEMENTS & PERSONAL BESTS */}
        <V2GameHistoryStats />

        {/* SECTION 3: PEDAGOGICAL LEARNING GUIDE */}
        <V2GamePedagogyGuide />
      </PageContainer>
    </>
  );
}
