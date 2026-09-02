import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2BooksHub } from "@/components/v2/v2-books-hub";
import { V2StudyStrategyGuide } from "@/components/v2/v2-study-strategy-guide";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Video,
  GraduationCap,
  Home,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const revalidate = 86400;

interface V2KitaplarPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2KitaplarPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Video Çözümlü Coğrafya Kitapları v2 — AYT & TYT Branş Denemeleri",
    description: "AYT Coğrafya Konu Özetli Branş Denemeleri soru bazlı ayrıntılı video çözümleri, konu kazanım analizleri ve sınav hazırlık rehberi.",
    alternates: {
      canonical: "/v2/kitaplar",
    },
  };
}

export default async function V2KitaplarPage({ params }: V2KitaplarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Video Çözümlü Coğrafya Kitapları v2",
            description: "AYT Coğrafya Konu Özetli Branş Denemeleri soru bazlı ayrıntılı video çözümleri ve sınav hazırlık rehberi.",
            path: "/v2/kitaplar",
            locale,
          }),
          itemListJsonLd({
            name: "Video Çözümlü Kitaplar",
            items: [
              {
                name: "AYT Coğrafya Konu Özetli Branş Denemeleri",
                path: "/v2/kitaplar/ayt-cografya-brans-denemeleri",
              },
            ],
          }),
        ]}
      />

      {/* V2 Header */}
      <V2Header />

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-14">
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/v2" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Video Çözümlü Kitaplar v2</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
                  Dijital Eğitim Platformu v2
                </Badge>
                <Badge variant="secondary" size="sm">
                  AYT &bull; TYT &bull; KPSS
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                Video Çözümlü Coğrafya Kitapları
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Yazar Murat Şenocak tarafından hazırlanan AYT Coğrafya Konu Özetli Branş Denemeleri&apos;nin soru bazlı video çözümleri, kazanım etiketleri ve sınav stratejileri.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">20 Deneme</span>
                <span className="text-xs text-muted-foreground font-medium">Tamamı Video Çözümlü</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">120 Soru</span>
                <span className="text-xs text-muted-foreground font-medium">ÖSYM Soru Tipleri</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">HD Video</span>
                <span className="text-xs text-muted-foreground font-medium">Soru Başına Anlatım</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">2026</span>
                <span className="text-xs text-muted-foreground font-medium">Güncel Müfredat Uyumu</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE BOOKS & VIDEO SOLUTION BENCH */}
        <V2BooksHub />

        {/* SECTION 2: STUDY STRATEGY & EXAM TOPIC GUIDE */}
        <V2StudyStrategyGuide />

        {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
        <V2SourcesSection scope="kitaplar" />
      </main>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
