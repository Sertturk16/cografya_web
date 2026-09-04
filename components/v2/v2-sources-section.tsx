import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Database, ShieldCheck, BookOpen, ExternalLink } from "lucide-react";

export type V2PageScope =
  "home" | "turkiye" | "dunya" | "deniz" | "oyun" | "deprem" | "araclar" | "kitaplar" | "general";

interface SourceItem {
  id: string;
  icon: string;
  title: string;
  license: string;
  badgeType?: "primary" | "secondary" | "outline";
  category?: "official" | "academic";
  description: string;
  legalQuote?: string;
  sourceUrl: string;
  doi?: string;
}

const SOURCES_BY_PAGE: Record<V2PageScope, SourceItem[]> = {
  home: [
    {
      id: "tuik-osm",
      icon: "🗺️",
      title: "TÜİK & OpenStreetMap",
      license: "ODbL / TÜİK ADNKS",
      description: "Türkiye 81 il demografisi, nüfus sayımları ve idari sınır vektörleri.",
      legalQuote: "© OpenStreetMap katkıcıları, Open Database License (ODbL)",
      sourceUrl: "tuik.gov.tr • openstreetmap.org",
    },
    {
      id: "natural-earth",
      icon: "🌍",
      title: "Natural Earth Data 1:50m",
      license: "Kamu Malı (Public Domain)",
      description:
        "199 dünya ülkesi sınır geometrileri, başkent koordinatları ve kıta jeomorfolojisi.",
      legalQuote: "Natural Earth Vector & Raster Map Data 2026",
      sourceUrl: "naturalearthdata.com",
    },
    {
      id: "copernicus-marine",
      icon: "🌊",
      title: "Copernicus Marine Service (CMEMS)",
      license: "E.U. Copernicus",
      description:
        "30 kıyı istasyonunda saatlik deniz suyu sıcaklığı (SST), dalga boyu ve akıntı telemetrisi.",
      legalQuote: "Generated using E.U. Copernicus Marine Service Information 2026",
      sourceUrl: "marine.copernicus.eu",
    },
    {
      id: "era5-land",
      icon: "🌡️",
      title: "Copernicus ERA5-Land (ECMWF)",
      license: "CC-BY-4.0",
      description:
        "1991–2020 dönemi 12 aylık sıcaklık ve yağış normalleri reanaliz iklim modelleri.",
      legalQuote: "Generated using Copernicus Climate Change Service information 2026",
      sourceUrl: "cds.climate.copernicus.eu",
      doi: "10.24381/cds.68d2bb30",
    },
    {
      id: "afad",
      icon: "⚡",
      title: "AFAD Deprem Dairesi Başkanlığı",
      license: "T.C. Resmî",
      description:
        "Türkiye ve çevre havzadaki eşzamanlı deprem sarsıntıları ve merkez üssü derinlik verileri.",
      sourceUrl: "deprem.afad.gov.tr",
    },
    {
      id: "cams-pm25",
      icon: "💨",
      title: "Copernicus CAMS & ACAG SatPM2.5",
      license: "Açık Veri",
      description:
        "Uydu tabanlı yıllık ortalama yüzey PM2.5 hava kirliliği konsantrasyonu ve hava kalitesi.",
      legalQuote: "Contains modified Copernicus Atmosphere Monitoring Service information 2026",
      sourceUrl: "ads.atmosphere.copernicus.eu",
    },
  ],
  turkiye: [
    {
      id: "tuik",
      icon: "📊",
      title: "TÜİK Adrese Dayalı Nüfus Kayıt Sistemi (ADNKS)",
      license: "Resmî İstatistik",
      description: "81 il ve 973 ilçenin güncel nüfus, yaş piramitleri ve demografik göstergeleri.",
      sourceUrl: "tuik.gov.tr",
    },
    {
      id: "osm",
      icon: "🗺️",
      title: "OpenStreetMap İl Sınır Vektörleri",
      license: "ODbL 1.0",
      description: "81 il mülki idare sınırları ve kıyı çizgisi poligonları.",
      legalQuote: "© OpenStreetMap katkıcıları, Open Database License (ODbL)",
      sourceUrl: "openstreetmap.org/copyright",
    },
    {
      id: "mgm",
      icon: "🌦️",
      title: "Meteoroloji Genel Müdürlüğü (MGM)",
      license: "T.C. Resmî",
      description:
        "İl merkezi rakımları, Köppen iklim sınıflandırması ve coğrafi koordinat katalogları.",
      sourceUrl: "mgm.gov.tr",
    },
    {
      id: "hgm",
      icon: "🧭",
      title: "Harita Genel Müdürlüğü (HGM)",
      license: "Ulusal Kartografya",
      description:
        "Türkiye fiziki coğrafyası, dağ zirveleri, akarsu havzaları ve göl yüzölçümleri.",
      sourceUrl: "harita.gov.tr",
    },
    {
      id: "era5",
      icon: "🌡️",
      title: "Copernicus ERA5-Land Reanalizi (ECMWF)",
      license: "CC-BY-4.0",
      description:
        "1991–2020 referans dönemi aylık sıcaklık ve yağış normalleri. Yaklaşık 0,1° enlem-boylam ızgarası reanaliz modelinden il merkezi hücresi verileri.",
      legalQuote:
        "Generated using Copernicus Climate Change Service information 2026. Neither the European Commission nor ECMWF is responsible for any use that may be made of the Copernicus information or data it contains.",
      sourceUrl: "cds.climate.copernicus.eu",
      doi: "10.24381/cds.68d2bb30",
    },
    {
      id: "acag-pm25",
      icon: "💨",
      title: "ACAG SatPM2.5 (Washington University in St. Louis)",
      license: "CC-BY-4.0",
      category: "academic",
      description:
        "1998–2024 dönemi ~1 km (0,01°) çözünürlüklü uydu tabanlı yıllık yüzey PM2.5 hava kirliliği konsantrasyonu serisi.",
      legalQuote:
        "Note that these estimates are primarily intended to aid in large-scale studies. Annual and coarse-resolution averages correspond to a simple mean of within-grid values. Gridded datasets are provided to allow users to agglomerate data as best meets their particular needs. High-resolution (0.01° × 0.01°) datasets are gridded at the finest resolution of the information sources that were incorporated, but are unlikely to fully resolve PM2.5 gradients at the gridded resolution due to the influence of information sources at coarser resolution.",
      sourceUrl: "sites.wustl.edu/acag/datasets/surface-pm2-5",
      doi: "10.1021/acsestair.3c00054",
    },
    {
      id: "jrc",
      icon: "💧",
      title: "EC JRC Global Surface Water",
      license: "EC JRC / Google",
      description: "Türkiye doğal gölleri, baraj gölleri ve mevsimlik sulak alan hidrolojisi.",
      sourceUrl: "global-surface-water.appspot.com",
    },
    {
      id: "cografya-kongresi",
      icon: "⛰️",
      title: "I. Türk Coğrafya Kongresi (1941)",
      license: "Resmî Coğrafi Tasnif",
      category: "academic",
      description:
        "Türkiye'nin 7 Coğrafi Bölgesi ve 21 Coğrafi Bölümü resmî sınır ve morfolojik taksonomisi.",
      sourceUrl: "cografya.org.tr • Türk Coğrafya Kurumu",
    },
  ],
  dunya: [
    {
      id: "natural-earth",
      icon: "🌍",
      title: "Natural Earth Vector Data (1:50m)",
      license: "Kamu Malı (Public Domain)",
      description: "199 ülke ve özerk bölgenin sınır vektörleri ve başkent konumları.",
      sourceUrl: "naturalearthdata.com",
    },
    {
      id: "un-data",
      icon: "🏛️",
      title: "Birleşmiş Milletler (UN) & Dünya Bankası",
      license: "Açık Veri",
      description: "Ülke nüfusları, kıta kodlamaları ve resmî diller.",
      sourceUrl: "un.org • data.worldbank.org",
    },
    {
      id: "cia-factbook",
      icon: "📚",
      title: "CIA World Factbook & ISO 3166",
      license: "Kamu Malı",
      description: "Ülke ISO alfa-2/alfa-3 kodları, başkentler ve coğrafi koordinatlar.",
      sourceUrl: "cia.gov/the-world-factbook",
    },
    {
      id: "usgs-nasa",
      icon: "🛰️",
      title: "USGS & NASA Earth Observatory",
      license: "Kamu Malı (US Gov)",
      description:
        "Küresel kara alanı (148.9M km²), kıta jeomorfolojisi ve yeryüzü topografyası ekstremleri.",
      sourceUrl: "earthobservatory.nasa.gov • usgs.gov",
    },
    {
      id: "iho-gebco",
      icon: "🌊",
      title: "IHO GEBCO (General Bathymetric Chart of the Oceans)",
      license: "Açık Veri",
      description: "Mariana Çukuru, okyanus tabanı batimetrisi ve derinlik ölçümleri.",
      sourceUrl: "gebco.net • iho.int",
    },
  ],
  deniz: [
    {
      id: "cmems",
      icon: "🌊",
      title: "Copernicus Marine Service (CMEMS)",
      license: "E.U. Copernicus (CC BY 4.0)",
      description:
        "Karadeniz, Marmara, Ege ve Akdeniz'in 30 kıyı noktasında saatlik yüzey deniz suyu sıcaklığı (SST) ve dalga boyu modelleri.",
      legalQuote: "Generated using E.U. Copernicus Marine Service Information 2026",
      sourceUrl: "marine.copernicus.eu",
    },
    {
      id: "ecmwf-marine",
      icon: "🌀",
      title: "ECMWF Open Data Oşinografi & Rüzgâr",
      license: "CC BY 4.0",
      description:
        "10 metre deniz yüzeyi rüzgâr hız vektörleri, rüzgâr dalgası ve açık deniz dalga yön simülasyonları.",
      legalQuote: "Generated using ECMWF Open Data information 2026",
      sourceUrl: "ecmwf.int",
    },
    {
      id: "hgm-tuik-coastal",
      icon: "🗺️",
      title: "Harita Genel Müdürlüğü (HGM) & TÜİK",
      license: "Ulusal Kartografya",
      description:
        "Türkiye toplam 8.333 km kıyı uzunluğu (Karadeniz: 1.701 km, Marmara: 1.441 km, Ege: 3.484 km, Akdeniz: 1.707 km) ve ada sınırları.",
      sourceUrl: "harita.gov.tr • tuik.gov.tr",
    },
    {
      id: "shodb",
      icon: "⚓",
      title: "Seyir, Hidrografi ve Oşinografi Dairesi (SHOD)",
      license: "T.C. Deniz Kuvvetleri",
      category: "academic",
      description:
        "Türkiye denizleri derinlik batimetrisi, İstanbul ve Çanakkale Boğazları çift tabakalı akıntı rejimleri ve seyir güvenliği.",
      sourceUrl: "shodb.gov.tr",
    },
    {
      id: "metu-ims",
      icon: "🏛️",
      title: "ODTÜ Deniz Bilimleri Enstitüsü (IMS-METU)",
      license: "Akademik Araştırma",
      category: "academic",
      description:
        "Marmara ve Akdeniz su kütlesi tabakalaşması, biyojeokimyasal parametreler, oksijen ve tuzluluk profilleri.",
      sourceUrl: "ims.metu.edu.tr",
    },
    {
      id: "meb-erinc",
      icon: "🧭",
      title: "MEB Coğrafya & Sırrı Erinç Jeomorfolojisi",
      license: "Akademik Kaynakça",
      category: "academic",
      description:
        "Türkiye kıyı tipleri (Boyuna, Enine, Ria, Dalmaçya, Limanlı, Kalanklı), falezler, lagünler ve kıyı dinamikleri.",
      sourceUrl: "mufredat.meb.gov.tr",
    },
  ],
  oyun: [
    {
      id: "meb-talim",
      icon: "🎓",
      title: "MEB Coğrafya Dersi Öğretim Programı",
      license: "MEB / TTKB",
      category: "academic",
      description:
        "9-12. sınıf coğrafya kazanımları, harita becerileri ve mekânsal algılama standartları.",
      sourceUrl: "mufredat.meb.gov.tr",
    },
    {
      id: "osm-game",
      icon: "🗺️",
      title: "OpenStreetMap İl Vektör Geometrisi",
      license: "ODbL 1.0",
      description: "Dilsiz harita sınav motoru için 81 ilin doğrulanmış poligon sınırları.",
      sourceUrl: "openstreetmap.org",
    },
    {
      id: "cografya-game",
      icon: "🏆",
      title: "Coğrafya Gurmesi Soru ve Sınav Motoru",
      license: "Telif Hakkı Saklıdır",
      category: "academic",
      description: "Özgün soru algoritmaları, zorluk derecelendirmesi ve seri takip sistemi.",
      sourceUrl: "cografya.app/v2/oyun",
    },
  ],
  deprem: [
    {
      id: "afad-deprem",
      icon: "⚡",
      title: "T.C. İçişleri Bakanlığı AFAD (TDVMS)",
      license: "T.C. Resmî Açık Veri",
      description:
        "Türkiye Deprem Veri Merkezi Sistemi (TDVMS) üzerinden anlık deprem merkez üssü, odak derinliği ve büyüklük (ML/Mw) kayıtları.",
      legalQuote: "AFAD TDVMS Yönetmeliği, RG 28.08.2015/29459, m.9/4",
      sourceUrl: "deprem.afad.gov.tr",
    },
    {
      id: "afad-disclaimer",
      icon: "🛡️",
      title: "Resmî Sismik Uyarı & Yasal Bildirim",
      license: "AFAD Yasal Bildirim",
      description:
        "Bu sayfada sunulan veriler AFAD'ın yayımladığı gerçekleşmiş deprem kayıtlarıdır. Erken uyarı sistemi değildir ve gelecek depremler hakkında bilgi vermez.",
      sourceUrl: "afad.gov.tr",
    },
  ],
  araclar: [
    {
      id: "wgs84",
      icon: "🌐",
      title: "WGS84 (EPSG:4326) Referans Elipsoidi",
      license: "NGA / DoD Standard",
      description: "Küresel konum belirleme ve GPS koordinat sisteminin jeodezik matematik modeli.",
      sourceUrl: "epsg.io/4326",
    },
    {
      id: "haversine-geodesy",
      icon: "📐",
      title: "Jeodezik Büyük Daire & L'Huilier Algoritması",
      license: "Açık Matematik",
      category: "academic",
      description:
        "Küresel yüzeyde en kısa mesafe ve küresel açı fazlalığı (Spherical Excess) ile alan hesaplama.",
      sourceUrl: "cografya.app/v2/araclar",
    },
    {
      id: "utm-projection",
      icon: "🗺️",
      title: "UTM (Universal Transverse Mercator) Projeksiyonu",
      license: "USGS / EPSG",
      description: "Türkiye 35-38. boylam zonları düzlemsel Gauss-Krüger koordinat dönüşümleri.",
      sourceUrl: "epsg.io",
    },
  ],
  kitaplar: [
    {
      id: "cografya-gurmesi",
      icon: "📖",
      title: "Coğrafya Gurmesi Yayınları",
      license: "Telif Hakları Saklıdır",
      category: "academic",
      description:
        "AYT Coğrafya Konu Özetli Branş Denemeleri (Murat Karagöz, Murat Çakır). Soru metinleri ve video çözümleri yayıncı kuruluşa aittir.",
      legalQuote:
        "Video çözümler Coğrafya Gurmesi kanalına, kitap Coğrafya Gurmesi Yayınları'na aittir.",
      sourceUrl: "cografyagurmesi.com • youtube.com/@cografyagurmesi",
    },
    {
      id: "youtube-api",
      icon: "▶️",
      title: "YouTube Player API & Google Developers",
      license: "YouTube Terms of Service",
      description:
        "Video çözümler YouTube IFrame Player API üzerinden oynatılmaktadır. YouTube ve YouTube logosu Google LLC tescilli markasıdır.",
      legalQuote: "YouTube API Services Developer Policies (III.E.4 Branding Guidelines)",
      sourceUrl: "developers.google.com/youtube",
    },
    {
      id: "meb-mufredat",
      icon: "🎓",
      title: "MEB & ÖSYM Coğrafya Müfredatı",
      license: "Resmî Eğitim Standardı",
      category: "academic",
      description:
        "Milli Eğitim Bakanlığı 9-12. sınıf Coğrafya dersi öğretim programı ve ÖSYM AYT/TYT Coğrafya kazanım havuzu.",
      sourceUrl: "mufredat.meb.gov.tr • osym.gov.tr",
    },
  ],
  general: [
    {
      id: "tuik",
      icon: "🗺️",
      title: "TÜİK & OpenStreetMap",
      license: "ODbL / TÜİK",
      description: "Türkiye demografik verileri ve idari sınır vektörleri.",
      sourceUrl: "tuik.gov.tr • openstreetmap.org",
    },
    {
      id: "copernicus",
      icon: "🌡️",
      title: "Copernicus ERA5 & Marine",
      license: "E.U. Copernicus",
      description: "Sıcaklık, iklim normalleri ve canlı deniz telemetrisi modelleri.",
      sourceUrl: "copernicus.eu",
    },
    {
      id: "afad",
      icon: "⚡",
      title: "AFAD Deprem Dairesi Başkanlığı",
      license: "T.C. Resmî",
      description: "Sismik deprem gözlemleri ve odak derinliği verileri.",
      sourceUrl: "deprem.afad.gov.tr",
    },
  ],
};

interface V2SourcesSectionProps {
  scope?: V2PageScope;
  className?: string;
}

export function V2SourcesSection({ scope = "home", className = "" }: V2SourcesSectionProps) {
  const allSources = SOURCES_BY_PAGE[scope] || SOURCES_BY_PAGE.home;
  const officialSources = allSources.filter((s) => s.category !== "academic");
  const academicSources = allSources.filter((s) => s.category === "academic");

  const renderCard = (src: SourceItem) => {
    const isExternal =
      src.sourceUrl.includes(".gov.tr") ||
      src.sourceUrl.includes(".edu.tr") ||
      src.sourceUrl.includes(".org") ||
      src.sourceUrl.includes(".com") ||
      src.sourceUrl.includes(".eu");

    return (
      <div
        key={src.id}
        className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-2 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-2xs"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-foreground flex items-center gap-1.5 truncate">
              <span>{src.icon}</span>
              <span className="truncate">{src.title}</span>
            </span>
            <Badge variant="outline" className="text-[10px] py-0 font-mono shrink-0">
              {src.license}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{src.description}</p>
          {src.legalQuote && (
            <div className="p-2 rounded-xl bg-card border border-border/40 text-[10px] text-muted-foreground font-mono leading-tight">
              &ldquo;{src.legalQuote}&rdquo;
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate flex items-center gap-1">
            <span>Kaynak:</span>
            {isExternal ? (
              <span className="font-mono text-foreground/80 flex items-center gap-0.5">
                {src.sourceUrl}
                <ExternalLink className="size-2.5 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">(Harici referans kaynağı)</span>
              </span>
            ) : (
              <span className="font-mono text-foreground/80">{src.sourceUrl}</span>
            )}
          </span>
          {src.doi && <span className="font-mono text-primary shrink-0">DOI: {src.doi}</span>}
        </div>
      </div>
    );
  };

  return (
    <section
      aria-labelledby="v2-sources-heading"
      className={`rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-lg space-y-8 ${className}`}
    >
      <div className="space-y-1 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            Akademik &amp; Bilimsel Veri Kaynakçası
          </span>
        </div>
        <h3
          id="v2-sources-heading"
          className="font-heading text-xl sm:text-2xl font-bold text-foreground"
        >
          Bu Sayfada Kullanılan Veri Setleri &amp; Bilimsel Künye
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Bu sayfada kullanılan resmî kamu verileri, uluslararası bilimsel reanaliz modelleri ve
          pedagojik öğretim kaynakları bağımsız kategoriler halinde sunulmuştur.
        </p>
      </div>

      {/* Official Data Section */}
      {officialSources.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              size="sm"
              className="bg-primary/10 text-primary border-primary/30 shrink-0 flex items-center gap-1 font-semibold"
            >
              <ShieldCheck className="size-3.5" /> Doğrulanmış Resmî Veri
            </Badge>
            <span className="text-xs text-muted-foreground">
              Resmî kurumlar ve doğrulanmış açık veri sağlayıcıları
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {officialSources.map((src) => renderCard(src))}
          </div>
        </div>
      )}

      {/* Academic / Pedagogical Section */}
      {academicSources.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              size="sm"
              className="bg-secondary/15 text-secondary border-secondary/30 shrink-0 flex items-center gap-1 font-semibold"
            >
              <BookOpen className="size-3.5" /> Pedagojik ve Akademik Referanslar
            </Badge>
            <span className="text-xs text-muted-foreground">
              Müfredat, akademik literatür ve eğitim kaynakları
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {academicSources.map((src) => renderCard(src))}
          </div>
        </div>
      )}
    </section>
  );
}
