import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Badge } from "@/components/ui/badge";
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

function renderProse(text: string) {
  if (!text) return null;
  return text.split("\n\n").map((para, i) => (
    <p key={i} className="text-muted-foreground leading-relaxed text-sm sm:text-base">
      {para}
    </p>
  ));
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

  const breadcrumbs = [
    { name: "Anasayfa", path: "/v2" },
    { name: "Türkiye Coğrafyası", path: "/v2/turkiye" },
    { name: region.nameTr, path: `/v2/turkiye/bolge/${region.slug}` },
  ];

  const quickNav = [
    { id: "kunye", label: "Temel Bilgiler" },
    { id: "konum", label: "Konum & Sınırlar" },
    { id: "yeryuzu", label: "Yeryüzü Şekilleri" },
    { id: "iklim", label: "İklim & Bitki" },
    { id: "hidrografya", label: "Hidrografya" },
    { id: "nufus", label: "Nüfus & Yerleşme" },
    { id: "ekonomi", label: "Ekonomik Ağırlık" },
    { id: "bolumler", label: "Bölümler" },
    { id: "iller", label: "Bölgedeki İller" },
    { id: "afet", label: "Deprem & Afet Riski" },
    { id: "karsilastirma", label: "7 Bölge Karşılaştırma" },
    { id: "sss", label: "SSS" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <JsonLd schema={breadcrumbJsonLd(breadcrumbs)} />
      {region.faqs?.length > 0 && <JsonLd schema={faqPageJsonLd(region.faqs)} />}

      <V2Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section
          className={`relative border-b border-border bg-gradient-to-b ${theme.gradient} pt-8 pb-12 px-4 sm:px-6 lg:px-8`}
        >
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap"
            >
              <Link
                href={"/v2" as unknown as React.ComponentProps<typeof Link>["href"]}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Home className="size-3.5" />
                <span>Anasayfa</span>
              </Link>
              <ChevronRight className="size-3" />
              <Link
                href={"/v2/turkiye" as unknown as React.ComponentProps<typeof Link>["href"]}
                className="hover:text-foreground transition-colors"
              >
                Türkiye Coğrafyası
              </Link>
              <ChevronRight className="size-3" />
              <span className="text-foreground font-semibold">{region.nameTr}</span>
            </nav>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge
                  variant="outline"
                  className={`${theme.badgeClass} px-3 py-1 font-semibold text-xs tracking-wide`}
                >
                  <Mountain className="size-3.5 mr-1" /> Coğrafi Bölge
                </Badge>
                <Badge variant="outline" className="bg-background/80 backdrop-blur-xs text-xs">
                  {region.provinceCount} İl · {region.subregionCount} Bölüm
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
                {region.h1}
              </h1>

              <div className="max-w-4xl text-base sm:text-lg text-muted-foreground leading-relaxed border-l-2 pl-4 border-primary/40">
                {region.introTr}
              </div>
            </div>

            {/* Quick-Jump Section Navigator */}
            <div className="pt-4 border-t border-border/60">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Bölüm İndeksi:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin text-xs">
                {quickNav.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="px-2.5 py-1 rounded-full bg-muted/60 hover:bg-primary/20 hover:text-primary transition-colors whitespace-nowrap border border-border/80 text-[11px] font-medium"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
          {/* Section 3: Temel Bilgiler (Künye) */}
          <section id="kunye" className="space-y-4 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Info className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                Temel Bilgiler (Bölge Künyesi)
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Building2 className="size-3.5" /> İl Sayısı
                </span>
                <span className="font-heading font-bold text-lg text-foreground block mt-1">
                  {region.provinceCount} İl
                </span>
                <span className="text-[10px] text-muted-foreground">81 il bünyesinde</span>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <MapPin className="size-3.5" /> İlçe Sayısı
                </span>
                <span className="font-heading font-bold text-lg text-foreground block mt-1">
                  {region.districtCount} İlçe
                </span>
                <span className="text-[10px] text-muted-foreground">
                  İçişleri Bakanlığı toplamı
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Users className="size-3.5" /> Nüfus (ADNKS 2025)
                </span>
                <span className="font-heading font-bold text-lg text-foreground block mt-1">
                  {format.number(region.population)}
                </span>
                <span className="text-[10px] text-muted-foreground">İl toplamları</span>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Maximize2 className="size-3.5" /> Yüzölçümü
                </span>
                <span className="font-heading font-bold text-lg text-foreground block mt-1">
                  {format.number(region.areaKm2)} km²
                </span>
                <span className="text-[10px] text-muted-foreground">HGM il toplamları</span>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Users className="size-3.5" /> Nüfus Yoğunluğu
                </span>
                <span className="font-heading font-bold text-lg text-foreground block mt-1">
                  {region.populationDensity} kişi/km²
                </span>
                <span className="text-[10px] text-muted-foreground">TR ort: 110 kişi/km²</span>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <TrendingUp className="size-3.5" /> GSYH Payı (2024)
                </span>
                <span className="font-heading font-bold text-lg text-foreground block mt-1">
                  {region.gdpShareApproxPercent !== null
                    ? `yaklaşık %${region.gdpShareApproxPercent}`
                    : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">TÜİK İl Bazında GSYH</span>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs col-span-2 sm:col-span-1">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Mountain className="size-3.5" /> En Yüksek Noktası
                </span>
                <span className="font-heading font-bold text-sm sm:text-base text-foreground block mt-1">
                  {region.highestPointName ?? "—"}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {region.highestPointElevationM
                    ? `${format.number(region.highestPointElevationM)} m`
                    : ""}
                  {region.highestPointProvince ? ` (${region.highestPointProvince})` : ""}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs col-span-2 sm:col-span-1">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Boxes className="size-3.5" /> Coğrafi Bölüm
                </span>
                <span className="font-heading font-bold text-lg text-foreground block mt-1">
                  {region.subregionCount} Bölüm
                </span>
                <span className="text-[10px] text-muted-foreground">1941 Coğrafya Kongresi</span>
              </div>
            </div>

            {/* Additional coastal, neighbor and border metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground font-semibold block mb-1 flex items-center gap-1">
                  <Waves className="size-3.5 text-blue-500" /> Kıyısı Olan Denizler:
                </span>
                <span className="font-medium text-foreground">
                  {region.coastalSeas.length > 0
                    ? region.coastalSeas.join(", ")
                    : "Kıyısı bulunmamaktadır (İç Bölge)"}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground font-semibold block mb-1 flex items-center gap-1">
                  <Compass className="size-3.5 text-amber-500" /> Komşu Bölgeler:
                </span>
                <span className="font-medium text-foreground">
                  {region.neighborRegions.length > 0 ? region.neighborRegions.join(", ") : "—"}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground font-semibold block mb-1 flex items-center gap-1">
                  <MapPin className="size-3.5 text-emerald-500" /> Komşu Ülkeler:
                </span>
                <span className="font-medium text-foreground">
                  {region.neighborCountries?.length
                    ? region.neighborCountries.join(", ")
                    : "Kara sınırı bulunmamaktadır"}
                </span>
              </div>
            </div>

            {/* Footnotes / İBBS Şerhleri */}
            {region.footnotes?.length > 0 && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Info className="size-3.5" /> Künye Şerhleri &amp; İBBS Notu:
                </span>
                {region.footnotes.map((fn, idx) => (
                  <p
                    key={idx}
                    className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed pl-4 border-l border-amber-500/40"
                  >
                    {fn}
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* Section 4: Konum ve Sınırlar */}
          <section id="konum" className="space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Compass className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">Konum ve Sınırlar</h2>
            </div>
            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.locationAndBordersTr)}
            </div>
          </section>

          {/* Section 5: Yeryüzü Şekilleri */}
          <section id="yeryuzu" className="space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Mountain className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                Yeryüzü Şekilleri ve Jeomorfoloji
              </h2>
            </div>
            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.landformsTr)}
            </div>
          </section>

          {/* Section 6: İklim ve Bitki Örtüsü */}
          <section id="iklim" className="space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <CloudSun className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                İklim Tipleri ve Doğal Bitki Örtüsü
              </h2>
            </div>
            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.climateAndVegetationTr)}
            </div>
          </section>

          {/* Section 7: Hidrografya */}
          <section id="hidrografya" className="space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Waves className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                Hidrografya: Akarsular, Göller ve Yeraltı Suları
              </h2>
            </div>
            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.hydrographyTr)}
            </div>
          </section>

          {/* Section 8: Nüfus ve Yerleşme */}
          <section id="nufus" className="space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Users className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                Nüfus, Göç ve Yerleşme Düzeni
              </h2>
            </div>
            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.settlementAndPopulationTr)}
            </div>
          </section>

          {/* Section 9: Ekonomik Ağırlık */}
          <section id="ekonomi" className="space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <TrendingUp className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                Ekonomik Ağırlık: Sanayi, Tarım ve Hizmetler
              </h2>
            </div>
            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.economyTr)}
            </div>
          </section>

          {/* Section 10: Coğrafi Bölümler */}
          <section id="bolumler" className="space-y-4 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Boxes className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                Coğrafi Bölümler (1941 Kongresi)
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {region.subregions.map((sub, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="px-3 py-1 bg-muted/80 border-border text-xs font-semibold"
                >
                  <Layers className="size-3.5 mr-1.5 text-primary" />
                  {sub}
                </Badge>
              ))}
            </div>

            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.subregionsTr)}
            </div>
          </section>

          {/* Section 11: Bölgedeki İller */}
          <section id="iller" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between border-b border-border pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 className={`size-5 ${theme.accentColor}`} />
                <h2 className="font-heading text-xl sm:text-2xl font-bold">
                  Bölgedeki İller ({region.provinceCount} İl)
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                Nüfusa göre azalan sırada listelenmiştir
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border font-medium text-[11px] sm:text-xs">
                  <tr>
                    <th className="py-3 px-3.5">Plaka</th>
                    <th className="py-3 px-3.5">İl</th>
                    <th className="py-3 px-3.5 text-right">Nüfus (2025)</th>
                    <th className="py-3 px-3.5 text-right">Yüzölçümü</th>
                    <th className="py-3 px-3.5 text-left hidden sm:table-cell">İklim Tipi</th>
                    <th className="py-3 px-3.5 text-right">İncele</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {region.provinces.map((prov: RegionProvinceItem) => (
                    <tr key={prov.plateCode} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-semibold text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted border border-border">
                          {prov.plateCode}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-foreground">
                        <Link
                          href={
                            `/v2/turkiye/${prov.slugTr}` as unknown as React.ComponentProps<
                              typeof Link
                            >["href"]
                          }
                          className="hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          {prov.nameTr}
                        </Link>
                      </td>
                      <td className="py-3 px-3.5 text-right font-medium">
                        {prov.population ? format.number(prov.population) : "—"}
                      </td>
                      <td className="py-3 px-3.5 text-right text-muted-foreground font-mono">
                        {prov.areaKm2 ? `${format.number(prov.areaKm2)} km²` : "—"}
                      </td>
                      <td className="py-3 px-3.5 text-left text-muted-foreground hidden sm:table-cell">
                        {prov.climateNameTr ?? "—"}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <Link
                          href={
                            `/v2/turkiye/${prov.slugTr}` as unknown as React.ComponentProps<
                              typeof Link
                            >["href"]
                          }
                          className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 font-semibold"
                        >
                          Detay <ArrowUpRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 12: Deprem ve Afet Riski */}
          <section id="afet" className="space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <ShieldAlert className={`size-5 ${theme.accentColor}`} />
              <h2 className="font-heading text-xl sm:text-2xl font-bold">
                Deprem ve Doğal Afet Riski
              </h2>
            </div>
            <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-xs">
              {renderProse(region.disasterAndEarthquakeTr)}
            </div>
          </section>

          {/* Section 13: 7 Bölge Karşılaştırma */}
          {region.comparisonTable?.length > 0 && (
            <section id="karsilastirma" className="space-y-4 scroll-mt-20">
              <div className="flex items-center justify-between border-b border-border pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Table className={`size-5 ${theme.accentColor}`} />
                  <h2 className="font-heading text-xl sm:text-2xl font-bold">
                    Türkiye&apos;nin 7 Coğrafi Bölgesi Karşılaştırması
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">Aktif bölge vurgulanmıştır</span>
              </div>

              {region.comparisonTr && (
                <div className="bg-card p-4 rounded-xl border border-border text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {renderProse(region.comparisonTr)}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border font-medium text-[11px] sm:text-xs">
                    <tr>
                      <th className="py-3 px-3.5">Bölge</th>
                      <th className="py-3 px-3.5 text-right">İl Sayısı</th>
                      <th className="py-3 px-3.5 text-right">Nüfus (2025)</th>
                      <th className="py-3 px-3.5 text-right">Nüfus Payı</th>
                      <th className="py-3 px-3.5 text-right">Yüzölçümü</th>
                      <th className="py-3 px-3.5 text-right hidden sm:table-cell">Yoğunluk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {region.comparisonTable.map((row) => {
                      const isActive = row.slug === region.slug;
                      return (
                        <tr
                          key={row.slug}
                          className={`transition-colors ${
                            isActive
                              ? "bg-primary/10 font-semibold text-primary dark:text-primary"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <td className="py-3 px-3.5">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-primary" />
                                {row.nameTr}
                              </span>
                            ) : (
                              <Link
                                href={
                                  `/v2/turkiye/bolge/${row.slug}` as unknown as React.ComponentProps<
                                    typeof Link
                                  >["href"]
                                }
                                className="hover:text-primary transition-colors inline-flex items-center gap-1 text-foreground"
                              >
                                {row.nameTr}
                              </Link>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right">{row.provinceCount}</td>
                          <td className="py-3 px-3.5 text-right">
                            {format.number(row.population)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono">
                            %{row.populationSharePercent.toFixed(1)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono">
                            {format.number(row.areaKm2)} km²
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono hidden sm:table-cell">
                            {row.populationDensity} k/km²
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section 14: SSS */}
          {region.faqs?.length > 0 && (
            <section id="sss" className="space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <HelpCircle className={`size-5 ${theme.accentColor}`} />
                <h2 className="font-heading text-xl sm:text-2xl font-bold">
                  Sıkça Sorulan Sorular
                </h2>
              </div>
              <div className="space-y-3">
                {region.faqs.map((faq, idx) => (
                  <details
                    key={idx}
                    className="group bg-card rounded-xl border border-border p-4 [&_summary::-webkit-details-marker]:hidden transition-all duration-200"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-semibold text-foreground text-sm sm:text-base">
                      <span>{faq.question}</span>
                      <span className="shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                        <ChevronRight className="size-4" />
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed pt-3 border-t border-border/60">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Section 15: Kaynakça Notu */}
          {region.sourcesNoteTr && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold block text-foreground mb-1">Kaynak Notu:</span>
              <p>{region.sourcesNoteTr}</p>
            </div>
          )}

          {/* Scientific Sources Section */}
          <V2SourcesSection scope="turkiye" />
        </div>
      </main>

      <V2Footer />
    </div>
  );
}
