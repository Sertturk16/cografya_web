import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2RichProse } from "@/components/v2/v2-rich-prose";
import { V2RegionLocatorMap } from "@/components/v2/v2-region-locator-map";
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
  Globe2,
  Droplets,
  Activity,
  Award,
  BarChart3,
  Landmark,
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
    mapFill: string;
    mapStroke: string;
  }
> = {
  MARMARA: {
    nameTr: "Marmara Bölgesi",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    gradient: "from-amber-500/10 via-background to-background",
    accentColor: "text-amber-600 dark:text-amber-400",
    borderAccent: "border-amber-500/30",
    mapFill: "var(--region-marmara, #0072b2)",
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  EGE: {
    nameTr: "Ege Bölgesi",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    gradient: "from-teal-500/10 via-background to-background",
    accentColor: "text-teal-600 dark:text-teal-400",
    borderAccent: "border-teal-500/30",
    mapFill: "var(--region-ege, #e69f00)",
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  AKDENIZ: {
    nameTr: "Akdeniz Bölgesi",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    gradient: "from-emerald-500/10 via-background to-background",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    borderAccent: "border-emerald-500/30",
    mapFill: "var(--region-akdeniz, #56b4e9)",
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  IC_ANADOLU: {
    nameTr: "İç Anadolu Bölgesi",
    badgeClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    gradient: "from-yellow-500/10 via-background to-background",
    accentColor: "text-yellow-600 dark:text-yellow-400",
    borderAccent: "border-yellow-500/30",
    mapFill: "var(--region-ic-anadolu, #f0e442)",
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  KARADENIZ: {
    nameTr: "Karadeniz Bölgesi",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    gradient: "from-cyan-500/10 via-background to-background",
    accentColor: "text-cyan-600 dark:text-cyan-400",
    borderAccent: "border-cyan-500/30",
    mapFill: "var(--region-karadeniz, #cc79a7)",
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  DOGU_ANADOLU: {
    nameTr: "Doğu Anadolu Bölgesi",
    badgeClass: "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30",
    gradient: "from-stone-500/10 via-background to-background",
    accentColor: "text-stone-600 dark:text-stone-400",
    borderAccent: "border-stone-500/30",
    mapFill: "var(--region-dogu-anadolu, #009e73)",
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  GUNEYDOGU_ANADOLU: {
    nameTr: "Güneydoğu Anadolu Bölgesi",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    gradient: "from-orange-500/10 via-background to-background",
    accentColor: "text-orange-600 dark:text-orange-400",
    borderAccent: "border-orange-500/30",
    mapFill: "var(--region-guneydogu-anadolu, #d55e00)",
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
};

const REGION_NAME_TO_SLUG: Record<string, string> = {
  Marmara: "marmara",
  "Marmara Bölgesi": "marmara",
  Ege: "ege",
  "Ege Bölgesi": "ege",
  Akdeniz: "akdeniz",
  "Akdeniz Bölgesi": "akdeniz",
  "İç Anadolu": "ic-anadolu",
  "İç Anadolu Bölgesi": "ic-anadolu",
  Karadeniz: "karadeniz",
  "Karadeniz Bölgesi": "karadeniz",
  "Doğu Anadolu": "dogu-anadolu",
  "Doğu Anadolu Bölgesi": "dogu-anadolu",
  "Güneydoğu Anadolu": "guneydogu-anadolu",
  "Güneydoğu Anadolu Bölgesi": "guneydogu-anadolu",
};

const SUBREGION_DETAILS: Record<string, { provincesTr: string; highlight: string }> = {
  // Marmara
  "Yıldız Dağları Bölümü": {
    provincesTr: "Kırklareli, Tekirdağ (kuzeyi)",
    highlight: "Istranca (Yıldız) masifi, gür meşe-kayın ormanları ve Karadeniz kıyı kuşağı",
  },
  "Ergene Bölümü": {
    provincesTr: "Edirne, Tekirdağ",
    highlight: "Ergene havzası, düz tabanlı tarım arazileri, ayçiçeği, çeltik ve buğday tarımı",
  },
  "Çatalca-Kocaeli Bölümü": {
    provincesTr: "İstanbul, Kocaeli, Sakarya, Yalova",
    highlight:
      "İstanbul ve Çanakkale boğazları, küresel sanayi ve lojistik ağı, en yüksek nüfus yoğunluğu",
  },
  "Güney Marmara Bölümü": {
    provincesTr: "Bursa, Balıkesir, Çanakkale, Bilecik",
    highlight: "Verimli çöküntü ve delta ovaları, tarım-sanayi entegrasyonu ve Uludağ masifi",
  },
  // Ege
  "Ege Bölümü (Asıl Ege)": {
    provincesTr: "İzmir, Manisa, Aydın, Muğla, Denizli",
    highlight:
      "Horst-graben morfolojisi, kıyıya dik uzanan dağlar, Gediz ve Menderes graben ovaları",
  },
  "İç Batı Anadolu Bölümü": {
    provincesTr: "Afyonkarahisar, Kütahya, Uşak",
    highlight:
      "Yüksek platolar, eşik arazisi, karasallaşan iklim, tahıl tarımı ve zengin termal kaynaklar",
  },
  // Akdeniz
  "Adana Bölümü": {
    provincesTr: "Adana, Mersin, Hatay, Osmaniye, Kahramanmaraş",
    highlight:
      "Çukurova deltası, verimli alüvyal taban, endüstriyel tarım, narenciye ve İskenderun sanayi hattı",
  },
  "Antalya Bölümü": {
    provincesTr: "Antalya, Isparta, Burdur",
    highlight:
      "Teke ve Taşeli karstik platoları, polye-kanyon morfolojisi, Batı Toroslar ve sahil turizmi",
  },
  // İç Anadolu
  "Konya Bölümü": {
    provincesTr: "Konya, Karaman, Aksaray",
    highlight:
      "Geniş kapalı havza, taban ovaları, Türkiye'nin tahıl ambarı ve Tuz Gölü güney kıyıları",
  },
  "Yukarı Sakarya Bölümü": {
    provincesTr: "Ankara, Eskişehir",
    highlight: "Başkent idari merkezi, yüksek sanayi ve hizmet sektörü yoğunluğu, plato düzlükleri",
  },
  "Orta Kızılırmak Bölümü": {
    provincesTr: "Kayseri, Kırşehir, Nevşehir, Yozgat, Kırıkkale, Niğde",
    highlight:
      "Volkanik Erciyes-Hasan Dağı sahaları, Kapadokya peri bacaları ve Kızılırmak büklümü",
  },
  "Yukarı Kızılırmak Bölümü": {
    provincesTr: "Sivas",
    highlight:
      "Kızılırmak kaynak alanı, yüksek ve engebeli plato yüzeyleri, sert karasal iklim koşulları",
  },
  // Karadeniz
  "Batı Karadeniz Bölümü": {
    provincesTr: "Bolu, Düzce, Zonguldak, Karabük, Bartın, Kastamonu, Sinop",
    highlight: "Gür orman kuşakları, taş kömürü havzası, Küre Dağları ve ağır demir-çelik sanayisi",
  },
  "Orta Karadeniz Bölümü": {
    provincesTr: "Samsun, Ordu, Amasya, Tokat, Çorum",
    highlight:
      "Yeşilırmak ve Kızılırmak deltaları (Bafra, Çarşamba), alçak geçitler ve verimli tarım",
  },
  "Doğu Karadeniz Bölümü": {
    provincesTr: "Trabzon, Rize, Artvin, Giresun, Gümüşhane, Bayburt",
    highlight: "En yüksek yıllık yağış, dik Kaçkar yamaçları, çay ve fındık monokültürü",
  },
  // Doğu Anadolu
  "Erzurum-Kars Bölümü": {
    provincesTr: "Erzurum, Kars, Ardahan, Ağrı, Iğdır",
    highlight:
      "Yüksek bazaltik lav platoları, çernozyom topraklar, sert karasal kışlar ve mera hayvancılığı",
  },
  "Yukarı Fırat Bölümü": {
    provincesTr: "Malatya, Elazığ, Erzincan, Tunceli, Bingöl",
    highlight: "Fırat havzası baraj gölleri (Keban, Karakaya), çöküntü ovaları ve kayısı bahçeleri",
  },
  "Yukarı Murat-Van Bölümü": {
    provincesTr: "Van, Muş, Bitlis",
    highlight: "Van Gölü kapalı havzası, volkanik koniler (Nemrut, Süphan) ve yüksek yaylalar",
  },
  "Hakkari Bölümü": {
    provincesTr: "Hakkâri, Şırnak (doğusu)",
    highlight:
      "Türkiye'nin en sarp ve engebeli buzul topoğrafyası (Cilo-Sat zirveleri) ve derin vadiler",
  },
  // Güneydoğu Anadolu
  "Dicle Bölümü": {
    provincesTr: "Diyarbakır, Şırnak, Batman, Mardin, Siirt",
    highlight:
      "Dicle havzası, GAP sulama alanları, Karacadağ bazalt platosu ve Batman petrol sahaları",
  },
  "Orta Fırat Bölümü": {
    provincesTr: "Gaziantep, Kilis, Adıyaman, Şanlıurfa",
    highlight: "Gaziantep sanayi koridoru, Fırat kıyısı ovaları, Antep fıstığı ve zeytin tarımı",
  },
};

const REGION_DISASTER_PROFILES: Record<
  string,
  {
    faultLines: string[];
    primaryRisks: string[];
    warningNote: string;
  }
> = {
  MARMARA: {
    faultLines: ["Kuzey Anadolu Fay Hattı (KAF) Kuzey Kolu", "KAF Güney Kolu", "Ganos Fay Zonu"],
    primaryRisks: [
      "Yüksek Büyüklükte Sismik Tehlike (M≥7.0)",
      "Marmara Denizi İkincil Tsunami Riski",
      "Alüvyon Zemin Sıvılaşması",
    ],
    warningNote:
      "İstanbul, Kocaeli, Sakarya ve Yalova aksı aktif fay segmentleri üzerinde yer almakta olup kentsel dirençlilik ve zemin güçlendirmesi hayatidir.",
  },
  EGE: {
    faultLines: [
      "Gediz Grabeni Fay Sistemi",
      "Büyük Menderes Grabeni",
      "Küçük Menderes Fayı",
      "İzmir Fayı",
    ],
    primaryRisks: [
      "Sık Aralıklarla Yıkıcı Depremler",
      "Graben Tabanlarında Zemin Sıvılaşması",
      "Ege Denizi Kıyı Tsunami Olasılığı",
    ],
    warningNote:
      "Horst-graben sistemi sebebiyle kabuk sürekli gerilme altındadır; sığ odaklı sarsıntılar geniş alanda yüksek şiddetle hissedilir.",
  },
  AKDENIZ: {
    faultLines: [
      "Doğu Anadolu Fayı (DAF) Hatay Uzantısı",
      "Kıbrıs Yayı Dalma-Batma Zonu",
      "Ecemiş Fayı",
    ],
    primaryRisks: [
      "Levha Sınırı Tektoniği & Deprem",
      "Karstik Arazide Çöküntü ve Kaya Düşmesi",
      "Akdeniz Kıyı Kuşağında Fırtına ve Taşkın",
    ],
    warningNote:
      "Doğu Akdeniz (Hatay, Kahramanmaraş, Osmaniye) DAF etkisiyle en kritik sismik fay hattı üzerindedir; batıda ise karstik obruk ve sel riskleri öne çıkar.",
  },
  IC_ANADOLU: {
    faultLines: [
      "Tuz Gölü Fay Zonu",
      "Eskişehir Fay Zonu",
      "Akşehir Fay Segmenti",
      "Ecemiş Fay Kuşağı",
    ],
    primaryRisks: [
      "Obruk Oluşumu ve Karstik Zemin Yarıkları",
      "Meteorolojik ve Tarımsal Kuraklık / Çölleşme",
      "Yerel Orta Büyüklükte Sarsıntılar",
    ],
    warningNote:
      "Deprem tehlikesi kıyılara kıyasla düşük olsa da yeraltı suyunun çekilmesine bağlı obruk yarıkları ve kuraklık riski en belirgin afettir.",
  },
  KARADENIZ: {
    faultLines: [
      "Kuzey Anadolu Fayı (Güney Vadiler Boyunca)",
      "Karadeniz Sahil Tektonik Kıvrımları",
    ],
    primaryRisks: [
      "Şiddetli Heyelan ve Kütle Hareketleri",
      "Ani Sağanak, Sel ve Moloz Taşkınları",
      "KAF Güney Vadiler Boyunca Sismik Etkinlik",
    ],
    warningNote:
      "Dik yamaçlar, suya doygun killi zemin ve yoğun yağış rejimi, Türkiye'de en fazla heyelan ve sel hadisesinin yaşandığı afet bölgesini oluşturur.",
  },
  DOGU_ANADOLU: {
    faultLines: [
      "Kuzey Anadolu Fay Zonu (KAF)",
      "Doğu Anadolu Fay Zonu (DAF)",
      "Bingöl-Karlıova Tektonik Düğümü",
    ],
    primaryRisks: [
      "En Yüksek Sismik Enerji Boşalımı (M≥7.2)",
      "Kış Aylarında Kar Engeli ve Çığ Düşmesi",
      "Sarp Vadilerde Heyelan ve Kaya Düşmesi",
    ],
    warningNote:
      "KAF ve DAF hatlarının kesiştiği Karlıova ve çevre iller (Bingöl, Malatya, Elazığ, Erzincan, Muş) Türkiye'nin en hareketli tektonik düğümüdür.",
  },
  GUNEYDOGU_ANADOLU: {
    faultLines: [
      "Bitlis-Zagros Bindirme Kuşağı",
      "Doğu Anadolu Fayı Batı Segmenti (Gaziantep/Adıyaman)",
    ],
    primaryRisks: [
      "Kuzey ve Batı Sınırlarında Yıkıcı Deprem",
      "Yaz Kuraklığı, Aşırı Sıcaklar ve Toz Fırtınası",
      "Fırat-Dicle Tabanlarında Taşkın",
    ],
    warningNote:
      "Kuzeyde Bitlis bindirmesi ve batıda DAF kritik sismik risk taşırken, güney düzlüklerinde iklim krizi, aşırı sıcaklar ve toz taşınımı etkilidir.",
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
    mapFill: "var(--color-primary, #b0522e)",
    mapStroke: "var(--color-primary-dark, #7e3a1e)",
  };

  const isCoastal = region.coastalSeas.length > 0;
  const canonicalPath = `/v2/turkiye/bolge/${region.slug}`;

  // Find most populous and largest provinces in this region
  const mostPopulousProvince =
    [...region.provinces].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0] ?? null;
  const largestProvince =
    [...region.provinces].sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0))[0] ?? null;
  const avgProvincePop =
    region.provinceCount > 0 ? Math.round(region.population / region.provinceCount) : 0;

  // Subregions dynamic grid classes (avoid empty half-grids for 2 or 3 items)
  const subregionsGridClass =
    region.subregions?.length === 2
      ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
      : region.subregions?.length === 3
        ? "grid grid-cols-1 sm:grid-cols-3 gap-4"
        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";

  const disasterProfile = REGION_DISASTER_PROFILES[region.region] ?? null;

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
                  Tüm İller &amp; Atlas
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
                  %{region.populationSharePercent.toFixed(2)}
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
                  %{region.areaSharePercent.toFixed(2)}
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

      {/* QUICKNAV / JUMP NAVIGATION BAR (SCROLLBAR HIDDEN) */}
      <nav
        aria-label="Bölüm İndeksi"
        className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border py-2.5 overflow-x-auto scrollbar-none"
      >
        <div className="container mx-auto px-4 max-w-7xl flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
            <Layers className="size-3.5" /> Bölümler:
          </span>
          <a
            href="#konum-ve-harita"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Konum &amp; Harita
          </a>
          <a
            href="#fiziki-cografya"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Fiziki Coğrafya
          </a>
          <a
            href="#sosyo-ekonomi"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Nüfus &amp; Ekonomi
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
          <a
            href="#kaynakca"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Metodoloji &amp; Kaynakça
          </a>
        </div>
      </nav>

      {/* BODY CONTENT CONTAINER */}
      <main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">
        {/* SECTION 1: KONUM, SINIRLAR & HARİTA VİTRİNİ (12-COLUMN ASYMMETRIC GRID) */}
        <section id="konum-ve-harita" className="scroll-mt-28" tabIndex={-1}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: Prose & Boundaries Card */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
                <div className="space-y-2 border-b border-border/70 pb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" size="sm">
                      Mekânsal Konum &amp; Sınırlar
                    </Badge>
                  </div>
                  <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                    <Compass className="size-6 text-primary shrink-0" />
                    <span>{region.nameTr} Coğrafi Konumu ve Sınırları</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Bölgenin Türkiye üzerindeki mekânsal yayılımı, komşu coğrafi bölgeler, kıyısı
                    olan denizler ve sınır kapıları.
                  </p>
                </div>

                <V2RichProse text={region.locationAndBordersTr} />

                {/* Regional Bordering & Context Badges */}
                <div className="pt-4 border-t border-border space-y-4">
                  {/* Komşu Bölgeler */}
                  {region.neighborRegions?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Komşu Coğrafi Bölgeler:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {region.neighborRegions.map((nbName) => {
                          const targetSlug = REGION_NAME_TO_SLUG[nbName];
                          return targetSlug ? (
                            <Link
                              key={nbName}
                              href={{
                                pathname: "/v2/turkiye/bolge/[slug]",
                                params: { slug: targetSlug },
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted hover:bg-primary/15 hover:text-primary border border-border transition-all group"
                            >
                              <span>{nbName}</span>
                              <ArrowUpRight className="size-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          ) : (
                            <Badge key={nbName} variant="outline" className="bg-muted text-xs py-1">
                              {nbName}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Komşu Ülkeler */}
                  {region.neighborCountries?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Uluslararası Kara Komşuları:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {region.neighborCountries.map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="bg-muted/80 text-foreground border-border text-xs py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <Globe2 className="size-3.5 text-primary" />
                            <span>{c}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deniz Kıyıları */}
                  {region.coastalSeas?.length > 0 ? (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Kıyısı Olan Denizler:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {region.coastalSeas.map((sea) => (
                          <Badge
                            key={sea}
                            variant="outline"
                            className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25 text-xs py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <Waves className="size-3.5" />
                            <span>{sea}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Deniz Kıyısı Durumu:
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-muted/60 text-muted-foreground text-xs py-1 px-2.5"
                      >
                        İç Kara Bölgesi (Açık denize doğrudan kıyısı bulunmamaktadır)
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Interactive Region Locator Map + Regional Facts */}
            <div className="lg:col-span-5 space-y-6">
              <V2RegionLocatorMap
                regionName={region.nameTr}
                regionSlug={region.slug}
                provinces={region.provinces}
                fillColor={theme.mapFill}
                strokeColor={theme.mapStroke}
              />

              {/* Regional Geographic Facts Card */}
              <div className="p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-sm space-y-3.5">
                <div className="flex items-center gap-2">
                  <Landmark className="size-4 text-primary" />
                  <h3 className="font-heading font-bold text-sm text-foreground">
                    {region.nameTr} Coğrafi Özeti
                  </h3>
                </div>

                <div className="divide-y divide-border text-xs">
                  {region.highestPointName && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-muted-foreground">En Yüksek Zirve:</span>
                      <span className="font-semibold text-foreground text-right">
                        {region.highestPointName}{" "}
                        {region.highestPointElevationM
                          ? `(${format.number(region.highestPointElevationM)} m)`
                          : ""}
                      </span>
                    </div>
                  )}
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Kıyısı Olan Denizler:</span>
                    <span className="font-semibold text-foreground text-right">
                      {isCoastal ? region.coastalSeas.join(", ") : "İç Kara (Kıyısı Yok)"}
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Coğrafi Alt Bölüm:</span>
                    <a
                      href="#bolumler"
                      className="font-semibold text-primary hover:underline text-right"
                    >
                      {region.subregions?.length > 0 && region.subregions.length <= 2
                        ? `${region.subregionCount} Alt Bölüm (${region.subregions
                            .map((s) => s.replace(" Bölümü", ""))
                            .join(", ")})`
                        : `${region.subregionCount} Coğrafi Alt Bölüm`}
                    </a>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-muted-foreground">İl Sayısı:</span>
                    <span className="font-semibold text-foreground">{region.provinceCount} İl</span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Toplam İlçe Sayısı:</span>
                    <span className="font-semibold text-foreground">
                      {region.districtCount} İlçe
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: FİZİKİ COĞRAFYA & DOĞAL ÇEVRE */}
        <section id="fiziki-cografya" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  Fiziki Coğrafya &amp; Doğal Çevre
                </Badge>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Yeryüzü Şekilleri, İklim Kuşakları ve Hidrografya
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Bölgenin morfolojik omurgası, dağ sıraları, tektonik çöküntüleri, baskın iklim
                özellikleri ve hidrografik su ağı.
              </p>
            </div>

            {/* Highest Point Highlight Banner (if available) */}
            {region.highestPointName && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                    Bölgenin En Yüksek Zirvesi
                  </span>
                  <div className="font-heading font-extrabold text-lg sm:text-xl text-foreground flex items-center gap-2">
                    <Mountain className="size-5 text-amber-600 shrink-0" />
                    <span>{region.highestPointName}</span>
                    {region.highestPointProvince && (
                      <span className="text-xs font-normal text-muted-foreground">
                        ({region.highestPointProvince})
                      </span>
                    )}
                  </div>
                </div>
                {region.highestPointElevationM && (
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-2xl text-amber-700 dark:text-amber-400">
                      {format.number(region.highestPointElevationM)} m
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Denizden Yükseklik
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 3 Physical Pillars: 3 equal-width columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pt-2">
              {/* Pillar 1: Jeomorfoloji & Dağlar */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <Badge
                      variant="outline"
                      size="sm"
                      className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    >
                      Jeomorfoloji &amp; Dağlar
                    </Badge>
                    <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                      <Mountain className="size-5 text-amber-600 shrink-0" />
                      <span>Yeryüzü Şekilleri ve Ovalar</span>
                    </h3>
                  </div>
                  <V2RichProse text={region.landformsTr} />
                </div>
              </div>

              {/* Pillar 2: Klimatoloji & Vejetasyon */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <Badge
                      variant="outline"
                      size="sm"
                      className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
                    >
                      Klimatoloji &amp; Vejetasyon
                    </Badge>
                    <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                      <CloudSun className="size-5 text-teal-600 shrink-0" />
                      <span>İklim Tipleri ve Bitki Örtüsü</span>
                    </h3>
                  </div>
                  <V2RichProse text={region.climateAndVegetationTr} />
                </div>
              </div>

              {/* Pillar 3: Hidrografya & Su Ağı */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <Badge
                      variant="outline"
                      size="sm"
                      className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                    >
                      Hidrografya &amp; Su Ağı
                    </Badge>
                    <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                      <Droplets className="size-5 text-cyan-600 shrink-0" />
                      <span>Akarsular, Göller ve Havzalar</span>
                    </h3>
                  </div>
                  <V2RichProse text={region.hydrographyTr} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SOSYO-EKONOMİK DİNAMİKLER */}
        <section id="sosyo-ekonomi" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  Sosyo-Ekonomik Dinamikler
                </Badge>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <TrendingUp className="size-6 text-primary shrink-0" />
                <span>Nüfus Dağılımı, Yerleşme ve Bölgesel İktisat</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Demografik yoğunlaşma, şehirleşme oranları, göç hareketleri, sanayi üretimi ve millî
                hasıla katkısı.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* Left Column: Population & Settlement */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <Badge
                      variant="outline"
                      size="sm"
                      className="bg-primary/10 text-primary border-primary/30"
                    >
                      Demografi &amp; Şehirleşme
                    </Badge>
                    <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                      <Users className="size-5 text-primary shrink-0" />
                      <span>Nüfus Dağılımı, Yerleşme ve Göç</span>
                    </h3>
                  </div>

                  {/* Demographic Metrics Chips */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-card border border-border/80 space-y-1">
                      <span className="text-[11px] text-muted-foreground block">
                        Ülke Nüfus Payı
                      </span>
                      <span className="font-heading font-extrabold text-xl text-foreground">
                        %{region.populationSharePercent.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-card border border-border/80 space-y-1">
                      <span className="text-[11px] text-muted-foreground block">
                        Aritmetik Yoğunluk
                      </span>
                      <span className="font-heading font-extrabold text-xl text-foreground">
                        {region.populationDensity} kişi/km²
                      </span>
                    </div>
                  </div>

                  <V2RichProse text={region.settlementAndPopulationTr} />
                </div>
              </div>

              {/* Right Column: Economy & Production */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <Badge
                      variant="outline"
                      size="sm"
                      className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    >
                      Bölgesel İktisat &amp; Üretim
                    </Badge>
                    <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="size-5 text-amber-600 shrink-0" />
                      <span>Ekonomik Güç, Sanayi ve Tarım</span>
                    </h3>
                  </div>

                  {/* GDP Contribution Callout */}
                  {region.gdpShareApproxPercent !== null && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
                          Türkiye GSYH Tahmini Katkısı
                        </span>
                        <span className="font-heading font-extrabold text-2xl text-foreground">
                          ~%{region.gdpShareApproxPercent}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs bg-background/80">
                        TÜİK İl GSYH Tabanı
                      </Badge>
                    </div>
                  )}

                  <V2RichProse text={region.economyTr} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: 1941 BİRİNCİ COĞRAFYA KONGRESİ BÖLÜMLERİ */}
        <section id="bolumler" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" size="sm">
                  1941 Kongre Tasnifi
                </Badge>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Boxes className="size-6 text-primary shrink-0" />
                <span>{region.nameTr} Coğrafi Bölümleri ve Yöreleri</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                T.C. Maarif Vekilliği Birinci Coğrafya Kongresi (1941) kararlarıyla belirlenen ve
                morfolojik sınırlarla çizilen {region.subregionCount} alt bölüm.
              </p>
            </div>

            {/* Subregion Explanatory Prose */}
            <V2RichProse text={region.subregionsTr} />

            {/* Visual Subregions Card Deck (Dynamic Grid with detailed cards) */}
            {region.subregions?.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-muted-foreground block mb-3">
                  Kongre Kararıyla Tanımlanan {region.subregions.length} Alt Bölüm:
                </span>
                <div className={subregionsGridClass}>
                  {region.subregions.map((subName, idx) => {
                    const detail = SUBREGION_DETAILS[subName];
                    return (
                      <div
                        key={subName}
                        className="p-5 rounded-2xl bg-muted/40 border border-border/80 hover:border-primary/40 hover:bg-muted/70 transition-all space-y-3 group shadow-2xs flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-md bg-primary/10">
                              0{idx + 1}
                            </span>
                            <Layers className="size-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                          </div>
                          <h3 className="font-heading font-bold text-base text-foreground group-hover:text-primary transition-colors">
                            {subName}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {detail?.highlight ??
                              "Morfolojik ve iklimsel sınırlarla belirlenmiş resmî coğrafi alt bölüm."}
                          </p>
                        </div>

                        {detail?.provincesTr && (
                          <div className="pt-2.5 border-t border-border/60 text-[11px]">
                            <span className="text-muted-foreground block font-medium">
                              Bölüm Kapsamı:
                            </span>
                            <span className="font-semibold text-foreground/90">
                              {detail.provincesTr}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 5: BÖLGEDEKİ İLLER REHBERİ & CANLI VERİ TABLOSU */}
        <section id="iller" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  İdari Coğrafya &amp; Mülki Taksimat
                </Badge>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Building2 className="size-6 text-primary shrink-0" />
                <span>
                  {region.nameTr} Bünyesindeki {region.provinceCount} İl Rehberi
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Bölgeyi oluşturan mülki idare birimlerinin güncel nüfus, yüzölçümü ve nüfus
                yoğunluğu verileri (31 Aralık 2025 ADNKS ve HGM kayıtları).
              </p>
            </div>

            {/* Top Province Highlights Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2 border-b border-border">
              {mostPopulousProvince && (
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium">En Kalabalık İl</span>
                    <Award className="size-3.5 text-primary" />
                  </div>
                  <div className="font-heading font-bold text-base text-foreground">
                    {mostPopulousProvince.nameTr}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {mostPopulousProvince.population
                      ? `${format.number(mostPopulousProvince.population)} kişi`
                      : ""}
                  </div>
                </div>
              )}

              {largestProvince && (
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium">En Geniş İl</span>
                    <Maximize2 className="size-3.5 text-teal-600" />
                  </div>
                  <div className="font-heading font-bold text-base text-foreground">
                    {largestProvince.nameTr}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {largestProvince.areaKm2 ? `${format.number(largestProvince.areaKm2)} km²` : ""}
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-medium">Ortalama İl Nüfusu</span>
                  <BarChart3 className="size-3.5 text-amber-600" />
                </div>
                <div className="font-heading font-bold text-base text-foreground">
                  {format.number(avgProvincePop)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {region.provinceCount} İl Arasında Ortalama
                </div>
              </div>
            </div>

            {/* Full Provinces Table */}
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
                      Yüzölçümü (km²)
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Yoğunluk
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      İncele
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {region.provinces.map((prov) => {
                    const density =
                      prov.population && prov.areaKm2 && prov.areaKm2 > 0
                        ? Math.round(prov.population / prov.areaKm2)
                        : null;

                    return (
                      <tr key={prov.plateCode} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-xs text-primary">
                          TR-{prov.plateCode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <Link
                            href={{
                              pathname: "/v2/turkiye/[slug]",
                              params: { slug: prov.slugTr },
                            }}
                            className="hover:text-primary transition-colors inline-flex items-center gap-1 group"
                          >
                            <span>{prov.nameTr}</span>
                            <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {prov.population ? format.number(prov.population) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {prov.areaKm2 ? format.number(prov.areaKm2) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {density ? `${density} kişi/km²` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={{
                              pathname: "/v2/turkiye/[slug]",
                              params: { slug: prov.slugTr },
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2 text-primary"
                            >
                              Detay →
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 6: DOĞAL AFET VE DEPREM RİSKİ */}
        <section id="afet" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/15 p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-rose-500/20 pb-5">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  size="sm"
                  className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                >
                  Doğal Afet &amp; Depremsellik
                </Badge>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <ShieldAlert className="size-6 text-rose-600 shrink-0" />
                <span>Deprem Kuşakları ve Bölgesel Afet Profili</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Bölgenin tektonik konumu, aktif fay zonları, tarihsel deprem kayıtları ve morfolojik
                risk profili.
              </p>
            </div>

            {/* 12-Column Split: Prose (7 cols) + Seismic Profile Card (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 Columns: Prose */}
              <div className="lg:col-span-7 space-y-4">
                <V2RichProse text={region.disasterAndEarthquakeTr} />
              </div>

              {/* Right 5 Columns: Seismic & Hazard Profile Card */}
              <div className="lg:col-span-5 space-y-4">
                {disasterProfile && (
                  <div className="p-5 rounded-2xl bg-card border border-rose-500/20 shadow-xs space-y-4">
                    <div className="flex items-center">
                      <span className="font-heading font-bold text-sm text-foreground flex items-center gap-1.5">
                        <ShieldAlert className="size-4 text-rose-600" />
                        <span>Sismik &amp; Afet Özeti</span>
                      </span>
                    </div>

                    {/* Active Fault Lines */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground block">
                        Kritik Fay Hatları &amp; Tektonik Sistemler:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {disasterProfile.faultLines.map((fl) => (
                          <span
                            key={fl}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-muted border border-border text-foreground font-medium"
                          >
                            <span>•</span>
                            <span>{fl}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Primary Hazards */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground block">
                        Öne Çıkan Doğal Afet Unsurları:
                      </span>
                      <div className="space-y-1">
                        {disasterProfile.primaryRisks.map((pr) => (
                          <div
                            key={pr}
                            className="text-xs text-foreground/90 flex items-center gap-2 p-1.5 rounded-lg bg-muted/40"
                          >
                            <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span>{pr}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warning Note */}
                    <div className="pt-2 border-t border-border/80 text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">Afet Bilinci Notu: </span>
                      {disasterProfile.warningNote}
                    </div>

                    {/* Emergency Notice */}
                    <div className="p-2.5 rounded-xl bg-muted/60 border border-border text-[10px] text-muted-foreground flex items-center justify-end">
                      <span className="font-semibold text-rose-600">Acil: 112</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: 7 BÖLGE KARŞILAŞTIRMASI */}
        <section id="kiyaslama" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  Atlas Kıyaslaması
                </Badge>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Table className="size-6 text-primary shrink-0" />
                <span>Türkiye&apos;nin Yedi Coğrafi Bölgesi Karşılaştırması</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Nüfus büyüklüğü, alan payı, nüfus yoğunluğu ve idari mülki bölünüş açısından yedi
                coğrafi bölgenin analitik kıyaslaması.
              </p>
            </div>

            {/* Pure geographical comparative prose */}
            {region.comparisonTr && <V2RichProse text={region.comparisonTr} />}

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

        {/* SECTION 8: SIKÇA SORULAN SORULAR */}
        {region.faqs?.length > 0 && (
          <section id="sss" className="scroll-mt-28" tabIndex={-1}>
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
              {/* Header INSIDE the Card */}
              <div className="space-y-2 border-b border-border/70 pb-5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm">
                    Rehber &amp; Soru-Cevap
                  </Badge>
                </div>
                <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                  <HelpCircle className="size-6 text-primary shrink-0" />
                  <span>{region.nameTr} Hakkında Sıkça Sorulan Sorular</span>
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                  Bölgenin coğrafi yapısı, nüfusu, illeri, bölümleri ve iklimi hakkında merak edilen
                  temel sorular ve yanıtları.
                </p>
              </div>

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

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/v2/turkiye">
            <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
              ← Türkiye Atlası&apos;na Dön (Tüm İller)
            </Button>
          </Link>
          <Link href="/v2">
            <Button variant="ghost" size="sm" leftIcon={<Home className="size-4" />}>
              Ana Sayfa
            </Button>
          </Link>
        </div>

        {/* SECTION 9: BİLİMSEL KAYNAKÇA & BÖLGESEL METODOLOJİ */}
        <div id="kaynakca" className="scroll-mt-28" tabIndex={-1}>
          <V2SourcesSection
            scope="turkiye"
            regionalNote={
              <V2RichProse
                text={region.sourcesNoteTr}
                className="space-y-1.5"
                paragraphClassName="text-[11px] text-muted-foreground leading-relaxed"
              />
            }
          />
        </div>
      </main>

      <V2Footer />
    </div>
  );
}
