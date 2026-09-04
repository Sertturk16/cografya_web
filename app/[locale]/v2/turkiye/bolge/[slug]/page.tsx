import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2RichProse } from "@/components/v2/v2-rich-prose";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getRegionBySlug, getRegionsResilient } from "@/lib/api/regions";
import type { RegionProvinceItem } from "@/lib/api/types";
import { breadcrumbJsonLd, faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  Mountain,
  Compass,
  MapPin,
  Users,
  Maximize2,
  Waves,
  CloudSun,
  Home,
  ChevronRight,
  TrendingUp,
  Boxes,
  Building2,
  HelpCircle,
  Table,
  Info,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

const REGION_THEMES: Record<
  string,
  {
    nameTr: string;
    badgeClass: string;
    gradient: string;
    accentColor: string;
    borderAccent: string;
  }
> = {
  MARMARA: {
    nameTr: "Marmara Bölgesi",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    gradient: "from-amber-500/10 via-background to-background",
    accentColor: "text-amber-600 dark:text-amber-400",
    borderAccent: "border-amber-500/30",
  },
  EGE: {
    nameTr: "Ege Bölgesi",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    gradient: "from-teal-500/10 via-background to-background",
    accentColor: "text-teal-600 dark:text-teal-400",
    borderAccent: "border-teal-500/30",
  },
  AKDENIZ: {
    nameTr: "Akdeniz Bölgesi",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    gradient: "from-emerald-500/10 via-background to-background",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    borderAccent: "border-emerald-500/30",
  },
  IC_ANADOLU: {
    nameTr: "İç Anadolu Bölgesi",
    badgeClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    gradient: "from-yellow-500/10 via-background to-background",
    accentColor: "text-yellow-600 dark:text-yellow-400",
    borderAccent: "border-yellow-500/30",
  },
  KARADENIZ: {
    nameTr: "Karadeniz Bölgesi",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    gradient: "from-cyan-500/10 via-background to-background",
    accentColor: "text-cyan-600 dark:text-cyan-400",
    borderAccent: "border-cyan-500/30",
  },
  DOGU_ANADOLU: {
    nameTr: "Doğu Anadolu Bölgesi",
    badgeClass: "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30",
    gradient: "from-stone-500/10 via-background to-background",
    accentColor: "text-stone-600 dark:text-stone-400",
    borderAccent: "border-stone-500/30",
  },
  GUNEYDOGU_ANADOLU: {
    nameTr: "Güneydoğu Anadolu Bölgesi",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    gradient: "from-orange-500/10 via-background to-background",
    accentColor: "text-orange-600 dark:text-orange-400",
    borderAccent: "border-orange-500/30",
  },
};

export async function generateStaticParams() {
  const regions = await getRegionsResilient();
  return routing.locales.flatMap((locale) =>
    regions.map((region) => ({ locale, slug: region.slug })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const region = await getRegionBySlug(slug);
  if (!region) return {};

  return buildMetadata({
    locale,
    hrefForLocale: () => ({
      pathname: "/v2/turkiye/bolge/[slug]",
      params: { slug },
    }),
    title: `${region.metaTitle} | Coğrafya Gurmesi`,
    description: region.metaDescription,
    surface: "trOnly",
  });
}

export default async function V2RegionDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const region = await getRegionBySlug(slug);
  if (!region) {
    notFound();
  }

  const format = await getFormatter();
  const theme = REGION_THEMES[region.region] ?? {
    nameTr: region.nameTr,
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    gradient: "from-primary/10 via-background to-background",
    accentColor: "text-primary",
    borderAccent: "border-primary/30",
  };

  const isCoastal = region.coastalSeas.length > 0;
  const canonicalPath = `/v2/turkiye/bolge/${region.slug}`;

  // Strip Markdown table from comparison intro prose if present
  const comparisonIntroText = region.comparisonTr
    ? (region.comparisonTr.split("\n\n|")[0] ?? "").trim()
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <JsonLd
        schema={breadcrumbJsonLd([
          { name: "Ana Sayfa", path: "/v2" },
          { name: "Türkiye Atlası", path: "/v2/turkiye" },
          { name: region.nameTr, path: canonicalPath },
        ])}
      />
      {region.faqs?.length > 0 && (
        <JsonLd
          schema={faqPageJsonLd(
            region.faqs.map((faq) => ({
              question: faq.question,
              answer: faq.answer,
            })),
          )}
        />
      )}

      <V2Header />
      <V2LiveTicker />

      {/* HERO BANNER SECTION */}
      <section
        className={`relative border-b border-border bg-gradient-to-b ${theme.gradient} pt-8 pb-12 overflow-hidden`}
      >
        {/* Glow backdrop */}
        <div className="absolute top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 max-w-7xl relative z-10 space-y-6">
          {/* Breadcrumb Bar */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap"
          >
            <Link
              href="/v2"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <Link href="/v2/turkiye" className="hover:text-foreground transition-colors">
              Türkiye Atlası
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold flex items-center gap-1">
              <span>{region.nameTr}</span>
            </span>
          </nav>

          {/* Main Title & Action Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={theme.badgeClass}>
                  {theme.nameTr}
                </Badge>
                <Badge variant="secondary" className="font-mono font-medium tracking-wide">
                  1941 Coğrafya Kongresi
                </Badge>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Building2 className="size-3 mr-1" /> {region.provinceCount} İl
                </Badge>
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <Boxes className="size-3 mr-1" /> {region.subregionCount} Bölüm
                </Badge>
                {isCoastal ? (
                  <Badge
                    variant="outline"
                    className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 flex items-center gap-1"
                  >
                    <Waves className="size-3" /> {region.coastalSeas.length} Denize Kıyı
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    🌾 İç Bölge
                  </Badge>
                )}
              </div>

              <h1 className="font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
                {region.nameTr}
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
                {region.introTr}
              </p>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/v2/turkiye">
                <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
                  Tüm Bölgeler &amp; İller
                </Button>
              </Link>
            </div>
          </div>

          {/* 4 BIG KEY STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {/* 1. Nüfus */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Toplam Nüfus</span>
                <Users className="size-4 text-primary" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {format.number(region.population)}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Türkiye Payı:</span>
                <span className="font-mono font-semibold text-foreground">
                  %{region.populationSharePercent}
                </span>
              </div>
            </div>

            {/* 2. Yüzölçümü */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Yüzölçümü</span>
                <Maximize2 className="size-4 text-teal-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {format.number(region.areaKm2)} km²
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Alan Payı:</span>
                <span className="font-mono font-semibold text-foreground">
                  %{region.areaSharePercent}
                </span>
              </div>
            </div>

            {/* 3. Nüfus Yoğunluğu */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Nüfus Yoğunluğu</span>
                <Mountain className="size-4 text-amber-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {region.populationDensity} kişi/km²
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>TR Ortalaması:</span>
                <span className="font-mono font-semibold text-foreground">110 kişi/km²</span>
              </div>
            </div>

            {/* 4. GSYH Ağırlığı */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">GSYH Ağırlığı (2024)</span>
                <TrendingUp className="size-4 text-rose-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {region.gdpShareApproxPercent !== null ? `~%${region.gdpShareApproxPercent}` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Kaynak:</span>
                <span className="font-semibold text-foreground">TÜİK İl GSYH</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICKNAV / JUMP NAVIGATION BAR */}
      <nav
        aria-label="Bölüm İndeksi"
        className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border py-2.5 overflow-x-auto scrollbar-none"
      >
        <div className="container mx-auto px-4 max-w-7xl flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
            <Layers className="size-3.5" /> Bölümler:
          </span>
          <a
            href="#kunye"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Künye
          </a>
          <a
            href="#konum"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Konum &amp; Sınırlar
          </a>
          <a
            href="#yeryuzu"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Yeryüzü Şekilleri
          </a>
          <a
            href="#iklim"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            İklim &amp; Bitki
          </a>
          <a
            href="#hidrografya"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Hidrografya
          </a>
          <a
            href="#yerlesme"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Nüfus
          </a>
          <a
            href="#ekonomi"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Ekonomi
          </a>
          <a
            href="#bolumler"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Kongre Bölümleri
          </a>
          <a
            href="#iller"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Bölgedeki İller
          </a>
          <a
            href="#afet"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Deprem &amp; Afet
          </a>
          <a
            href="#kiyaslama"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            7 Bölge Kıyaslama
          </a>
          <a
            href="#sss"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            SSS
          </a>
        </div>
      </nav>

      {/* BODY CONTENT CONTAINER */}
      <main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">
        {/* SECTION 3: KÜNYE & TEMEL BİLGİLER */}
        <section id="kunye" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                Temel Bilgiler
              </Badge>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              {region.nameTr} Coğrafi Künyesi
            </h2>

            {/* Geographical Attributes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* En Yüksek Nokta */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Mountain className="size-4 text-amber-600" />
                  <span>En Yüksek Noktası</span>
                </div>
                <div className="font-heading font-extrabold text-base text-foreground">
                  {region.highestPointName ?? "—"}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {region.highestPointElevationM
                    ? `${format.number(region.highestPointElevationM)} metre`
                    : ""}
                  {region.highestPointProvince ? ` (${region.highestPointProvince})` : ""}
                </p>
              </div>

              {/* Deniz Kıyıları */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Waves className="size-4 text-cyan-600" />
                  <span>Kıyısı Olan Denizler</span>
                </div>
                <p className="text-sm font-semibold text-foreground pt-0.5">
                  {region.coastalSeas.length > 0
                    ? region.coastalSeas.join(", ")
                    : "Kıyısı bulunmamaktadır (İç Bölge)"}
                </p>
                <p className="text-xs text-muted-foreground">Kıyı şeridi ve havzalar</p>
              </div>

              {/* Komşu Bölgeler */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Compass className="size-4 text-teal-600" />
                  <span>Komşu Bölgeler</span>
                </div>
                <p className="text-sm font-semibold text-foreground pt-0.5">
                  {region.neighborRegions.length > 0 ? region.neighborRegions.join(", ") : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Kara sınırları</p>
              </div>

              {/* Komşu Ülkeler */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <MapPin className="size-4 text-rose-600" />
                  <span>Komşu Ülkeler</span>
                </div>
                <p className="text-sm font-semibold text-foreground pt-0.5">
                  {region.neighborCountries?.length
                    ? region.neighborCountries.join(", ")
                    : "Uluslararası kara sınırı yoktur"}
                </p>
                <p className="text-xs text-muted-foreground">Sınır kapıları ve hatlar</p>
              </div>

              {/* 1941 Coğrafi Bölümleri */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5 md:col-span-2 lg:col-span-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Boxes className="size-4 text-primary" />
                  <span>1941 Coğrafya Kongresi Bölümleri ({region.subregionCount} Bölüm)</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {region.subregions.map((sub, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-card text-foreground border-border text-xs px-2.5 py-1"
                    >
                      {sub}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* İBBS / Metodoloji Şerhleri */}
            {region.footnotes?.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Info className="size-4" /> Künye Şerhleri &amp; İBBS Metodoloji Notu:
                </span>
                <div className="space-y-1.5 pl-4 border-l-2 border-amber-500/40">
                  {region.footnotes.map((fn, idx) => (
                    <p
                      key={idx}
                      className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed"
                    >
                      {fn}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4: KONUM VE SINIRLAR */}
        <section id="konum" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" size="sm">
                Coğrafi Konum
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Compass className={`size-6 ${theme.accentColor}`} />
              Konum ve Sınırlar
            </h2>
            <V2RichProse text={region.locationAndBordersTr} />
          </div>
        </section>

        {/* SECTION 5: YERYÜZÜ ŞEKİLLERİ */}
        <section id="yeryuzu" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                Fiziki Coğrafya
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Mountain className={`size-6 ${theme.accentColor}`} />
              Yeryüzü Şekilleri ve Jeomorfoloji
            </h2>
            <V2RichProse text={region.landformsTr} />
          </div>
        </section>

        {/* SECTION 6: İKLİM VE BİTKİ ÖRTÜSÜ */}
        <section id="iklim" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" size="sm">
                İklim &amp; Vejetasyon
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <CloudSun className={`size-6 ${theme.accentColor}`} />
              İklim Tipleri ve Doğal Bitki Örtüsü
            </h2>
            <V2RichProse text={region.climateAndVegetationTr} />
          </div>
        </section>

        {/* SECTION 7: HİDROGRAFYA */}
        <section id="hidrografya" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                size="sm"
                className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
              >
                Hidrografya
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Waves className={`size-6 ${theme.accentColor}`} />
              Hidrografya: Akarsular, Göller ve Su Varlığı
            </h2>
            <V2RichProse text={region.hydrographyTr} />
          </div>
        </section>

        {/* SECTION 8: YERLEŞME VE NÜFUS */}
        <section id="yerlesme" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                Demografi
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className={`size-6 ${theme.accentColor}`} />
              Yerleşme Dokusu ve Nüfus Dağılımı
            </h2>
            <V2RichProse text={region.settlementAndPopulationTr} />
          </div>
        </section>

        {/* SECTION 9: EKONOMİ */}
        <section id="ekonomi" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" size="sm">
                Ekonomik Coğrafya
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className={`size-6 ${theme.accentColor}`} />
              Ekonomik Yapı, Sanayi ve Tarımsal Üretim
            </h2>
            <V2RichProse text={region.economyTr} />
          </div>
        </section>

        {/* SECTION 10: COĞRAFİ BÖLÜMLER */}
        <section id="bolumler" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" size="sm">
                1941 Coğrafya Kongresi
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Boxes className={`size-6 ${theme.accentColor}`} />
              Coğrafi Bölümleri ve Morfolojik Sınırlar
            </h2>
            <V2RichProse text={region.subregionsTr} />
          </div>
        </section>

        {/* SECTION 11: BÖLGEDEKİ İLLER */}
        <section id="iller" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <Badge variant="primary" size="sm" className="mb-2">
                  İdari Yapı
                </Badge>
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  {region.nameTr} İlleri ({region.provinces.length} İl)
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">TÜİK ADNKS 2025 Verileriyle</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Plaka
                    </th>
                    <th scope="col" className="px-4 py-3">
                      İl Adı
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Nüfus (2025)
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Yüzölçümü
                    </th>
                    <th scope="col" className="px-4 py-3">
                      İklim Sınıfı
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Detay
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {region.provinces.map((prov: RegionProvinceItem) => (
                    <tr key={prov.plateCode} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3 font-mono font-bold text-xs text-primary">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {prov.plateCode}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <Link
                          href={{ pathname: "/v2/turkiye/[slug]", params: { slug: prov.slugTr } }}
                          className="hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span>{prov.nameTr}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                        {prov.population ? format.number(prov.population) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                        {prov.areaKm2 ? `${format.number(prov.areaKm2)} km²` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {prov.climateNameTr ?? "—"}
                          {prov.climateKoppen && (
                            <span className="font-mono text-[10px] text-primary/80 bg-primary/10 px-1 py-0.5 rounded">
                              {prov.climateKoppen}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={{ pathname: "/v2/turkiye/[slug]", params: { slug: prov.slugTr } }}
                          className="text-xs text-muted-foreground group-hover:text-primary transition-colors inline-flex items-center gap-0.5"
                        >
                          İncele <ArrowUpRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 12: DEPREM VE AFET RİSKİ */}
        <section id="afet" className="scroll-mt-28">
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/10 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                size="sm"
                className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
              >
                Doğal Afet &amp; Depremsellik
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="size-6 text-rose-600" />
              Deprem Kuşakları ve Bölgesel Afet Riski
            </h2>
            <V2RichProse text={region.disasterAndEarthquakeTr} />
          </div>
        </section>

        {/* SECTION 13: 7 BÖLGE KARŞILAŞTIRMASI */}
        <section id="kiyaslama" className="scroll-mt-28">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <Badge variant="primary" size="sm" className="mb-2">
                  Atlas Kıyaslaması
                </Badge>
                <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
                  <Table className="size-6 text-primary" />
                  Türkiye&apos;nin Yedi Coğrafi Bölgesi Karşılaştırması
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">31 Aralık 2025 ADNKS Tabanı</span>
            </div>

            {comparisonIntroText && <V2RichProse text={comparisonIntroText} />}

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Bölge
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      İl
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Nüfus (2025)
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Nüfus Payı
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Yüzölçümü (km²)
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Yoğunluk
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {region.comparisonTable.map((item) => {
                    const isCurrent = item.slug === region.slug;
                    return (
                      <tr
                        key={item.slug}
                        className={
                          isCurrent
                            ? "bg-primary/10 font-semibold text-foreground border-l-4 border-l-primary"
                            : "hover:bg-muted/30 transition-colors text-muted-foreground"
                        }
                      >
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {isCurrent ? (
                            <span className="flex items-center gap-1.5">
                              <span>{item.nameTr}</span>
                              <Badge variant="primary" className="text-[10px] py-0 px-1.5 h-4">
                                Aktif Bölge
                              </Badge>
                            </span>
                          ) : (
                            <Link
                              href={{
                                pathname: "/v2/turkiye/bolge/[slug]",
                                params: { slug: item.slug },
                              }}
                              className="text-primary hover:underline transition-colors inline-flex items-center gap-1"
                            >
                              {item.nameTr}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {item.provinceCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {format.number(item.population)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          %{item.populationSharePercent.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {format.number(item.areaKm2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {item.populationDensity} kişi/km²
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground/80 italic">
              * Nüfus verileri TÜİK ADNKS 31 Aralık 2025; yüzölçümü Harita Genel Müdürlüğü (HGM) il
              toplamlarıdır. Paylar 86.092.168 kişilik ülke nüfusu ve 780.040 km²&apos;lik 81 il
              yüzölçümü tabanından hesaplanmıştır.
            </p>
          </div>
        </section>

        {/* SECTION 14: SIKÇA SORULAN SORULAR */}
        {region.faqs?.length > 0 && (
          <section id="sss" className="scroll-mt-28">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" size="sm">
                  Rehber &amp; Soru-Cevap
                </Badge>
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="size-6 text-primary" />
                {region.nameTr} Hakkında Sıkça Sorulan Sorular
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {region.faqs.map((faq, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-muted/30 border border-border/80 space-y-2"
                  >
                    <h3 className="font-heading font-bold text-sm text-foreground flex items-start gap-2">
                      <span className="text-primary font-bold text-sm">S:</span>
                      <span>{faq.question}</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-5">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 15: BİLİMSEL KAYNAKÇA */}
        <section id="kaynakca" className="scroll-mt-28 space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" size="sm">
                Metodoloji &amp; Kaynakça
              </Badge>
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground">
              Bölgesel Veri Metodolojisi ve Atıflar
            </h2>
            <V2RichProse text={region.sourcesNoteTr} />
          </div>

          <V2SourcesSection scope="turkiye" />
        </section>
      </main>

      <V2Footer />
    </div>
  );
}
