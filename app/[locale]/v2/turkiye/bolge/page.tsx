import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2TurkeyRegions } from "@/components/v2/v2-turkey-regions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getRegionsResilient } from "@/lib/api/regions";
import { breadcrumbJsonLd, faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { tr } from "@/lib/text/format-number";
import {
  Mountain,
  Compass,
  Users,
  Maximize2,
  Waves,
  Home,
  ChevronRight,
  Boxes,
  Building2,
  Table,
  HelpCircle,
  Landmark,
  Scale,
  ArrowRight,
  ShieldAlert,
  Layers,
  Sparkles,
} from "lucide-react";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => ({
      pathname: "/v2/turkiye/bolge",
    }),
    title:
      locale === "tr"
        ? "Türkiye'nin 7 Coğrafi Bölgesi: İlleri, İklimi ve Haritası | Coğrafya Gurmesi"
        : "Türkiye's 7 Geographic Regions: Provinces, Climate and Map",
    description:
      locale === "tr"
        ? "1941 Birinci Türk Coğrafya Kongresi kararlarıyla belirlenen Türkiye'nin 7 coğrafi bölgesi ve 21 bölümü. Nüfus dağılımı, yüzölçümü, iklim özellikleri ve analitik karşılaştırma rehberi."
        : "Türkiye's 7 geographic regions and 21 subregions. Population distribution, area, climate features and an analytical comparison guide.",
  });
}

// Canonical static data fallback in case api is offline during build
const REGIONS_STATIC_FALLBACK = [
  {
    slug: "marmara",
    nameTr: "Marmara Bölgesi",
    headingName: "Marmara",
    provinceCount: 11,
    districtCount: 158,
    population: 26711525,
    populationSharePercent: 31.03,
    areaKm2: 72666,
    areaSharePercent: 9.32,
    populationDensity: 368,
    highestPeakNameTr: "Uludağ",
    highestPeakElevationM: 2543,
    subregionCount: 4,
    climateTr: "Geçiş İklimi (Akdeniz - Karadeniz - Karasal)",
    isCoastal: true,
  },
  {
    slug: "ege",
    nameTr: "Ege Bölgesi",
    headingName: "Ege",
    provinceCount: 8,
    districtCount: 132,
    population: 11011261,
    populationSharePercent: 12.79,
    areaKm2: 89339,
    areaSharePercent: 11.45,
    populationDensity: 123,
    highestPeakNameTr: "Honaz Dağı",
    highestPeakElevationM: 2571,
    subregionCount: 2,
    climateTr: "Akdeniz İklimi (İç kesimlerde Karasal)",
    isCoastal: true,
  },
  {
    slug: "akdeniz",
    nameTr: "Akdeniz Bölgesi",
    headingName: "Akdeniz",
    provinceCount: 8,
    districtCount: 104,
    population: 11028175,
    populationSharePercent: 12.81,
    areaKm2: 89516,
    areaSharePercent: 11.48,
    populationDensity: 123,
    highestPeakNameTr: "Medetsiz Tepesi",
    highestPeakElevationM: 3524,
    subregionCount: 2,
    climateTr: "Tipik Akdeniz İklimi",
    isCoastal: true,
  },
  {
    slug: "ic-anadolu",
    nameTr: "İç Anadolu Bölgesi",
    headingName: "İç Anadolu",
    provinceCount: 13,
    districtCount: 172,
    population: 13809574,
    populationSharePercent: 16.04,
    areaKm2: 187227,
    areaSharePercent: 24.0,
    populationDensity: 74,
    highestPeakNameTr: "Erciyes Dağı",
    highestPeakElevationM: 3917,
    subregionCount: 4,
    climateTr: "Ilıman Karasal (Step İklimi)",
    isCoastal: false,
  },
  {
    slug: "karadeniz",
    nameTr: "Karadeniz Bölgesi",
    headingName: "Karadeniz",
    provinceCount: 18,
    districtCount: 193,
    population: 8041038,
    populationSharePercent: 9.34,
    areaKm2: 116379,
    areaSharePercent: 14.92,
    populationDensity: 69,
    highestPeakNameTr: "Kaçkar Dağı",
    highestPeakElevationM: 3937,
    subregionCount: 3,
    climateTr: "Okyanusal Karadeniz İklimi",
    isCoastal: true,
  },
  {
    slug: "dogu-anadolu",
    nameTr: "Doğu Anadolu Bölgesi",
    headingName: "Doğu Anadolu",
    provinceCount: 14,
    districtCount: 125,
    population: 5902603,
    populationSharePercent: 6.86,
    areaKm2: 148966,
    areaSharePercent: 19.1,
    populationDensity: 40,
    highestPeakNameTr: "Ağrı Dağı (Büyük Ağrı)",
    highestPeakElevationM: 5137,
    subregionCount: 4,
    climateTr: "Sert Karasal (Yüksek Yayla İklimi)",
    isCoastal: false,
  },
  {
    slug: "guneydogu-anadolu",
    nameTr: "Güneydoğu Anadolu Bölgesi",
    headingName: "Güneydoğu Anadolu",
    provinceCount: 9,
    districtCount: 89,
    population: 9587992,
    populationSharePercent: 11.14,
    areaKm2: 75947,
    areaSharePercent: 9.74,
    populationDensity: 126,
    highestPeakNameTr: "Yazlıca (Herekul) Dağı",
    highestPeakElevationM: 2838,
    subregionCount: 2,
    climateTr: "Karasal - Akdeniz Bozulmuş İklimi",
    isCoastal: false,
  },
];

/** The subset of a `regionsList` entry `buildBolgelerFaqs` needs — accepts either branch of
 * the ternary below, since both carry every one of these fields. */
type RegionsListEntry = {
  nameTr: string;
  areaKm2: number;
  areaSharePercent: number;
  population: number;
  populationSharePercent: number;
  populationDensity: number;
};

/**
 * The FAQ list, with the 4th answer DERIVED from the real `regionsList` rather than
 * hand-typed — `regionsList` is computed inside the page component (after `apiRegions` is
 * fetched), so this cannot be a module-level const the way the other five entries are.
 * `noUncheckedIndexedAccess` makes the sorted-array destructure `T | undefined`; when either
 * is undefined the derived FAQ is simply omitted rather than rendered with a placeholder.
 */
function buildBolgelerFaqs(regions: RegionsListEntry[]): { question: string; answer: string }[] {
  const [largestByArea] = [...regions].sort((a, b) => b.areaKm2 - a.areaKm2);
  const [mostPopulous] = [...regions].sort((a, b) => b.population - a.population);

  const largestAreaFaq =
    largestByArea && mostPopulous
      ? {
          question: "Yüzölçümü ve nüfus bakımından en büyük bölgeler hangileridir?",
          answer:
            `Yüzölçümü bakımından Türkiye'nin en büyük coğrafi bölgesi ${tr(largestByArea.areaKm2)} km² ` +
            `(%${tr(largestByArea.areaSharePercent, 2)} pay) ile ${largestByArea.nameTr}'dir. ` +
            `Nüfus büyüklüğü ve nüfus yoğunluğu bakımından ise ${tr(mostPopulous.population)} kişilik ` +
            `nüfusu (%${tr(mostPopulous.populationSharePercent, 2)} pay) ve km² başına ` +
            `${tr(mostPopulous.populationDensity)} kişilik yoğunluğuyla ${mostPopulous.nameTr} birinci sıradadır.`,
        }
      : null;

  return [
    {
      question: "Türkiye kaç coğrafi bölgeye ayrılmıştır ve bu ayrım ne zaman yapılmıştır?",
      answer:
        "Türkiye, 6-21 Haziran 1941 tarihleri arasında Ankara Üniversitesi Dil ve Tarih-Coğrafya Fakültesi'nde toplanan Birinci Türk Coğrafya Kongresi kararıyla 7 ana coğrafi bölgeye ve 21 coğrafi bölüme ayrılmıştır.",
    },
    {
      question: "Bölgeler belirlenirken hangi bilimsel kriterler esas alınmıştır?",
      answer:
        "Bölge sınırlarının tespitinde üç ana unsur gözetilmiştir: 1) Doğal etkenler (yer şekilleri, jeomorfolojik uzanış, dağ sıraları, yükselti ve kıyı tipleri), 2) Klimatolojik etkenler (sıcaklık, yağış rejimi ve vejetasyon örtüsü), 3) Beşeri ve ekonomik etkenler (nüfus dağılımı, tarım desenleri, sanayi ve ulaşım ağları).",
    },
    {
      question: "TÜİK İBBS bölgeleri ile klasik 7 coğrafi bölge arasındaki fark nedir?",
      answer:
        "7 Coğrafi Bölge, Türkiye'nin doğal ve fiziki yapısını yansıtan temel morfolojik sınıflamadır. TÜİK'in kullandığı İBBS (İstatistiki Bölge Birimleri Sınıflandırması) Düzey-1 ise Avrupa Birliği istatistik normlarına uyum sağlamak için idari sınırlarla belirlenmiş 12 sosyo-ekonomik bölgeden oluşur. Klasik coğrafi bölgeler idari sınırlara değil doğal sınırlara dayanır.",
    },
    ...(largestAreaFaq ? [largestAreaFaq] : []),
    {
      question: "Bir ilin toprakları birden fazla coğrafi bölgede bulunabilir mi?",
      answer:
        "Evet. Coğrafi bölgeler idari il sınırlarıyla değil doğal hatlarla çizildiği için birçok ilimiz birden çok bölgeye yayılır. Örneğin Bilecik (Marmara, Ege, Karadeniz ve İç Anadolu), Balıkesir ve Çanakkale (Marmara ve Ege), Bursa (Marmara ve Karadeniz), Kahramanmaraş (Akdeniz, Doğu Anadolu ve Güneydoğu) bu durumun en bilinen örnekleridir.",
    },
    {
      question: "Türkiye'nin denize kıyısı olan ve olmayan bölgeleri hangileridir?",
      answer:
        "Türkiye'nin 7 coğrafi bölgesinden 4'ü kıyı bölgesidir (Karadeniz, Marmara, Ege ve Akdeniz). Kalan 3 bölge ise iç kara bölgesidir (İç Anadolu, Doğu Anadolu ve Güneydoğu Anadolu).",
    },
  ];
}

export default async function V2TurkiyeBolgelerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fetch real region figures from API
  const apiRegions = await getRegionsResilient();
  const regionsList =
    apiRegions.length === 7
      ? apiRegions.map((r) => {
          const fallback = REGIONS_STATIC_FALLBACK.find((f) => f.slug === r.slug);
          return {
            slug: r.slug,
            nameTr: r.nameTr,
            headingName: r.headingName,
            provinceCount: r.provinceCount,
            districtCount: r.districtCount,
            population: r.population,
            populationSharePercent: r.populationSharePercent,
            areaKm2: r.areaKm2,
            areaSharePercent: r.areaSharePercent,
            populationDensity: r.populationDensity,
            highestPeakNameTr: fallback?.highestPeakNameTr ?? "Bilinmiyor",
            highestPeakElevationM: fallback?.highestPeakElevationM ?? 0,
            subregionCount: fallback?.subregionCount ?? 2,
            climateTr: fallback?.climateTr ?? "Karasal / Akdeniz / Karadeniz",
            isCoastal: fallback?.isCoastal ?? null,
          };
        })
      : REGIONS_STATIC_FALLBACK;

  const totalProvincesCount = regionsList.reduce((acc, r) => acc + r.provinceCount, 0) || 81;
  const totalPop = regionsList.reduce((acc, r) => acc + r.population, 0) || 86092168;
  const totalArea = regionsList.reduce((acc, r) => acc + r.areaKm2, 0) || 780040;
  const bolgelerFaqs = buildBolgelerFaqs(regionsList);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <JsonLd
        schema={breadcrumbJsonLd([
          { name: locale === "tr" ? "Ana Sayfa" : "Home", path: "/v2" },
          { name: locale === "tr" ? "Türkiye Atlası" : "Türkiye Atlas", path: "/v2/turkiye" },
          {
            name: locale === "tr" ? "Coğrafi Bölgeler" : "Geographic Regions",
            path: "/v2/turkiye/bolge",
          },
        ])}
      />
      {/* trOnly surface (`FENB75-I2`, → `lib/seo/indexing.ts`): the FAQ narrative has no
          English counterpart, so the EN twin carries BreadcrumbList JSON-LD only rather than
          a translated FAQPage block. */}
      {locale === "tr" && (
        <JsonLd
          schema={faqPageJsonLd(
            bolgelerFaqs.map((faq) => ({
              question: faq.question,
              answer: faq.answer,
            })),
          )}
        />
      )}

      <V2Header />
      <V2LiveTicker />

      {/* HERO SECTION */}
      <header className="border-b border-border bg-gradient-to-b from-muted/30 via-background to-background py-10 sm:py-14">
        <div className="container mx-auto px-4 max-w-7xl space-y-6">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap"
          >
            <Link
              href="/v2"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>{locale === "tr" ? "Ana Sayfa" : "Home"}</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <Link
              href="/v2/turkiye"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Compass className="size-3.5" />
              <span>{locale === "tr" ? "Türkiye Atlası" : "Türkiye Atlas"}</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold">
              {locale === "tr" ? "7 Coğrafi Bölge" : "7 Geographic Regions"}
            </span>
          </nav>

          {/* Hero Content Card */}
          <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-10 shadow-lg space-y-6">
            <div className="space-y-4 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                {/* The 1941-Congress and TÜİK-vintage badges are source/provenance-flavoured
                    claims, not structural counts — gated rather than translated so no new
                    English prose is authored for them in this round (§9). */}
                {locale === "tr" && (
                  <Badge variant="primary" size="sm" icon={<Landmark className="size-3.5" />}>
                    1941 Coğrafya Kongresi Tasnifi
                  </Badge>
                )}
                <Badge variant="secondary" size="sm" icon={<Boxes className="size-3.5" />}>
                  {locale === "tr" ? "7 Coğrafi Bölge & 21 Bölüm" : "7 Regions & 21 Subregions"}
                </Badge>
                {locale === "tr" && (
                  <Badge variant="outline" size="sm" className="font-mono text-xs">
                    TÜİK ADNKS 2025 Tabanlı
                  </Badge>
                )}
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                {locale === "tr"
                  ? "Türkiye'nin 7 Coğrafi Bölgesi Rehberi"
                  : "Türkiye's 7 Geographic Regions Guide"}
              </h1>

              {/* Same provenance-flavoured claim as the 1941-Congress badge two elements above —
                  gated rather than translated for the same reason (tur2-plan.md §7, FEN135-NEW-M5). */}
              {locale === "tr" && (
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-3xl">
                  6–21 Haziran 1941 Birinci Türk Coğrafya Kongresi kararlarıyla çizilen doğal
                  sınırlar, morfotektonik kuşaklar ve iklim havzaları ışığında Türkiye&apos;nin 7
                  coğrafi bölgesi, 21 alt bölümü ve analitik karşılaştırma atlası.
                </p>
              )}
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Boxes className="size-3.5 text-primary" />{" "}
                  {locale === "tr" ? "Coğrafi Bölge" : "Geographic Region"}
                </span>
                <span className="font-heading text-2xl sm:text-3xl font-extrabold text-primary block">
                  {locale === "tr" ? "7 Bölge" : "7 Regions"}
                </span>
                {locale === "tr" ? (
                  <span className="text-[11px] text-muted-foreground/80 block">
                    4 Kıyı, 3 İç Kara Havzası
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/80 block">
                    4 Coastal, 3 Landlocked
                  </span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Layers className="size-3.5 text-secondary" />{" "}
                  {locale === "tr" ? "Coğrafi Bölüm" : "Subregion"}
                </span>
                <span className="font-heading text-2xl sm:text-3xl font-extrabold text-secondary block">
                  {locale === "tr" ? "21 Bölüm" : "21 Subregions"}
                </span>
                {locale === "tr" ? (
                  <span className="text-[11px] text-muted-foreground/80 block">
                    Morfolojik Alt Yöreler
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/80 block">
                    Morphological Sub-regions
                  </span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Users className="size-3.5 text-accent" />{" "}
                  {locale === "tr" ? "Toplam Nüfus" : "Total Population"}
                </span>
                <span className="font-heading text-2xl sm:text-3xl font-extrabold text-accent block">
                  {totalPop.toLocaleString("tr-TR")}
                </span>
                <span className="text-[11px] text-muted-foreground/80 block">
                  TÜİK 31 Aralık 2025
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Maximize2 className="size-3.5 text-[var(--color-primary-dark,#7e3a1e)]" />{" "}
                  {locale === "tr" ? "Yüzölçümü" : "Area"}
                </span>
                <span className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-primary-dark,#7e3a1e)] block">
                  {totalArea.toLocaleString("tr-TR")} km²
                </span>
                <span className="text-[11px] text-muted-foreground/80 block">
                  81 İl HGM Tescili
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* QUICKNAV BAR */}
      <nav
        aria-label="Sayfa içi hızlı gezinme"
        className="sticky top-16 z-30 w-full border-b border-border bg-background/90 backdrop-blur-md transition-all shadow-2xs"
      >
        <div className="container mx-auto px-4 max-w-7xl flex items-center gap-2 overflow-x-auto py-2.5 text-xs font-semibold scrollbar-none">
          <a
            href="#bolgeler"
            className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            7 Bölge Vitrini
          </a>
          <a
            href="#tarihce"
            className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            1941 Kongresi &amp; Tarihçe
          </a>
          <a
            href="#kiyaslama"
            className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Analitik Kıyaslama
          </a>
          {/* The FAQ section itself is TR-only (§9) — the quicknav target would be dead on
              the EN twin, so the link is gated with it rather than left pointing at nothing. */}
          {locale === "tr" && (
            <a
              href="#sss"
              className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
            >
              Sıkça Sorulan Sorular
            </a>
          )}
          <a
            href="#kaynakca"
            className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Metodoloji &amp; Kaynakça
          </a>
        </div>
      </nav>

      {/* MAIN BODY CONTENT */}
      <main className="container mx-auto px-4 max-w-7xl py-10 space-y-14">
        {/* SECTION 1: 7 BÖLGE VİTRİNİ */}
        <section id="bolgeler" className="scroll-mt-28" tabIndex={-1}>
          <V2TurkeyRegions regions={regionsList} />
        </section>

        {/* SECTION 2: 1941 COĞRAFYA KONGRESİ & TARİHÇE */}
        <section id="tarihce" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2 border-b border-border/70 pb-5">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  Tarihî &amp; Bilimsel Miras
                </Badge>
                <span className="text-xs text-muted-foreground">6–21 Haziran 1941, Ankara</span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Landmark className="size-6 text-primary shrink-0" />
                <span>Birinci Türk Coğrafya Kongresi ve Yasal Çerçeve</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Cumhuriyet döneminin coğrafi tasnif manifestosu: Türkiye topraklarının fiziki,
                iklimsel ve beşeri özelliklerine göre ilk kez bilimsel bir konsensüsle bölümlere
                ayrılışı.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm">
              <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <h3 className="font-heading font-bold text-foreground">
                    Fiziki &amp; Jeomorfolojik Kriterler
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dağların kıyıya paralel uzandığı Karadeniz ve Akdeniz kıyı kuşakları, dağların
                  kıyıya dik uzanıp graben vadileri açtığı Ege kıyıları ve yüksek engebeli Doğu
                  Anadolu platosu temel sınır hatlarını oluşturmuştur.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <h3 className="font-heading font-bold text-foreground">
                    Klimatolojik &amp; Su Havzaları
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dört bir yandaki denizlerin ılımanlaştırıcı etkisi, iç kesimlerin deniz etkisinden
                  yalıtılmış step iklimi ve Doğu Anadolu&apos;nun sert karasal yapısı vejetasyon
                  örtüsüyle birlikte sınıflandırılmıştır.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <h3 className="font-heading font-bold text-foreground">
                    Beşeri, Zirai &amp; İktisadi Çevre
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nüfus yoğunluğu, tarımsal ürün desenleri (zeytin, fındık, tahıl, çay), sanayi
                  odakları ve tarihî ticaret aksları 7 ana bölgenin kendi içindeki 21 alt bölüme
                  ayrılmasında belirleyici olmuştur.
                </p>
              </div>
            </div>

            {/* Callout: NUTS-1 vs Classic 7 Regions */}
            <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start gap-3 text-xs leading-relaxed">
              <Scale className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-foreground block">
                  Metodolojik Ayrım: TÜİK İBBS Düzey-1 ve Klasik Coğrafi Bölgeler
                </span>
                <p className="text-muted-foreground">
                  TÜİK, Avrupa Birliği İstatistiki Bölge Birimleri (NUTS) standartları gereğince
                  verilerini 12 Düzey-1 bölgesine göre yayınlar. O sınıflandırma idari sınırları
                  esas alırken; MEB müfredatı, fiziki coğrafya ve morfolojik havza araştırmalarında
                  1941 Kongresi&apos;nin 7 Coğrafi Bölge tasnifi geçerliliğini ve bilimsel temelini
                  korumaktadır.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: ANALİTİK KIYASLAMA TABLOSU */}
        <section id="kiyaslama" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2 border-b border-border/70 pb-5">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  Karşılaştırmalı Veri Matrisi
                </Badge>
                <span className="text-xs text-muted-foreground">TÜİK ADNKS 2025 &amp; HGM</span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Table className="size-6 text-primary shrink-0" />
                <span>Türkiye&apos;nin Yedi Coğrafi Bölgesi Karşılaştırması</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Nüfus büyüklüğü, alan payı, nüfus yoğunluğu, zirve yükseklikleri ve idari mülki
                bölünüş açısından yedi bölgenin analitik kıyaslama tablosu.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border font-heading font-semibold text-xs">
                  <tr>
                    <th className="p-3.5 sm:p-4">Bölge Adı</th>
                    <th className="p-3.5 sm:p-4 text-center">İl / Bölüm</th>
                    <th className="p-3.5 sm:p-4 text-right">Yüzölçümü (km²)</th>
                    <th className="p-3.5 sm:p-4 text-right">Alan Payı</th>
                    <th className="p-3.5 sm:p-4 text-right">Nüfus (2025)</th>
                    <th className="p-3.5 sm:p-4 text-right">Nüfus Payı</th>
                    <th className="p-3.5 sm:p-4 text-right">Yoğunluk</th>
                    <th className="p-3.5 sm:p-4">En Yüksek Zirve</th>
                    <th className="p-3.5 sm:p-4 text-center">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {regionsList.map((r, idx) => (
                    <tr key={r.slug} className="hover:bg-muted/30 transition-colors group">
                      <td className="p-3.5 sm:p-4 font-bold text-foreground flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground font-normal">
                          0{idx + 1}
                        </span>
                        <Link
                          href={{
                            pathname: "/v2/turkiye/bolge/[slug]",
                            params: { slug: r.slug },
                          }}
                          className="hover:text-primary transition-colors hover:underline"
                        >
                          {r.nameTr}
                        </Link>
                        {r.isCoastal === true ? (
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <span
                              title="Kıyı Bölgesi"
                              className="inline-flex size-2 rounded-full bg-teal-500 shrink-0"
                            />
                            <span className="text-[10px] text-muted-foreground">Kıyı</span>
                          </span>
                        ) : r.isCoastal === false ? (
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <span
                              title="İç Kara Bölgesi"
                              className="inline-flex size-2 rounded-full bg-amber-500 shrink-0"
                            />
                            <span className="text-[10px] text-muted-foreground">İç</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <span
                              title="Bilinmiyor"
                              className="inline-flex size-2 rounded-full bg-muted-foreground/40 shrink-0"
                            />
                            <span className="text-[10px] text-muted-foreground">Bilinmiyor</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 sm:p-4 text-center text-muted-foreground font-mono">
                        {r.provinceCount} İl / {r.subregionCount} Bölüm
                      </td>
                      <td className="p-3.5 sm:p-4 text-right font-mono">
                        {r.areaKm2.toLocaleString("tr-TR")}
                      </td>
                      <td className="p-3.5 sm:p-4 text-right font-mono font-semibold text-primary">
                        %{tr(r.areaSharePercent, 1)}
                      </td>
                      <td className="p-3.5 sm:p-4 text-right font-mono">
                        {r.population.toLocaleString("tr-TR")}
                      </td>
                      <td className="p-3.5 sm:p-4 text-right font-mono font-semibold text-secondary">
                        %{tr(r.populationSharePercent, 1)}
                      </td>
                      <td className="p-3.5 sm:p-4 text-right font-mono">
                        {r.populationDensity} kişi/km²
                      </td>
                      <td className="p-3.5 sm:p-4 text-muted-foreground text-xs">
                        <span className="font-semibold text-foreground block">
                          {r.highestPeakNameTr}
                        </span>
                        <span className="font-mono text-[10px]">
                          {r.highestPeakElevationM > 0 ? `${r.highestPeakElevationM} m` : "-"}
                        </span>
                      </td>
                      <td className="p-3.5 sm:p-4 text-center">
                        <Link
                          href={{
                            pathname: "/v2/turkiye/bolge/[slug]",
                            params: { slug: r.slug },
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          <span>İncele</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground/80 italic">
              * Nüfus verileri TÜİK ADNKS 31 Aralık 2025; yüzölçümü değerleri Harita Genel Müdürlüğü
              (HGM) resmi tescilleridir. Paylar Türkiye toplamı (86.092.168 nüfus ve 780.040 km² 81
              il yüzölçümü) üzerinden hesaplanmıştır.
            </p>
          </div>
        </section>

        {/* SECTION 4: SIKÇA SORULAN SORULAR — trOnly (§9): the FAQ narrative has no English
            counterpart, so the whole section (visible cards + the JsonLd above) is TR-only. */}
        {locale === "tr" && (
          <section id="sss" className="scroll-mt-28" tabIndex={-1}>
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-2 border-b border-border/70 pb-5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm">
                    Rehber &amp; Soru-Cevap
                  </Badge>
                </div>
                <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                  <HelpCircle className="size-6 text-primary shrink-0" />
                  <span>Coğrafi Bölgeler Hakkında Sıkça Sorulan Sorular</span>
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                  Coğrafya müfredatı, sınav hazırlığı ve genel kültür açısından en çok merak edilen
                  bölgesel kavramlar.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bolgelerFaqs.map((faq, idx) => (
                  <div
                    key={idx}
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

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/v2/turkiye">
            <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
              ← Türkiye İlleri Atlası&apos;na Dön (81 İl)
            </Button>
          </Link>
          <Link href="/v2">
            <Button variant="ghost" size="sm" leftIcon={<Home className="size-4" />}>
              Ana Sayfa
            </Button>
          </Link>
        </div>

        {/* SECTION 5: BİLİMSEL KAYNAKÇA & METODOLOJİ */}
        <div id="kaynakca" className="scroll-mt-28" tabIndex={-1}>
          <V2SourcesSection scope="turkiye" />
        </div>
      </main>

      <V2Footer />
    </div>
  );
}
