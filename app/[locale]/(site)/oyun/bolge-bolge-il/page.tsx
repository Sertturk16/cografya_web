import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import { buildGameShapes } from "@/lib/game/map-shapes";
import { getRegionLabels } from "@/components/game/region-labels";
import { PageContainer } from "@/components/patterns/page-container";
import { REGION_KEYS, regionSlug } from "@/lib/game/region-slug";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2RegionThumb, V2RegionThumbDefs } from "@/components/v2/v2-region-thumb";
import { MapAttribution } from "@/components/patterns/map-attribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Layers, Home, ArrowRight, RotateCcw } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Game" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/oyun/bolge-bolge-il",
    // `mode3PickerMetaTitle`/`mode3PickerMetaDescription` were invented by the V2 rewrite and
    // never added to either catalogue, so this page's <title> and description shipped as the
    // literal dotted key strings. next-intl logs and returns the key rather than throwing, and
    // the page is `noindex`, so nothing surfaced it until `pnpm build` prerendered the EN route.
    // These are the keys the other three mode screens use, and the ones V1 used here.
    title: t("modeMetaTitle", { mode: t("mode3Name"), brand: t("brandName") }),
    description: t("mode3Body"),
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
    const members = allShapes.filter((s) => s.target?.region === regionKey).map((s) => s.plateCode);
    return {
      id: regionKey,
      slug: regionSlug(regionKey),
      name: regionLabels[regionKey],
      members,
    };
  });

  /**
   * The thumbnails' degradation path. With no seeded provinces every `<defs>` entry is missing,
   * so each card would render a `<use>` at a dangling `href` — a bordered, empty frame rather
   * than no picture at all. The cards stand on their own without the thumbnail, so the whole
   * feature is gated on having something to draw, exactly as the V1 page gated it.
   */
  const hasThumbs = allShapes.length > 0;

  return (
    <>
      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      {/* SVG Defs for mini-thumbnails */}
      {hasThumbs ? <V2RegionThumbDefs shapes={allShapes} /> : null}

      <PageContainer space="tight">
        {/* Top Navigation & Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Harita Oyunları", href: "/oyun", path: "/oyun" },
              { label: "Bölge Seçimi", path: "/oyun/bolge-bolge-il" },
            ]}
            locale={locale}
            surface="noindex"
          />

          <Link href="/oyun">
            <Button variant="outline" size="sm" leftIcon={<RotateCcw className="size-3.5" />}>
              Oyunlara Dön
            </Button>
          </Link>
        </div>

        {/* Header Hero Banner */}
        <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Layers className="size-3.5" />}>
              Bölge Bölge İl Bulma
            </Badge>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Bir Bölge Seç
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Harita yalnız seçtiğin bölgeyi gösterir ve onu ekranı dolduracak kadar büyütür; komşu
            bölgeler ve Türkiye dışı ekrandan çıkar. Sorular da o bölgenin illerinden gelir.
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
              {hasThumbs ? <V2RegionThumb region={region.id} members={region.members} /> : null}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {region.name}
                  </h3>
                </div>
                {/* NO COUNT ON THE CARD, neither as a badge nor in a sentence under the name.
                    "11 il" is the badge the owner removed from the mode cards one level up
                    (DEC 2026-07-30q) and then from these cards too (DEC 2026-08-05g md.3); the
                    V2 rewrite reintroduced it in both places. No sentence under the name
                    either: the same line on all seven cards told the reader nothing. */}
              </div>

              <Link
                href={{
                  pathname: "/oyun/bolge-bolge-il/[bolge]",
                  params: { bolge: region.slug },
                }}
              >
                <Button
                  variant="primary"
                  className="w-full justify-between"
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  <span>Başla</span>
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* ONE credit for the whole thumbnail grid, not one per card. `V2RegionThumb` draws
            OSM-derived province polygons (`PROVINCE_SHAPES`) in seven `aria-hidden` thumbnails
            and carried no credit at all; ODbL's obligation is per PAGE, so one line under the
            grid discharges it for all seven. It does NOT live in `V2RegionThumb` itself — a
            68-line decorative thumbnail with a caption of its own would be absurd, and seven
            identical captions on one screen worse. */}
        <MapAttribution />
      </PageContainer>
    </>
  );
}
