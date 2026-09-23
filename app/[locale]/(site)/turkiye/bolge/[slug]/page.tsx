import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2RichProse } from "@/components/v2/v2-rich-prose";
import { V2RegionLocatorMap } from "@/components/v2/v2-region-locator-map";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { V2FavoriteButton } from "@/components/v2/v2-favorite-button";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getRegionBySlug, getRegionsResilient } from "@/lib/api/regions";
import { buildMetadata } from "@/lib/seo/metadata";
import { REGION_IDENTITY } from "@/lib/theme/region-identity";
import { basinIdentityOfSeaName } from "@/lib/theme/basin-identity";
import { FaqSection } from "@/components/patterns/faq-section";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import {
  Mountain,
  Compass,
  Users,
  Maximize2,
  Waves,
  CloudSun,
  Home,
  TrendingUp,
  Boxes,
  Building2,
  Table,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Globe2,
  Droplets,
  Award,
  BarChart3,
  Landmark,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SOURCE_NOTE } from "@/components/patterns/source-note";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

/**
 * One colour per region, and it is the colour the map paints.
 *
 * Every value here now derives from that region's own `--region-*` token. It did not used to:
 * `mapFill` read the token while `badgeClass`, `gradient`, `accentColor` and `borderAccent`
 * were written in unrelated raw Tailwind hues, so this page told the reader Marmara was amber
 * and painted it blue two elements away, and Ege was teal beside an orange shape. Six of the
 * seven disagreed; İç Anadolu agreed only because yellow happened to land near yellow.
 *
 * `-tint` is a 15% wash of the fill and `-text` is the label that sits on it, both derived and
 * measured in `app/globals.css` (worst case 4.60:1 light, 4.59:1 dark). Because `-text` carries
 * its own value in `.dark`, none of these strings needs a hand-written `dark:` variant — the
 * pairs that used to be here were the symptom of binding to a hue instead of to a token.
 *
 * `badgeClass`'s surface is NOT `--card`. `Badge variant="outline"` supplies `bg-card`, but
 * tailwind-merge drops it in favour of the tint, so the badge composites onto the hero band
 * this same table's `gradient` paints — tint over tint over `--background`. That is the
 * backdrop `-text` is measured against; `app/globals.css` names it beside the figures.
 *
 * `accentColor` and `borderAccent` used to live here and are deliberately gone rather than
 * rebound: nothing read either one. The only fields any JSX reads are `gradient`,
 * `badgeClass`, `nameTr`, `mapFill` and `mapStroke`. Rebinding a dead field would have left
 * the next reader believing an accent colour ships.
 */
const REGION_THEMES: Record<
  string,
  {
    nameTr: string;
    badgeClass: string;
    gradient: string;
    mapFill: string;
    mapStroke: string;
  }
> = {
  MARMARA: {
    nameTr: "Marmara Bölgesi",
    badgeClass: REGION_IDENTITY.marmara.badge,
    gradient: REGION_IDENTITY.marmara.heroGradient,
    mapFill: REGION_IDENTITY.marmara.fillValue,
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  EGE: {
    nameTr: "Ege Bölgesi",
    badgeClass: REGION_IDENTITY.ege.badge,
    gradient: REGION_IDENTITY.ege.heroGradient,
    mapFill: REGION_IDENTITY.ege.fillValue,
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  AKDENIZ: {
    nameTr: "Akdeniz Bölgesi",
    badgeClass: REGION_IDENTITY.akdeniz.badge,
    gradient: REGION_IDENTITY.akdeniz.heroGradient,
    mapFill: REGION_IDENTITY.akdeniz.fillValue,
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  IC_ANADOLU: {
    nameTr: "İç Anadolu Bölgesi",
    badgeClass: REGION_IDENTITY["ic-anadolu"].badge,
    gradient: REGION_IDENTITY["ic-anadolu"].heroGradient,
    mapFill: REGION_IDENTITY["ic-anadolu"].fillValue,
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  KARADENIZ: {
    nameTr: "Karadeniz Bölgesi",
    badgeClass: REGION_IDENTITY.karadeniz.badge,
    gradient: REGION_IDENTITY.karadeniz.heroGradient,
    mapFill: REGION_IDENTITY.karadeniz.fillValue,
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  DOGU_ANADOLU: {
    nameTr: "Doğu Anadolu Bölgesi",
    badgeClass: REGION_IDENTITY["dogu-anadolu"].badge,
    gradient: REGION_IDENTITY["dogu-anadolu"].heroGradient,
    mapFill: REGION_IDENTITY["dogu-anadolu"].fillValue,
    mapStroke: "var(--color-ink-dark, #211c19)",
  },
  GUNEYDOGU_ANADOLU: {
    nameTr: "Güneydoğu Anadolu Bölgesi",
    badgeClass: REGION_IDENTITY["guneydogu-anadolu"].badge,
    gradient: REGION_IDENTITY["guneydogu-anadolu"].heroGradient,
    mapFill: REGION_IDENTITY["guneydogu-anadolu"].fillValue,
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
      "İstanbul Boğazı, büyük sanayi ve lojistik ağı, Türkiye'nin en yüksek nüfus yoğunluğu",
  },
  "Güney Marmara Bölümü": {
    provincesTr: "Bursa, Balıkesir, Çanakkale, Bilecik",
    highlight: "Verimli çöküntü ve delta ovaları, tarıma dayalı sanayi ve Uludağ kütlesi",
  },
  // Ege
  "Ege Bölümü (Asıl Ege)": {
    provincesTr: "İzmir, Manisa, Aydın, Muğla, Denizli",
    highlight: "Kıyıya dik uzanan horst dağları, aralarında Gediz ve Menderes graben ovaları",
  },
  "İç Batı Anadolu Bölümü": {
    provincesTr: "Afyonkarahisar, Kütahya, Uşak",
    highlight:
      "Ege ile İç Anadolu arasında bir eşik: yüksek platolar, gittikçe karasallaşan iklim, tahıl tarımı ve bol termal kaynak",
  },
  // Akdeniz
  "Adana Bölümü": {
    provincesTr: "Adana, Mersin, Hatay, Osmaniye, Kahramanmaraş",
    highlight:
      "Çukurova deltası ve verimli alüvyal ovası, büyük ölçekli tarım, narenciye ve İskenderun'daki sanayi",
  },
  "Antalya Bölümü": {
    provincesTr: "Antalya, Isparta, Burdur",
    highlight:
      "Teke ve Taşeli'nin karstik platoları, polyeler ve kanyonlar, Batı Toroslar ve kıyı turizmi",
  },
  // İç Anadolu
  "Konya Bölümü": {
    provincesTr: "Konya, Karaman, Aksaray",
    highlight:
      "Geniş kapalı havza, taban ovaları, Türkiye'nin tahıl ambarı ve Tuz Gölü güney kıyıları",
  },
  "Yukarı Sakarya Bölümü": {
    provincesTr: "Ankara, Eskişehir",
    highlight: "Başkent Ankara, yoğun sanayi ve hizmet sektörü, düz plato yüzeyleri",
  },
  "Orta Kızılırmak Bölümü": {
    provincesTr: "Kayseri, Kırşehir, Nevşehir, Yozgat, Kırıkkale, Niğde",
    highlight:
      "Erciyes ve Hasan gibi volkanik dağlar, Kapadokya'nın peri bacaları ve Kızılırmak'ın büyük kavsi",
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
    highlight:
      "Türkiye'de en çok yağış alan kıyılar, dik Kaçkar yamaçları, çay ve fındığa dayalı tarım",
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
      "Türkiye'nin en sarp ve engebeli arazisi, Cilo ve Sat dağlarındaki buzullar, derin vadiler",
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
      "Büyüklüğü 7,0 ve üzeri deprem tehlikesi",
      "Depremin Marmara Denizi'nde tetikleyebileceği tsunami",
      "Alüvyon zeminlerde sıvılaşma",
    ],
    warningNote:
      "İstanbul, Kocaeli, Sakarya ve Yalova hattı aktif fay parçalarının üzerinde. Binaları ve zemini depreme dayanıklı hâle getirmek hayati önem taşır.",
  },
  EGE: {
    faultLines: [
      "Gediz Grabeni Fay Sistemi",
      "Büyük Menderes Grabeni",
      "Küçük Menderes Fayı",
      "İzmir Fayı",
    ],
    primaryRisks: [
      "Sık aralıklarla yıkıcı depremler",
      "Graben ovalarında zemin sıvılaşması",
      "Ege kıyılarında tsunami olasılığı",
    ],
    warningNote:
      "Horst-graben yapısı yüzünden yer kabuğu sürekli gerilir. Depremlerin odağı sığ olduğu için sarsıntı geniş bir alanda şiddetli hissedilir.",
  },
  AKDENIZ: {
    faultLines: [
      "Doğu Anadolu Fayı (DAF) Hatay Uzantısı",
      "Kıbrıs Yayı Dalma-Batma Zonu",
      "Ecemiş Fayı",
    ],
    primaryRisks: [
      "Levha sınırına yakınlık ve deprem",
      "Karstik arazide çöküntü ve kaya düşmesi",
      "Kıyı kuşağında fırtına ve taşkın",
    ],
    warningNote:
      "Doğu Akdeniz'deki Hatay, Kahramanmaraş ve Osmaniye, Doğu Anadolu Fayı'nın etkisindedir; deprem tehlikesi en çok buradadır. Batıda ise karstik obruklar ve sel öne çıkar.",
  },
  IC_ANADOLU: {
    faultLines: [
      "Tuz Gölü Fay Zonu",
      "Eskişehir Fay Zonu",
      "Akşehir Fay Segmenti",
      "Ecemiş Fay Kuşağı",
    ],
    primaryRisks: [
      "Obruklar ve karstik zemin yarıkları",
      "Kuraklık ve çölleşme",
      "Yer yer orta büyüklükte depremler",
    ],
    warningNote:
      "Deprem tehlikesi kıyı bölgelerine göre düşüktür. Asıl tehlike, yeraltı suyu çekildikçe açılan obruklar ve kuraklıktır.",
  },
  KARADENIZ: {
    faultLines: [
      "Kuzey Anadolu Fayı (Güney Vadiler Boyunca)",
      "Karadeniz Sahil Tektonik Kıvrımları",
    ],
    primaryRisks: [
      "Şiddetli heyelan ve kütle hareketleri",
      "Ani sağanak, sel ve moloz taşkınları",
      "Güneydeki vadiler boyunca Kuzey Anadolu Fayı depremleri",
    ],
    warningNote:
      "Dik yamaçlar, suya doymuş killi zemin ve bol yağış yüzünden Türkiye'de en çok heyelan ve sel bu bölgede yaşanır.",
  },
  DOGU_ANADOLU: {
    faultLines: [
      "Kuzey Anadolu Fay Zonu (KAF)",
      "Doğu Anadolu Fay Zonu (DAF)",
      "Bingöl-Karlıova Tektonik Düğümü",
    ],
    primaryRisks: [
      "En güçlü depremler: büyüklüğü 7,2 ve üzeri",
      "Kışın karla kapanan yollar ve çığ",
      "Sarp vadilerde heyelan ve kaya düşmesi",
    ],
    warningNote:
      "Kuzey Anadolu ve Doğu Anadolu faylarının kesiştiği Karlıova ile çevresindeki Bingöl, Malatya, Elazığ, Erzincan ve Muş, Türkiye'de yer kabuğunun en hareketli olduğu yerdir.",
  },
  GUNEYDOGU_ANADOLU: {
    faultLines: [
      "Bitlis-Zagros Bindirme Kuşağı",
      "Doğu Anadolu Fayı Batı Segmenti (Gaziantep/Adıyaman)",
    ],
    primaryRisks: [
      "Kuzey ve batı sınırlarında yıkıcı deprem",
      "Yaz kuraklığı, aşırı sıcaklar ve toz fırtınası",
      "Fırat ve Dicle vadilerinde taşkın",
    ],
    warningNote:
      "Kuzeyde Bitlis bindirmesi, batıda Doğu Anadolu Fayı deprem tehlikesi taşır. Güneydeki düzlüklerde ise iklim krizi, aşırı sıcaklar ve toz taşınımı etkilidir.",
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
      pathname: "/turkiye/bolge/[slug]",
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
    mapFill: "var(--color-primary, #b0522e)",
    mapStroke: "var(--color-primary-dark, #7e3a1e)",
  };

  const isCoastal = region.coastalSeas.length > 0;
  const canonicalPath = `/turkiye/bolge/${region.slug}`;

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
    <>
      <V2LiveTicker />

      {/* HERO BANNER SECTION */}
      <section
        className={`relative isolate border-b border-border bg-gradient-to-b ${theme.gradient} pt-8 pb-12 overflow-hidden`}
      >
        {/* Glow backdrop, desktop only. `size-96` is 384px and `blur-3xl` spreads it further,
            so below `md` this stops being a glow in the corner and becomes a full-bleed wash
            across the whole viewport — including the badge row in the left column. Measured at
            320px it took the region badge to 4.22-4.36 light and 4.27-4.49 dark, i.e. a
            DECORATIVE `bg-primary/10` was the thing deciding whether the region label cleared
            4.5:1. Bounding the decoration is the fix; darkening all seven `--region-*-text`
            members to survive a blur would spend contrast at every width to pay for an effect
            that only exists below `md`. Bounded here, zero failures across the sweep: 4.71-5.00
            light and 4.81-5.67 dark.
            Painted interior minimum of the badge per width, both themes, ROUNDED DOWN — the
            same rule `app/globals.css` states for its own table, and it applies here for the
            same reason: 320 4.73/4.81 · 360 4.74/4.81 · 390 4.71/4.81 · 414 4.71/4.82 ·
            768 4.75/4.81 · 1024 4.78/4.83 · 1280 4.78/4.85 (light/dark) — every one at or
            above the figure `app/globals.css` records for it.
            HOW THESE WERE SAMPLED, because the first attempt got it wrong: a column strictly
            inside the badge's own padding (from `borderLeftWidth + 1` to `paddingLeft - 1`,
            inset vertically by `borderTopLeftRadius + 1`) and the WORST pixel in it, not the
            modal one. Guessing a fixed inset instead crosses into the first glyph at `px-2.5`
            and measures text on text. The sentinel that catches that is the sample's luminance
            SPREAD; a threshold of ~10 is right. Clean samples here measure 0.2-2.0, clean
            samples over a wider rectangle reach ~5.5 because the hero gradient varies across
            the sample height, and a sample that touches a glyph measures 60-200. Do not set it
            near 3: that fires on clean data at mobile widths.
            Re-measure this row, not just the token, if this glow ever moves or grows. */}
        <div className="absolute -z-10 top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none hidden md:block" />

        <PageContainer space="band">
          {/* Breadcrumb Bar */}
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Türkiye İlleri", href: "/turkiye", path: "/turkiye" },
              { label: region.nameTr, path: canonicalPath },
            ]}
            locale={locale}
            surface="trOnly"
          />

          {/* Main Title & Action Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <PageHero
              tier="detail"
              heading={region.nameTr}
              lede={region.introTr}
              badges={
                <>
                  <Badge variant="outline" className={theme.badgeClass}>
                    {theme.nameTr}
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Building2 className="size-3 mr-1" /> {region.provinceCount} İl
                  </Badge>
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    <Boxes className="size-3 mr-1" /> {region.subregionCount} Bölüm
                  </Badge>
                  {isCoastal ? (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Waves className="size-3" /> {region.coastalSeas.length} Denize Kıyısı Var
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Denize Kıyısı Yok
                    </Badge>
                  )}
                </>
              }
            />

            {/* Top Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <V2FavoriteButton target={{ kind: "region", slug: region.slug }} />
              <Link href="/turkiye">
                <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
                  Tüm İller
                </Button>
              </Link>
            </div>
          </div>

          {/* 4 BIG KEY STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {/* 1. Nüfus */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Nüfus</span>
                <Users className="size-4 text-primary" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {format.number(region.population)}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Nüfus Payı:</span>
                <span className="font-mono font-semibold text-foreground">
                  %{region.populationSharePercent.toFixed(2)}
                </span>
              </div>
            </Card>

            {/* 2. Yüzölçümü */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Yüzölçümü</span>
                <Maximize2 className="size-4" />
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
            </Card>

            {/* 3. Nüfus Yoğunluğu */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Nüfus Yoğunluğu</span>
                <Mountain className="size-4" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {region.populationDensity} kişi/km²
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Türkiye Ortalaması:</span>
                <span className="font-mono font-semibold text-foreground">110 kişi/km²</span>
              </div>
            </Card>

            {/* 4. GSYH Ağırlığı */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">GSYH Payı (2024)</span>
                <TrendingUp className="size-4" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {region.gdpShareApproxPercent !== null ? `~%${region.gdpShareApproxPercent}` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Kaynak:</span>
                <span className="font-semibold text-foreground">TÜİK İl GSYH</span>
              </div>
            </Card>
          </div>
        </PageContainer>
      </section>

      {/* QUICKNAV / JUMP NAVIGATION BAR (SCROLLBAR HIDDEN) */}
      <nav
        aria-label="Bu sayfadaki bölümler"
        className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border py-2.5 overflow-x-auto scrollbar-none"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
            <Layers className="size-3.5" /> Bu sayfada:
          </span>
          <a
            href="#konum-ve-harita"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Konum
          </a>
          <a
            href="#fiziki-cografya"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Yeryüzü ve İklim
          </a>
          <a
            href="#sosyo-ekonomi"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Nüfus ve Ekonomi
          </a>
          <a
            href="#bolumler"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Coğrafi Bölümler
          </a>
          <a
            href="#iller"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            İller
          </a>
          <a
            href="#afet"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Deprem ve Afetler
          </a>
          <a
            href="#kiyaslama"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            Bölgeleri Karşılaştır
          </a>
          {/* Gated on BOTH conditions the section is, because the section now has two. `FaqSection`
              returns null for an empty `items`, and the block is TR-only until T-040 — either way
              there is no `#sss` on the page and this pill would scroll to nothing. The sibling
              `turkiye/bolge` page gates its own pill for the locale reason alone; this one needs
              the data reason too, so it carries both. */}
          {locale === "tr" && (region.faqs?.length ?? 0) > 0 && (
            <a
              href="#sss"
              className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
            >
              SSS
            </a>
          )}
        </div>
      </nav>

      {/* BODY CONTENT CONTAINER — empty since T-046 filled it in. T-032 (`d2039b6`) de-nested
          the `<main>` landmark into `(site)/layout.tsx` and deleted the
          `<main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">` that wrapped
          everything below, without replacing the width, the padding or the rhythm: only this
          marker survived, and the body rendered edge-to-edge at viewport width with no gutter on
          all seven region routes. `default` is 56px between sections where the deleted wrapper
          was 48px — the rhythm union is closed on purpose and has no 48px member.

          It opens AFTER the sticky section-index `<nav>` above, not before it. That bar is
          full-bleed and carries its own PageContainer-aligned row inside itself; wrapping it in
          a padded container would change what it sticks to and would make its entry in
          `BODY_WRAPPER_EXEMPTIONS` say something false about why it is exempt. */}
      <PageContainer space="default">
        {/* SECTION 1: KONUM, SINIRLAR & HARİTA VİTRİNİ (12-COLUMN ASYMMETRIC GRID) */}
        <section id="konum-ve-harita" className="scroll-mt-28" tabIndex={-1}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: Prose & Boundaries Card */}
            <div className="lg:col-span-7 space-y-6">
              <Card variant="panel" space="5">
                <div className="space-y-2 border-b border-border/70 pb-4">
                  <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                    <Compass className="size-6 text-primary shrink-0" />
                    <span>Konum ve Sınırlar</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Bölge Türkiye&apos;nin neresinde, hangi bölgelerle ve ülkelerle komşu, hangi
                    denizlere kıyısı var.
                  </p>
                </div>

                <V2RichProse text={region.locationAndBordersTr} />

                {/* Regional Bordering & Context Badges */}
                <div className="pt-4 border-t border-border space-y-4">
                  {/* Komşu Bölgeler */}
                  {region.neighborRegions?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Komşu bölgeler:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {region.neighborRegions.map((nbName) => {
                          const targetSlug = REGION_NAME_TO_SLUG[nbName];
                          return targetSlug ? (
                            <Link
                              key={nbName}
                              href={{
                                pathname: "/turkiye/bolge/[slug]",
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
                        Komşu ülkeler:
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
                        {/* ONE CHIP PER SEA, EACH IN ITS OWN SEA'S COLOUR. These were all one
                            cyan while `v2-marine-basin-cards` painted Marmara amber and Ege
                            teal one click away: four values, one colour. `coastalSeas` is free
                            text from the contract, so the crossing goes through
                            `basinIdentityOfSeaName`, which returns null rather than guessing —
                            a sea this product has no identity for renders neutral, because a
                            wrong colour on a data chip is worse than no colour. */}
                        {region.coastalSeas.map((sea) => {
                          const basin = basinIdentityOfSeaName(sea);
                          return (
                            <Badge
                              key={sea}
                              variant="outline"
                              className={`${basin?.chipSoft ?? "bg-muted text-foreground border-border"} text-xs py-1.5 px-3 flex items-center gap-1.5`}
                            >
                              <Waves className="size-3.5" />
                              <span>{sea}</span>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Denizler:
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-muted/60 text-muted-foreground text-xs py-1 px-2.5"
                      >
                        Denize kıyısı yok
                      </Badge>
                    </div>
                  )}
                </div>
              </Card>
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
                  <h3 className="font-heading font-bold text-sm text-foreground">Kısa Bilgiler</h3>
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
                      {isCoastal ? region.coastalSeas.join(", ") : "Yok"}
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Bölümler:</span>
                    <a
                      href="#bolumler"
                      className="font-semibold text-primary hover:underline text-right"
                    >
                      {region.subregions?.length > 0 && region.subregions.length <= 2
                        ? `${region.subregionCount} bölüm (${region.subregions
                            .map((s) => s.replace(" Bölümü", ""))
                            .join(", ")})`
                        : `${region.subregionCount} bölüm`}
                    </a>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-muted-foreground">İl Sayısı:</span>
                    <span className="font-semibold text-foreground">{region.provinceCount} İl</span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-muted-foreground">İlçe Sayısı:</span>
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
          <Card variant="panel" space="6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Yeryüzü Şekilleri, İklim ve Sular
              </h2>
            </div>

            {/* Highest Point Highlight Banner (if available) */}
            {region.highestPointName && (
              <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/80 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Bölgenin En Yüksek Zirvesi
                  </span>
                  <div className="font-heading font-extrabold text-lg sm:text-xl text-foreground flex items-center gap-2">
                    <Mountain className="size-5 shrink-0" />
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
                    <span className="font-mono font-extrabold text-2xl text-foreground">
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
                    <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                      <Mountain className="size-5 shrink-0" />
                      <span>Dağlar ve Ovalar</span>
                    </h3>
                  </div>
                  <V2RichProse text={region.landformsTr} />
                </div>
              </div>

              {/* Pillar 2: Klimatoloji & Vejetasyon */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                      <CloudSun className="size-5 shrink-0" />
                      <span>İklim ve Bitki Örtüsü</span>
                    </h3>
                  </div>
                  <V2RichProse text={region.climateAndVegetationTr} />
                </div>
              </div>

              {/* Pillar 3: Hidrografya & Su Ağı */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                      <Droplets className="size-5 shrink-0" />
                      <span>Akarsular ve Göller</span>
                    </h3>
                  </div>
                  <V2RichProse text={region.hydrographyTr} />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 3: SOSYO-EKONOMİK DİNAMİKLER */}
        <section id="sosyo-ekonomi" className="scroll-mt-28" tabIndex={-1}>
          <Card variant="panel" space="6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <TrendingUp className="size-6 text-primary shrink-0" />
                <span>Nüfus ve Ekonomi</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                İnsanların nerede toplandığı, göçün yönü, bölgenin ne ürettiği ve Türkiye
                ekonomisindeki payı.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* Left Column: Population & Settlement */}
              <div className="p-5 sm:p-6 rounded-2xl bg-muted/30 border border-border/80 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-2 border-b border-border/60 pb-3">
                    <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                      <Users className="size-5 text-primary shrink-0" />
                      <span>Nüfus, Yerleşme ve Göç</span>
                    </h3>
                  </div>

                  {/* Demographic Metrics Chips */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-card border border-border/80 space-y-1">
                      <span className="text-[11px] text-muted-foreground block">Nüfus Payı</span>
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
                    <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="size-5 shrink-0" />
                      <span>Sanayi ve Tarım</span>
                    </h3>
                  </div>

                  {/* GDP Contribution Callout */}
                  {region.gdpShareApproxPercent !== null && (
                    <div className="p-4 rounded-2xl bg-card border border-border/80 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-muted-foreground block">
                          Türkiye GSYH&apos;sindeki Yaklaşık Payı
                        </span>
                        <span className="font-heading font-extrabold text-2xl text-foreground">
                          ~%{region.gdpShareApproxPercent}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs bg-background/80">
                        Kaynak: TÜİK İl GSYH
                      </Badge>
                    </div>
                  )}

                  <V2RichProse text={region.economyTr} />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 4: 1941 BİRİNCİ COĞRAFYA KONGRESİ BÖLÜMLERİ */}
        <section id="bolumler" className="scroll-mt-28" tabIndex={-1}>
          <Card variant="panel" space="6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Boxes className="size-6 text-primary shrink-0" />
                <span>Bölgenin {region.subregionCount} Bölümü</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Maarif Vekilliğinin 1941&apos;de topladığı Birinci Coğrafya Kongresi, bölgeyi yer
                şekillerine bakarak bu bölümlere ayırdı.
              </p>
            </div>

            {/* Subregion Explanatory Prose */}
            <V2RichProse text={region.subregionsTr} />

            {/* Visual Subregions Card Deck (Dynamic Grid with detailed cards) */}
            {region.subregions?.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-muted-foreground block mb-3">
                  Bölümlerin öne çıkan özellikleri:
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
                              "Yer şekli ve iklim farklarına göre ayrılmış bir bölüm."}
                          </p>
                        </div>

                        {detail?.provincesTr && (
                          <div className="pt-2.5 border-t border-border/60 text-[11px]">
                            <span className="text-muted-foreground block font-medium">İller:</span>
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
          </Card>
        </section>

        {/* SECTION 5: BÖLGEDEKİ İLLER REHBERİ & CANLI VERİ TABLOSU */}
        <section id="iller" className="scroll-mt-28" tabIndex={-1}>
          <Card variant="panel" space="6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Building2 className="size-6 text-primary shrink-0" />
                <span>Bölgedeki {region.provinceCount} İl</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Her ilin nüfusu, yüzölçümü ve nüfus yoğunluğu. Nüfus 31 Aralık 2025 ADNKS&apos;den,
                yüzölçümü HGM kayıtlarından.
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
                    <Maximize2 className="size-3.5" />
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
                  <BarChart3 className="size-3.5" />
                </div>
                <div className="font-heading font-bold text-base text-foreground">
                  {format.number(avgProvincePop)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {region.provinceCount} ilin ortalaması
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
                      Sayfası
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
                              pathname: "/turkiye/[slug]",
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
                              pathname: "/turkiye/[slug]",
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
          </Card>
        </section>

        {/* SECTION 6: DOĞAL AFET VE DEPREM RİSKİ */}
        <section id="afet" className="scroll-mt-28" tabIndex={-1}>
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-destructive/20 pb-5">
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <ShieldAlert className="size-6 text-destructive-strong shrink-0" />
                <span>Deprem ve Doğal Afetler</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Bölgeden geçen faylar, geçmişteki büyük depremler ve heyelan, sel, kuraklık gibi
                diğer tehlikeler.
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
                  <div className="p-5 rounded-2xl bg-card border border-destructive/20 shadow-xs space-y-4">
                    <div className="flex items-center">
                      <span className="font-heading font-bold text-sm text-foreground flex items-center gap-1.5">
                        <ShieldAlert className="size-4 text-destructive-strong" />
                        <span>Faylar ve Başlıca Tehlikeler</span>
                      </span>
                    </div>

                    {/* Active Fault Lines */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground block">
                        Başlıca faylar:
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
                        Öne çıkan tehlikeler:
                      </span>
                      <div className="space-y-1">
                        {disasterProfile.primaryRisks.map((pr) => (
                          <div
                            key={pr}
                            className="text-xs text-foreground/90 flex items-center gap-2 p-1.5 rounded-lg bg-muted/40"
                          >
                            <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                            <span>{pr}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warning Note */}
                    <div className="pt-2 border-t border-border/80 text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">Not: </span>
                      {disasterProfile.warningNote}
                    </div>

                    {/* Emergency Notice */}
                    <div className="p-2.5 rounded-xl bg-muted/60 border border-border text-[10px] text-muted-foreground flex items-center justify-end">
                      <span className="font-semibold text-destructive-strong">Acil: 112</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: 7 BÖLGE KARŞILAŞTIRMASI */}
        <section id="kiyaslama" className="scroll-mt-28" tabIndex={-1}>
          <Card variant="panel" space="6">
            {/* Header INSIDE the Card */}
            <div className="space-y-2 border-b border-border/70 pb-5">
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <Table className="size-6 text-primary shrink-0" />
                <span>Yedi Bölge Yan Yana</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Bu bölgenin satırı vurgulu. Başka bir bölgenin adına tıklarsan onun sayfasına
                geçersin.
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
                                Bu sayfa
                              </Badge>
                            </span>
                          ) : (
                            <Link
                              href={{
                                pathname: "/turkiye/bolge/[slug]",
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
              * Nüfus: TÜİK ADNKS, 31 Aralık 2025. Yüzölçümü: Harita Genel Müdürlüğü (HGM) il
              toplamları; HGM bu değerleri 2014&apos;te üretilen 1:1.000.000 ölçekli haritadan
              hesaplamıştır ve resmî nitelik taşımaz. Paylar, 86.092.168 kişilik Türkiye nüfusuna ve
              81 ilin toplamı olan 780.040 km²&apos;ye göre hesaplandı.
            </p>
          </Card>
        </section>

        {/* SECTION 8: SIKÇA SORULAN SORULAR. The `region.faqs?.length > 0` guard that used to be
            written twice — once here and once around the `<JsonLd>` a thousand lines above — is
            gone: `FaqSection` returns null for an empty `items`, which is the same decision made
            once instead of in two spellings (and one of those spellings was `?.length` on a field
            that is not optional). `?? []` because the API type allows the field to be absent;
            `"trOnly"` is this page's own surface constant, the one `generateMetadata` passes to
            `buildMetadata`.

            TR-ONLY UNTIL T-040 (owner, 2026-09-19). `region.faqs` is Turkish prose from the API
            with no English counterpart, so the EN twin was rendering Turkish questions under
            English chrome. `structuredData="trOnly"` already withheld the FAQPage schema there —
            that was never the gap; the MARKUP was. The gate wraps the whole component, so both
            halves still move together: no component, no schema. Same shape as `turkiye/bolge` and
            `/deniz`, which carried it already. */}
        {locale === "tr" && (
          <FaqSection
            heading={`${region.nameTr} Hakkında Sıkça Sorulan Sorular`}
            lede="Yer şekilleri, nüfus, iller ve iklim üzerine kısa cevaplar."
            locale={locale}
            items={region.faqs ?? []}
            structuredData="trOnly"
          />
        )}

        {/* How the region figures are built. Same for all seven regions, so it lives here rather
            than in the api's per-region `sourcesNoteTr` (identical in every row). TR only: the
            text has no English counterpart yet. */}
        {locale === "tr" && (
          <p className={`${SOURCE_NOTE} max-w-[78ch]`}>
            <span className="font-semibold text-foreground">Bu sayılar nasıl hesaplandı: </span>
            Nüfus TÜİK&apos;in Adrese Dayalı Nüfus Kayıt Sistemi&apos;nden, yüzölçümü Harita Genel
            Müdürlüğü&apos;nün il yüzölçümlerinden alındı. TÜİK bölge istatistiklerini İBBS Düzey-1
            sınıflamasındaki 12 bölge için yayımlar; buradaki bölge toplamları ise 7 coğrafi
            bölgedeki illerin değerleri toplanarak hesaplandı. Bölge ve bölüm sınırları, 6-21
            Haziran 1941&apos;de toplanan Birinci Türk Coğrafya Kongresi&apos;nin kararlarına
            dayanır.
          </p>
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
