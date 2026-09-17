import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Database, ShieldCheck, BookOpen, ExternalLink, Scale, ChevronDown } from "lucide-react";

/**
 * NO `general` SCOPE. It existed for the seven auth pages — `/giris`, `/kayit`, `/profil`,
 * `/hesabim`, `/sifre-sifirlama`, `/sifre-sifirlama/yeni`, `/e-posta-dogrulama` — and claimed
 * TÜİK demographics, OSM administrative boundaries, Copernicus and AFAD under the heading
 * "Bu Sayfada Kullanılan Veri Setleri". A sign-in form renders none of them. The pages no
 * longer render this component at all, which is the only honest answer for a page that
 * publishes no data: the fix for an over-cited bibliography on a page with no sources is not
 * a shorter bibliography.
 *
 * (The live ticker DOES publish AFAD and CMEMS values in the chrome of those seven pages and
 * of 26 others. That is one question with one answer, recorded as an open item for the owner
 * in `components/marine/marine-attribution-coverage.test.ts`; half-answering it on seven pages
 * with a card at the foot of a login form would have made it harder to see, not easier.)
 */
/**
 * NO `dunya` SCOPE EITHER, and the reason above is now a rule.
 *
 * A dataset is cited here only where the page draws from it TRACEABLY — a committed generated
 * artifact with a provenance header, or an api field whose own source travels with it. Not
 * because the page happens to display the KIND of thing that institution publishes.
 *
 * The `dunya` list failed that on every entry. `un-data`, `cia-factbook`, `usgs-nasa` and
 * `iho-gebco` are traceable to nothing in this repo: the continent figures come from
 * `lib/geo/continents.ts`, a hand-written registry, and the country figures come from the api,
 * whose per-field credit `/dunya/[slug]` already prints BESIDE the number through
 * `sourcesMessage()`. `natural-earth` IS used — but only where a map is drawn, and every such map
 * already credits it itself, through `V2MapAttribution`'s `world` variant or `LocatorMap`'s
 * `<figcaption>`, more precisely than a card at the foot of the page can. No entry carried a
 * `legalQuote`, so removing the list orphaned no licence text.
 *
 * The owner's ruling this follows: saying where a number came from, beside the number, is
 * information; listing an institution's name in a bibliography block is noise wherever the page
 * cannot trace its data to that institution. The one thing in that block that was never a
 * citation — the methodology note saying the continent figures are the platform's own and rounded
 * for teaching — survives on `/dunya/kita` and `/dunya/kita/[slug]` as standalone prose beside the
 * figures it describes.
 */
export type V2PageScope = "home" | "turkiye" | "deniz" | "oyun" | "deprem" | "araclar" | "kitaplar";

/**
 * `legalQuote` IS AN ECHO, NEVER THE SOLE CARRIER OF A MANDATED NOTICE.
 *
 * `renderCard` puts this field inside a `<details>` labelled "Atıf şartı & yasal metin",
 * CLOSED BY DEFAULT. That is the right weight for a bibliography — a reader who wants the
 * licence text can open it — and it is NOT enough to discharge a licence. The criterion this
 * repo applies, stated in `components/marine/marine-attribution.tsx`'s own docblock, is that
 * the notice is visible WITHOUT A CLICK on the page that PUBLISHES it; a disclosure the reader
 * must find and open is a click. (For the marine licences that page is now `/hakkimizda`, on
 * the owner decision recorded in that docblock — CC BY 4.0 §3(a)(2) lets a hyperlink carry the
 * required information. The notice is still visible without a click when the reader gets
 * there, which is the part this card can never satisfy.)
 *
 * Three call sites had bet the other way, passing `hideAttribution` to `ClimateSection` and
 * `AirPollutionSection` so the inline blocks vanished and this `<details>` became the only
 * place ERA5-Land's and ACAG's required wording appeared. That prop is gone from both
 * components, and neither may get it back.
 *
 * So: a source whose licence requires a notice is credited by a dedicated attribution block —
 * `EarthquakeAttribution` and the inline blocks in `ClimateSection` and `AirPollutionSection` on
 * the page itself, `MarineAttribution` on `/hakkimizda` with `MarineDataNotice` linking every
 * value surface to it. This card names the source; the quote, where it is worth showing at all,
 * repeats what one of those blocks already shows in full.
 */
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
      // TÜİK ALONE. This card used to be "TÜİK & OpenStreetMap" and carried ODbL's credit as
      // its `legalQuote`. The home page draws NO MAP — no `PROVINCE_SHAPES`, no
      // `COUNTRY_SHAPES`, no `INLAND_WATER_SHAPES` — so the OSM half credited a source the
      // page does not use. The population facts in the featured cards are the TÜİK half, and
      // they are real. Every surface that DOES draw OSM geometry carries the credit inline,
      // through `V2MapAttribution` (`lib/map/tr-inland-water-jrc.test.ts` derives that list).
      id: "tuik-osm",
      icon: "📊",
      title: "TÜİK Adrese Dayalı Nüfus Kayıt Sistemi (ADNKS)",
      license: "TÜİK ADNKS",
      description: "Türkiye 81 il demografisi ve nüfus sayımı göstergeleri.",
      sourceUrl: "tuik.gov.tr",
    },
    {
      id: "copernicus-marine",
      icon: "🌊",
      title: "Copernicus Marine Service (CMEMS)",
      license: "E.U. Copernicus",
      description:
        "30 kıyı istasyonunda saatlik deniz suyu sıcaklığı (SST), dalga boyu ve akıntı telemetrisi.",
      // NO `legalQuote`, for the reason already recorded on the `deniz` scope's `cmems` entry —
      // this was the surviving copy of the same defect. The Copernicus Marine notice is
      // single-sourced as `Marine.attribution.cmemsNotice` in `messages/{tr,en}.json` and
      // rendered verbatim by `MarineAttribution` on `/hakkimizda`; this page reaches it through
      // the link in `MarineDataNotice`, above. This copy read "…Information 2026": the notice
      // attaches to the SERVICE and not to a data year, so the year was not merely a second
      // version of a verbatim licence string, it was a WRONG one.
      sourceUrl: "marine.copernicus.eu",
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
  deniz: [
    {
      id: "cmems",
      icon: "🌊",
      title: "Copernicus Marine Service (CMEMS)",
      license: "E.U. Copernicus (CC BY 4.0)",
      description:
        "Karadeniz, Marmara, Ege ve Akdeniz'in 30 kıyı noktasında saatlik yüzey deniz suyu sıcaklığı (SST) ve dalga boyu modelleri.",
      // NO `legalQuote`. The Copernicus Marine notice is single-sourced in `messages/*.json`
      // and rendered by `MarineAttribution` on `/hakkimizda`, which every page carrying
      // CMEMS-derived values links to through `MarineDataNotice`. A near-copy here — this one
      // used to read "…Information 2026" — is a second version of a verbatim licence string,
      // which is a breach waiting for the day someone edits one of them. This card is a
      // bibliography entry; the licence lives on the central page.
      sourceUrl: "marine.copernicus.eu",
    },
    {
      id: "ecmwf-marine",
      icon: "🌀",
      title: "ECMWF Open Data Oşinografi & Rüzgâr",
      license: "CC BY 4.0",
      description:
        "10 metre deniz yüzeyi rüzgâr hız vektörleri, rüzgâr dalgası ve açık deniz dalga yön simülasyonları.",
      // NO `legalQuote`. This field used to read "Generated using ECMWF Open Data information
      // 2026", which is not ECMWF's required wording and not traceable to any licence text —
      // an invented sentence presented to the reader under "Atıf şartı & yasal metin". ECMWF's
      // actual notice is long, single-sourced, and rendered verbatim by `MarineAttribution` on
      // `/hakkimizda` — one hyperlink away, in the notice above this card.
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
      category: "official",
      description:
        "Türkiye Deprem Veri Merkezi Sistemi (TDVMS) üzerinden anlık deprem merkez üssü, odak derinliği ve büyüklük (ML/Mw) kayıtları.",
      legalQuote: "AFAD TDVMS Yönetmeliği, RG 28.08.2015/29459, m.9/4",
      sourceUrl: "deprem.afad.gov.tr",
    },
    // NO MTA CARD, AND NOTHING IN ITS PLACE. It claimed `license: "T.C. Resmî Jeoloji Verisi"`
    // — official geology data — for `/deprem/fay-hatlari`, which renders
    // `lib/earthquake/fault-lines-data.ts`: three fault-zone names, approximate lengths, the
    // formation and movement mechanism written out as prose, segments named after the towns they
    // pass, province lists and historical earthquakes. No coordinates, no geometry, no
    // segmentation-model parameters, and no provenance recorded in the file. It is
    // school-textbook content in the author's own words, so the card asserted we had used a
    // published dataset we never read.
    //
    // It was NARROWED once already, to "adlandırma ve tasnifi için referans" — a reference for
    // naming and classification. That is still an unearned claim, and it is not one worth
    // rescuing: citing a source for "the North Anatolian Fault is about 1200 km" is citing one
    // for "Türkiye has 81 provinces". A number a reader can check in any textbook does not need
    // an institution's name attached to it, and attaching one costs the reader attention that
    // the page's real citations — AFAD's, below — need.
    //
    // NO KRDAE / KANDİLLİ CARD. The contract states it in as many words — "AFAD is the sole
    // Faz-1 provider" (`openapi/openapi.json`) — and this site publishes no historical or
    // instrumental catalogue, no focal-mechanism solution and no depth record from Kandilli.
    // The card claimed all three. Crediting an institution for data it did not supply is the
    // same class of false statement as the invented `licenseUrl` the same contract forbids
    // ("Inventing a plausible URL would be a false statement about the terms").
    {
      id: "afad-hazirlik",
      icon: "🎒",
      title: "AFAD Afet Farkındalık & AKUT Arama Kurtarma",
      license: "Ulusal Afet Bilinci Standartları",
      category: "official",
      description:
        "Deprem öncesi yaşam alanı sabitlemeleri, afet ve acil durum çantası içeriği, sarsıntı anı Çök-Kapan-Tutun tekniği ve ilk 72 saat tahliye protokolü.",
      sourceUrl: "afad.gov.tr • akut.org.tr",
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
};

/**
 * Flat `id` → item index across every scope list.
 *
 * A page sometimes shows data whose source lives in another page's list. The province page is
 * scoped `turkiye`, whose list carries no marine source at all, yet 27 coastal provinces render
 * CMEMS-derived sea-surface temperature. Copying the CMEMS entry into the `turkiye` list would
 * cite it on the 54 landlocked provinces too — the same defect with the sign flipped. `include`
 * resolves against this index instead, so a page can cite a source it actually renders without
 * the whole scope inheriting the claim.
 *
 * First definition wins if an id is ever declared twice. None is today — the near-pairs
 * (`tuik`/`tuik-osm`, `afad`/`afad-deprem`, `osm`/`osm-game`) are distinct ids because the blurb
 * differs by page, so each resolves to exactly one entry.
 */
const SOURCE_BY_ID: ReadonlyMap<string, SourceItem> = (() => {
  const index = new Map<string, SourceItem>();
  for (const item of Object.values(SOURCES_BY_PAGE).flat()) {
    if (!index.has(item.id)) index.set(item.id, item);
  }
  return index;
})();

interface V2SourcesSectionProps {
  /**
   * REQUIRED, and it used to be optional with a `home` default.
   *
   * `/oyun/bolge-bolge-il` rendered `<V2SourcesSection />` with no props at all and therefore
   * claimed CMEMS marine telemetry, ERA5-Land climate normals, AFAD seismic records and PM2.5
   * — on a page that is a region picker. The correct `oyun` scope already existed and `/oyun`
   * was already using it; nothing failed, because a default cannot be wrong.
   *
   * Required is a stronger guard than a test for this: the compiler sees every call site,
   * including the one someone adds next year, and there is no value a forgotten prop can
   * silently fall to.
   */
  scope: V2PageScope;
  className?: string;
  regionalNote?: React.ReactNode;
  /**
   * Ids to cite in addition to the scope's own list, for data this page renders conditionally.
   * Unknown ids are dropped rather than thrown on: a citation list is not worth a 500, and
   * `v2-sources-conditional.test.ts` fails the build if a call site names an id that does not
   * resolve, which is the check that actually catches the typo.
   */
  include?: readonly string[];
  /**
   * Ids from the scope's own list to drop, for data this page did NOT render. The province
   * page cites `acag-pm25` only when a PM2.5 figure is on the page; without this it cited the
   * source on every province, including those the API publishes no air-quality series for.
   */
  omit?: readonly string[];
}

export function V2SourcesSection({
  scope,
  className = "",
  regionalNote,
  include,
  omit,
}: V2SourcesSectionProps) {
  // No `|| SOURCES_BY_PAGE.home` fallback either: `SOURCES_BY_PAGE` is a `Record` over the
  // closed scope union, so every key resolves and the fallback could only ever fire for a
  // value the type system says cannot exist — while silently citing the home page's sources
  // if it somehow did.
  const scoped = SOURCES_BY_PAGE[scope];
  const omitted = new Set(omit ?? []);
  const kept = scoped.filter((s) => !omitted.has(s.id));
  const keptIds = new Set(kept.map((s) => s.id));
  const extra = (include ?? [])
    .filter((id) => !keptIds.has(id))
    .map((id) => SOURCE_BY_ID.get(id))
    .filter((item): item is SourceItem => item !== undefined);
  const allSources = [...kept, ...extra];
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
        className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 hover:border-primary/40 hover:bg-muted/20 transition-all space-y-2.5 flex flex-col justify-between shadow-2xs group"
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="font-bold text-xs text-foreground flex items-center gap-1.5 min-w-0">
              <span className="text-sm shrink-0">{src.icon}</span>
              <span className="truncate group-hover:text-primary transition-colors">
                {src.title}
              </span>
            </span>
            <Badge
              variant="outline"
              className="text-[9.5px] py-0 px-1.5 font-mono shrink-0 bg-muted/50 border-border/60"
            >
              {src.license}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{src.description}</p>
          {src.legalQuote && (
            <details className="group/quote text-[10px] pt-0.5">
              <summary className="cursor-pointer select-none font-medium text-muted-foreground/80 hover:text-primary transition-colors inline-flex items-center gap-1 list-none">
                <span className="text-[10px]">Atıf şartı &amp; yasal metin</span>
                <ChevronDown className="size-2.5 text-muted-foreground group-open/quote:rotate-180 transition-transform" />
              </summary>
              <div className="mt-1.5 p-2 rounded-xl bg-muted/50 border border-border/50 text-[9.5px] font-mono leading-relaxed text-muted-foreground/90 max-h-28 overflow-y-auto">
                &ldquo;{src.legalQuote}&rdquo;
              </div>
            </details>
          )}
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate flex items-center gap-1">
            <span className="opacity-70">Kaynak:</span>
            {isExternal ? (
              <span className="font-mono text-foreground/80 flex items-center gap-0.5">
                {src.sourceUrl}
                <ExternalLink className="size-2.5 text-muted-foreground/70" aria-hidden="true" />
                <span className="sr-only">(Harici referans kaynağı)</span>
              </span>
            ) : (
              <span className="font-mono text-foreground/80">{src.sourceUrl}</span>
            )}
          </span>
          {src.doi && (
            <span className="font-mono text-primary text-[9.5px] shrink-0">DOI: {src.doi}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      aria-labelledby="v2-sources-heading"
      className={`rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-lg space-y-6 ${className}`}
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

      {/* Regional Methodology & Legal Basis Callout */}
      {regionalNote && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-muted/30 border border-border/70 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                size="sm"
                className="bg-primary/10 text-primary border-primary/30 shrink-0 flex items-center gap-1 font-semibold text-[10px] py-0 px-2"
              >
                <Scale className="size-3" /> Bölgesel Metodoloji &amp; Yasal Dayanak
              </Badge>
              <span className="text-[11px] font-semibold text-foreground">
                TÜİK İBBS Düzey-1 ve 1941 Coğrafya Kongresi Tasnifi
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Resmî İdari &amp; Coğrafi Normlar
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">{regionalNote}</div>
        </div>
      )}

      {/* Official Data Section */}
      {officialSources.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              size="sm"
              className="shrink-0 flex items-center gap-1 font-semibold text-xs"
            >
              <ShieldCheck className="size-3.5" /> Doğrulanmış Resmî Veri
            </Badge>
            <span className="text-xs text-muted-foreground">
              Resmî kurumlar ve doğrulanmış açık veri sağlayıcıları
            </span>
          </div>
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${
              officialSources.length > 2 ? "lg:grid-cols-3" : ""
            } gap-3.5 text-xs`}
          >
            {officialSources.map((src) => renderCard(src))}
          </div>
        </div>
      )}

      {/* Academic / Pedagogical Section */}
      {academicSources.length > 0 && (
        <div className="space-y-3.5 pt-4 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              size="sm"
              className="bg-secondary/15 text-secondary border-secondary/30 shrink-0 flex items-center gap-1 font-semibold text-xs"
            >
              <BookOpen className="size-3.5" /> Pedagojik ve Akademik Referanslar
            </Badge>
            <span className="text-xs text-muted-foreground">
              Müfredat, akademik literatür ve eğitim kaynakları
            </span>
          </div>
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${
              academicSources.length > 2 ? "lg:grid-cols-3" : ""
            } gap-3.5 text-xs`}
          >
            {academicSources.map((src) => renderCard(src))}
          </div>
        </div>
      )}
    </section>
  );
}
