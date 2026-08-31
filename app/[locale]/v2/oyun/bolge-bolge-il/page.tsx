import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import { buildGameShapes } from "@/lib/game/map-shapes";
import { getRegionLabels } from "@/components/game/region-labels";
import { REGION_KEYS, regionSlug } from "@/lib/game/region-slug";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2RegionThumb, V2RegionThumbDefs } from "@/components/v2/v2-region-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Home, ChevronRight, ArrowRight, RotateCcw } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Game" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/v2/oyun/bolge-bolge-il",
    title: t("mode3PickerMetaTitle", { brand: t("brandName") }),
    description: t("mode3PickerMetaDescription"),
    titleAbsolute: true,
    surface: "noindex",
  });
}

export default async function V2RegionPickerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const summaries = await getMapSummaryResilient();
  const regionLabels = await getRegionLabels(locale);
  const allShapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);

  const regionCards = REGION_KEYS.map((regionKey) => {
    const members = allShapes
      .filter((s) => s.target?.region === regionKey)
      .map((s) => s.plateCode);
    return {
      id: regionKey,
      slug: regionSlug(regionKey),
      name: regionLabels[regionKey],
      count: members.length,
      members,
    };
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* V2 Header */}
      <V2Header />

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      {/* SVG Defs for mini-thumbnails */}
      <V2RegionThumbDefs shapes={allShapes} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        {/* Top Navigation & Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/v2" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <Link href="/v2/oyun" className="hover:text-foreground transition-colors">
              Harita Oyunları v2
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Bölge Seçimi</span>
          </nav>

          <Link href="/v2/oyun">
            <Button variant="outline" size="sm" leftIcon={<RotateCcw className="size-3.5" />}>
              Oyun Hub&apos;ına Dön
            </Button>
          </Link>
        </div>

        {/* Header Hero Banner */}
        <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Layers className="size-3.5" />}>
              Bölgesel Odaklı Mod
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">Bölge Bölge İl Tamamlama</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Bir Coğrafi Bölge Seçin
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Seçtiğiniz bölgenin sınırları otomatik olarak büyütülecek ve harita sadece o bölgenin illerine odaklanacaktır.
          </p>
        </div>

        {/* 7 REGION GRID CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {regionCards.map((region) => (
            <div
              key={region.id}
              className="group rounded-3xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4"
            >
              {/* Region Vector Mini Thumbnail */}
              <V2RegionThumb region={region.id} members={region.members} />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {region.name}
                  </h3>
                  <Badge variant="outline" size="sm" className="font-mono font-semibold text-xs">
                    {region.count} İl
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {region.name} kapsamındaki {region.count} ilin dilsiz haritadaki konumlarını bulun.
                </p>
              </div>

              <Link href={{ pathname: "/v2/oyun/bolge-bolge-il/[bolge]", params: { bolge: region.slug } }}>
                <Button variant="primary" className="w-full justify-between" rightIcon={<ArrowRight className="size-4" />}>
                  <span>Bölgeyi Başlat</span>
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* Sources & Pedagogy Footer Section */}
        <V2SourcesSection />
      </main>
    </div>
  );
}
