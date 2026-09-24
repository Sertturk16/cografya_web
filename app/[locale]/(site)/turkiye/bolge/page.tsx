import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2TurkeyRegions } from "@/components/v2/v2-turkey-regions";
import { PageContainer } from "@/components/patterns/page-container";
import {
  CardGridSkeleton,
  ProseSkeleton,
  StatTileSkeleton,
} from "@/components/patterns/page-skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getRegionsResilient } from "@/lib/api/regions";
import { buildMetadata } from "@/lib/seo/metadata";
import { FaqSection } from "@/components/patterns/faq-section";
import { tr } from "@/lib/text/format-number";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import {
  Compass,
  Users,
  Maximize2,
  Home,
  Boxes,
  Table,
  Landmark,
  Scale,
  ArrowRight,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";

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
      pathname: "/turkiye/bolge",
    }),
    title:
      locale === "tr"
        ? "Türkiye'nin 7 Coğrafi Bölgesi: İlleri, İklimi ve Haritası"
        : "Türkiye's 7 Geographic Regions: Provinces, Climate and Map",
    description:
      locale === "tr"
        ? "1941'deki Birinci Türk Coğrafya Kongresi'nin belirlediği 7 coğrafi bölge ve 21 bölüm. Her bölgenin il sayısı, nüfusu, yüzölçümü ve iklimi yan yana."
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
          question: "Yüzölçümü ve nüfus bakımından en büyük bölgeler hangileri?",
          answer:
            `Yüzölçümü en büyük bölge ${largestByArea.nameTr}'dir: ${tr(largestByArea.areaKm2)} km², ` +
            `Türkiye'deki payı %${tr(largestByArea.areaSharePercent, 2)}. ` +
            `Nüfusta ve nüfus yoğunluğunda ise ${mostPopulous.nameTr} birinci sırada: ` +
            `${tr(mostPopulous.population)} kişi (payı %${tr(mostPopulous.populationSharePercent, 2)}) ` +
            `ve km² başına ${tr(mostPopulous.populationDensity)} kişi.`,
        }
      : null;

  return [
    {
      question: "Türkiye kaç coğrafi bölgeye ayrılır ve bu ayrım ne zaman yapıldı?",
      answer:
        "Türkiye 7 coğrafi bölgeye ve 21 bölüme ayrılır. Bu ayrımı, 6-21 Haziran 1941'de Ankara Üniversitesi Dil ve Tarih-Coğrafya Fakültesi'nde toplanan Birinci Türk Coğrafya Kongresi yaptı.",
    },
    {
      question: "Bölgeler belirlenirken nelere bakıldı?",
      answer:
        "Sınırlar üç grup ölçüte göre çizildi. Birincisi doğal etkenler: yer şekilleri ve uzanışları, dağ sıraları, yükselti ve kıyı tipleri. İkincisi iklim: sıcaklık, yağış rejimi ve bitki örtüsü. Üçüncüsü beşeri ve ekonomik etkenler: nüfusun dağılışı, hangi ürünün nerede yetiştiği, sanayi ve ulaşım ağları.",
    },
    {
      question: "TÜİK'in İBBS bölgeleri ile 7 coğrafi bölge arasındaki fark nedir?",
      answer:
        "7 coğrafi bölge Türkiye'yi doğal yapısına göre ayırır ve sınırları il sınırlarını değil doğal hatları izler. TÜİK'in kullandığı İstatistiki Bölge Birimleri Sınıflandırması (İBBS) Düzey 1 ise 12 bölgeden oluşur. Bu bölgeler Avrupa Birliği'nin istatistik kurallarına uymak için il sınırlarına göre çizildi ve nüfus, ekonomi gibi istatistikleri toplamaya yarar.",
    },
    ...(largestAreaFaq ? [largestAreaFaq] : []),
    {
      question: "Bir ilin toprakları birden fazla coğrafi bölgede bulunabilir mi?",
      answer:
        "Evet. Bölge sınırları il sınırlarını değil doğal hatları izlediği için birçok ilin toprağı birden çok bölgeye yayılır. En bilinen örnekler: Bilecik (Marmara, Ege, Karadeniz ve İç Anadolu), Balıkesir ve Çanakkale (Marmara ve Ege), Bursa (Marmara ve Karadeniz), Kahramanmaraş (Akdeniz, Doğu Anadolu ve Güneydoğu).",
    },
    {
      question: "Hangi bölgelerin denize kıyısı var, hangilerinin yok?",
      answer:
        "7 bölgenin 4'ünün denize kıyısı var: Karadeniz, Marmara, Ege ve Akdeniz. Kalan 3 bölgenin kıyısı yok: İç Anadolu, Doğu Anadolu ve Güneydoğu Anadolu.",
    },
  ];
}

async function loadRegions() {
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

  /**
   * Whether the figures on this page came from the API or from `REGIONS_STATIC_FALLBACK`.
   *
   * The seven regions themselves are a 1941 classification and do not move, so falling back to a
   * static list of NAMES, peaks, climates and subregion counts is honest editorial content. Their
   * POPULATION and AREA figures are not that: they are hand-written numbers that this page prints
   * beneath "TÜİK ADNKS 31 Aralık 2025". Printing them unlabelled when the fetch degraded credits
   * TÜİK with a number TÜİK did not supply on the date claimed — the `|| "Dünya Bankası"` defect,
   * one field over.
   *
   * Gating the provenance rather than the figures follows the pattern already used for
   * `showMarine` on the province page and `earthquakeMeta !== null` on `/deprem`: the page keeps
   * working, and only the claim it can no longer support goes away.
   */
  const figuresAreLive = apiRegions.length === 7;

  // NO `|| 86092168` / `|| 780040`. `.reduce()` over the static list is never 0, so those arms
  // were unreachable — but unreachable invention is still invention, and the day the list is
  // emptied they would have fired silently. The totals are now whatever the rows actually sum to.
  const totalPop = regionsList.reduce((acc, r) => acc + r.population, 0);
  const totalArea = regionsList.reduce((acc, r) => acc + r.areaKm2, 0);

  return { regionsList, figuresAreLive, totalPop, totalArea };
}

async function RegionTotalsTiles({ locale }: { locale: Locale }) {
  const { figuresAreLive, totalPop, totalArea } = await loadRegions();
  return (
    <>
      <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <Users className="size-3.5 text-accent" />{" "}
          {locale === "tr" ? "Toplam Nüfus" : "Total Population"}
        </span>
        <span className="font-heading text-2xl sm:text-3xl font-extrabold text-accent block">
          {totalPop.toLocaleString("tr-TR")}
        </span>
        {figuresAreLive && (
          <span className="text-[11px] text-muted-foreground/80 block">
            {locale === "tr" ? "TÜİK 31 Aralık 2025" : "TÜİK, 31 December 2025"}
          </span>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <Maximize2 className="size-3.5 text-primary" /> {locale === "tr" ? "Yüzölçümü" : "Area"}
        </span>
        <span className="font-heading text-2xl sm:text-3xl font-extrabold text-primary block">
          {totalArea.toLocaleString("tr-TR")} km²
        </span>
        <span className="text-[11px] text-muted-foreground/80 block">
          {locale === "tr"
            ? "81 ilin toplamı, HGM"
            : "81 Provinces, General Directorate of Mapping (HGM)"}
        </span>
      </div>
    </>
  );
}

async function RegionsGrid() {
  const { regionsList } = await loadRegions();
  return <V2TurkeyRegions regions={regionsList} />;
}

async function RegionsComparison() {
  const { regionsList, figuresAreLive, totalPop, totalArea } = await loadRegions();
  return (
    <Card variant="panel" space="6">
      <div className="space-y-2 border-b border-border/70 pb-5">
        {figuresAreLive && (
          <span className="text-xs text-muted-foreground">TÜİK ADNKS 2025 ve HGM</span>
        )}
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Table className="size-6 text-primary shrink-0" />
          <span>Türkiye&apos;nin Yedi Coğrafi Bölgesi Karşılaştırması</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Yedi bölgeyi nüfusa, yüzölçümüne, yoğunluğa ve en yüksek zirveye göre yan yana gör.
          Bölgenin adına tıklarsan kendi sayfası açılır.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-muted/60 text-muted-foreground border-b border-border font-heading font-semibold text-xs">
            <tr>
              <th className="p-3.5 sm:p-4">Bölge</th>
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
                      pathname: "/turkiye/bolge/[slug]",
                      params: { slug: r.slug },
                    }}
                    className="hover:text-primary transition-colors hover:underline"
                  >
                    {r.nameTr}
                  </Link>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-2 rounded-full bg-muted-foreground/40 shrink-0"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {r.isCoastal === true ? "Kıyı" : r.isCoastal === false ? "İç" : "Bilinmiyor"}
                    </span>
                  </span>
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
                  <span className="font-semibold text-foreground block">{r.highestPeakNameTr}</span>
                  <span className="font-mono text-[10px]">
                    {r.highestPeakElevationM > 0 ? `${r.highestPeakElevationM} m` : "-"}
                  </span>
                </td>
                <td className="p-3.5 sm:p-4 text-center">
                  <Link
                    href={{
                      pathname: "/turkiye/bolge/[slug]",
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
      {/* The totals are interpolated, not spelled out. They were written as "86.092.168 nüfus
        ve 780.040 km²" — the same two numbers that sat in `|| 86092168` / `|| 780040` above,
        restated as prose, so correcting the code left the sentence still claiming them.
        A share is computed FROM these totals, so the sentence has to read them too. */}
      <p className="text-[11px] text-muted-foreground/80 italic">
        {figuresAreLive
          ? "* Nüfus: TÜİK ADNKS, 31 Aralık 2025. Yüzölçümü: Harita Genel Müdürlüğü (HGM) kayıtları. "
          : "* Bu rakamlar sitenin kendi arşivinden geliyor; güncel TÜİK ve HGM kayıtlarıyla karşılaştırılmadı. "}
        Paylarda Türkiye toplamı olarak {totalPop.toLocaleString("tr-TR")} kişi ve 81 ilin yüzölçümü
        toplamı olan {totalArea.toLocaleString("tr-TR")} km² alındı.
      </p>
    </Card>
  );
}

async function RegionsFaq({ locale }: { locale: Locale }) {
  const { regionsList } = await loadRegions();
  // The default export ALSO gates the `<Suspense>` boundary around this component on the same
  // `locale === "tr"` check (SECTION 4's comment below), so this inner gate never actually
  // decides anything at runtime. It stays because `page-composition-faq.test.ts`'s
  // `writtenUnderCondition` walks JSX-tag nesting within one function only — a `<FaqSection>`
  // returned as the root of an async section component has no JSX parent for that walk to find,
  // so the outer gate is invisible to it. Repeating the condition here is what keeps this file's
  // `<FaqSection>` reading as gated rather than as a new ungated site.
  return (
    <>
      {locale === "tr" && (
        <FaqSection
          heading="Coğrafi Bölgeler Hakkında Sıkça Sorulan Sorular"
          lede="Bölgelerin nasıl çizildiği, en büyüğü ve denize kıyısı olanlar."
          locale={locale}
          items={buildBolgelerFaqs(regionsList)}
          structuredData="trOnly"
        />
      )}
    </>
  );
}

export default async function V2TurkiyeBolgelerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <V2LiveTicker />

      {/* HERO SECTION */}
      <header className="border-b border-border bg-gradient-to-b from-muted/30 via-background to-background py-10 sm:py-14">
        <PageContainer space="band">
          {/* Breadcrumbs */}
          <Breadcrumbs
            items={[
              {
                label: locale === "tr" ? "Ana Sayfa" : "Home",
                href: "/",
                path: "/",
                icon: <Home className="size-3.5" />,
              },
              {
                label: locale === "tr" ? "Türkiye İlleri" : "Türkiye Atlas",
                href: "/turkiye",
                path: "/turkiye",
              },
              {
                label: locale === "tr" ? "Coğrafi Bölgeler" : "7 Geographic Regions",
                path: "/turkiye/bolge",
              },
            ]}
            locale={locale}
            surface="trOnly"
          />

          {/* Hero Content Card */}
          <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-10 shadow-lg space-y-6">
            <div className="space-y-4 max-w-4xl">
              <h1 className="font-heading text-3xl sm:text-5xl font-extrabold tracking-tight text-primary leading-tight">
                {locale === "tr"
                  ? "Türkiye'nin 7 Coğrafi Bölgesi"
                  : "Türkiye's 7 Geographic Regions Guide"}
              </h1>

              {/* Same provenance-flavoured claim as the 1941-Congress badge two elements above —
                  gated rather than translated for the same reason (tur2-plan.md §7, FEN135-NEW-M5). */}
              {locale === "tr" && (
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-3xl">
                  Türkiye&apos;yi 7 bölgeye ve 21 bölüme ayıran sınırlar, 6–21 Haziran 1941&apos;de
                  Ankara&apos;da toplanan Birinci Türk Coğrafya Kongresi&apos;nde çizildi. Her
                  bölgenin kısa tanıtımı, kongrenin baktığı ölçütler ve yedi bölgenin karşılaştırma
                  tablosu aşağıda.
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
                    4&apos;ü kıyıda, 3&apos;ü iç kesimde
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
                    Bölgelerin alt birimleri
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/80 block">
                    Morphological Subregions
                  </span>
                )}
              </div>

              <Suspense
                fallback={
                  <>
                    <StatTileSkeleton />
                    <StatTileSkeleton />
                  </>
                }
              >
                <RegionTotalsTiles locale={locale} />
              </Suspense>
            </div>
          </div>
        </PageContainer>
      </header>

      {/* QUICKNAV BAR */}
      <nav
        aria-label="Bu sayfadaki bölümler"
        className="sticky top-16 z-30 w-full border-b border-border bg-background/90 backdrop-blur-md transition-all shadow-2xs"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto py-2.5 text-xs font-semibold scrollbar-none">
          <a
            href="#bolgeler"
            className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Bölgeler
          </a>
          <a
            href="#tarihce"
            className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            1941 Kongresi
          </a>
          <a
            href="#kiyaslama"
            className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Karşılaştırma Tablosu
          </a>
          {/* Gated WITH the section it points at, which is the whole reason this gate exists: the
              FAQ block below is TR-only, so on the EN twin this link would scroll to nothing.
              Task 9's first pass ungated both together and had to put both back together. */}
          {locale === "tr" && (
            <a
              href="#sss"
              className="px-3.5 py-1.5 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
            >
              Sıkça Sorulan Sorular
            </a>
          )}
        </div>
      </nav>

      {/* MAIN BODY CONTENT — empty since T-046 filled it in. T-032 (`d2039b6`) de-nested the
          `<main>` landmark into `(site)/layout.tsx` and deleted the
          `<main className="container mx-auto px-4 max-w-7xl py-10 space-y-14">` that wrapped
          everything below, without replacing the width, the padding or the rhythm: only this
          marker survived, and the body rendered edge-to-edge at viewport width with no gutter.
          `default` IS the exact restore here — its `space-y-14` is the deleted wrapper's own
          rhythm, so this page changes width and padding only, not spacing.

          It opens AFTER the sticky quicknav `<nav>` above, not before it. That bar is full-bleed
          and carries its own PageContainer-aligned row inside itself; wrapping it in a padded
          container would change what it sticks to and would make its entry in
          `BODY_WRAPPER_EXEMPTIONS` say something false about why it is exempt. */}
      <PageContainer space="default">
        {/* SECTION 1: 7 BÖLGE VİTRİNİ */}
        <section id="bolgeler" className="scroll-mt-28" tabIndex={-1}>
          <Suspense fallback={<CardGridSkeleton columns="2-4" count={7} />}>
            <RegionsGrid />
          </Suspense>
        </section>

        {/* SECTION 2: 1941 COĞRAFYA KONGRESİ & TARİHÇE */}
        <section id="tarihce" className="scroll-mt-28" tabIndex={-1}>
          <Card variant="panel" space="6">
            <div className="space-y-2 border-b border-border/70 pb-5">
              <span className="text-xs text-muted-foreground">6–21 Haziran 1941, Ankara</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Landmark className="size-6 text-primary shrink-0" />
                <span>Birinci Türk Coğrafya Kongresi</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Türkiye&apos;nin bölgeleri ilk kez ulusal bir kongrede, ortak kararla belirlendi.
                Kongre, Türkiye&apos;yi yer şekillerine, iklimine ve insanların nasıl yaşadığına
                bakarak bölgelere ayırdı. Sınırları aşağıdaki üç ölçüt belirledi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm">
              <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <h3 className="font-heading font-bold text-foreground">Yer Şekilleri</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Karadeniz&apos;de ve Akdeniz&apos;de dağlar kıyıya paralel uzanır. Ege&apos;de
                  kıyıya dik uzanır, aralarında graben vadileri açılır. Doğu Anadolu ise yüksek ve
                  engebeli bir platodur. Ana sınır hatları bu farklardan çıktı.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <h3 className="font-heading font-bold text-foreground">İklim ve Bitki Örtüsü</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kıyıları çevredeki denizler ılıtır. Deniz etkisinin ulaşmadığı iç kesimlerde step
                  iklimi görülür, Doğu Anadolu&apos;da ise karasal iklim en sert hâlini alır. Kongre
                  bu farklara bitki örtüsüyle birlikte baktı.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <h3 className="font-heading font-bold text-foreground">Nüfus ve Ekonomi</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nüfusun nerede yoğunlaştığı, hangi ürünün nerede yetiştiği (zeytin, fındık, tahıl,
                  çay), sanayi merkezleri ve eski ticaret yolları, 7 bölgenin 21 bölüme ayrılmasında
                  belirleyici oldu.
                </p>
              </div>
            </div>

            {/* Callout: NUTS-1 vs Classic 7 Regions */}
            <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start gap-3 text-xs leading-relaxed">
              <Scale className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-foreground block">
                  TÜİK&apos;in 12 Bölgesi Başka Bir Sistem
                </span>
                <p className="text-muted-foreground">
                  TÜİK, verilerini Avrupa Birliği&apos;nin istatistik bölgeleri sistemine uyan İBBS
                  Düzey 1&apos;e göre, yani 12 bölge üzerinden yayımlar. Bu bölgeler il sınırlarıyla
                  çizilir. Okulda ve fiziki coğrafyada kullanılan ise 1941 Kongresi&apos;nin doğal
                  hatlara dayanan 7 bölgesidir.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 3: ANALİTİK KIYASLAMA TABLOSU */}
        <section id="kiyaslama" className="scroll-mt-28" tabIndex={-1}>
          <Suspense fallback={<ProseSkeleton lines={6} />}>
            <RegionsComparison />
          </Suspense>
        </section>

        {/* SECTION 4: SIKÇA SORULAN SORULAR.

            BOTH HALVES MOVE AS ONE, and the gate is still written here on purpose — Ruling CH.
            The first pass of Task 9 mapped this page's `locale === "tr"` onto
            `structuredData="trOnly"` alone, reasoning that de-indexing a surface is no reason to
            withhold answers from a reader. That is true in general and wrong here: these questions
            are Turkish literals from `buildBolgelerFaqs`, so it did not give an EN reader the
            answers, it gave them Turkish prose the EN twin had never shown. `structuredData`
            withholds the schema; only a gate withholds the markup, and this block needs both.

            So the gate wraps the whole component and `structuredData` carries the page's own
            surface constant (`generateMetadata` above passes the same `"trOnly"` to
            `buildMetadata`). The two cannot now disagree: no `<FaqSection>`, no schema, because
            the schema is emitted from inside it. That is exactly the property the plan asked for
            — one switch, not two — reached by gating the component rather than by deleting the
            gate. `/deniz` carries the identical shape for the identical reason. */}
        {locale === "tr" && (
          <Suspense fallback={<ProseSkeleton lines={4} />}>
            <RegionsFaq locale={locale} />
          </Suspense>
        )}

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/turkiye">
            <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
              Türkiye Haritasına Dön
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" leftIcon={<Home className="size-4" />}>
              Ana Sayfa
            </Button>
          </Link>
        </div>
      </PageContainer>
    </>
  );
}
