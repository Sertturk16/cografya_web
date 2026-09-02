import { projectToMapPoint } from "@/lib/map/projection";

export interface FaultLineSegment {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly color: string;
  readonly strokeWidth: number;
  readonly strokeDasharray: string;
  readonly waypoints: Array<readonly [longitude: number, latitude: number]>;
}

/**
 * MTA (Maden Tetkik ve Arama Genel Müdürlüğü) 1:1.250.000 Ölçekli Türkiye Diri Fay Haritası
 * (Emre et al., 2013) coğrafi koordinat düğüm noktaları.
 */
export const FAULT_LINE_SEGMENTS: FaultLineSegment[] = [
  // 1. Kuzey Anadolu Fay Zonu (KAFZ) - Sağ Yönlü Doğrultu Atımlı Ana Fay
  {
    id: "kaf",
    name: "Kuzey Anadolu Fay Zonu (KAFZ)",
    shortName: "KAF",
    color: "#dc2626", // Red
    strokeWidth: 2.2,
    strokeDasharray: "5 3",
    waypoints: [
      [26.25, 40.58], // Saros Körfezi
      [27.35, 40.80], // Gaziköy / Şarköy
      [28.50, 40.85], // Marmara Denizi Orta Sırtı
      [29.80, 40.72], // İzmit Körfezi / Gölcük
      [30.40, 40.70], // Sapanca / Adapazarı
      [30.75, 40.72], // Akyazı / Hendek
      [31.20, 40.82], // Düzce Ovası
      [31.60, 40.75], // Bolu / Abant
      [32.20, 40.80], // Gerede
      [33.25, 40.85], // Çerkeş / Kurşunlu
      [33.60, 40.92], // Ilgaz
      [34.05, 41.02], // Tosya
      [34.50, 41.12], // Kargı
      [34.80, 40.97], // Osmancık
      [35.65, 40.95], // Havza / Ladik
      [36.35, 40.78], // Taşova
      [36.60, 40.70], // Erbaa
      [36.95, 40.60], // Niksar
      [37.35, 40.40], // Reşadiye
      [37.80, 40.30], // Koyulhisar
      [38.10, 40.20], // Suşehri
      [38.75, 39.90], // Refahiye
      [39.50, 39.75], // Erzincan Ovası
      [39.70, 39.72], // Üzümlü
      [40.40, 39.78], // Tercan
      [40.70, 39.92], // Aşkale
      [40.55, 39.42], // Yedisu
      [41.01, 39.30], // Karlıova Kesişim Düğümü
    ],
  },
  // 2. Doğu Anadolu Fay Zonu (DAFZ) - Sol Yanal Doğrultu Atımlı Ana Fay
  {
    id: "daf",
    name: "Doğu Anadolu Fay Zonu (DAFZ)",
    shortName: "DAF",
    color: "#2563eb", // Vibrant Cobalt Blue
    strokeWidth: 2.2,
    strokeDasharray: "5 3",
    waypoints: [
      [36.00, 36.15], // Samandağ / Antakya
      [36.35, 36.50], // Kırıkhan
      [36.50, 36.80], // Hassa
      [36.65, 37.05], // İslahiye
      [36.85, 37.40], // Türkoğlu
      [37.15, 37.35], // Narlı
      [37.30, 37.50], // Pazarcık
      [37.65, 37.80], // Gölbaşı (Adıyaman)
      [37.90, 38.00], // Sürgü / Doğanşehir
      [38.25, 38.05], // Çelikhan
      [39.30, 38.45], // Sivrice / Hazar Gölü
      [39.65, 38.40], // Elazığ / Maden
      [39.95, 38.70], // Palu
      [40.50, 38.85], // Bingöl / Genç
      [41.01, 39.30], // Karlıova Kesişim Düğümü
    ],
  },
  // 3. Batı Anadolu Fay Sistemi (BAFS) - Gediz Grabeni
  {
    id: "bafs-gediz",
    name: "Gediz Grabeni Fay Sistemi",
    shortName: "Gediz Fayı",
    color: "#059669", // Vibrant Emerald Green
    strokeWidth: 1.8,
    strokeDasharray: "4 3",
    waypoints: [
      [28.55, 38.35], // Alaşehir
      [28.15, 38.50], // Salihli
      [27.70, 38.55], // Turgutlu
      [27.40, 38.60], // Manisa
      [27.15, 38.42], // İzmir Körfezi
    ],
  },
  // 4. Batı Anadolu Fay Sistemi (BAFS) - Büyük Menderes Grabeni
  {
    id: "bafs-menderes",
    name: "Büyük Menderes Grabeni Fay Sistemi",
    shortName: "B. Menderes Fayı",
    color: "#059669",
    strokeWidth: 1.8,
    strokeDasharray: "4 3",
    waypoints: [
      [30.15, 38.05], // Dinar
      [28.80, 37.90], // Kuyucak / Nazilli
      [28.30, 37.85], // Sultanhisar
      [27.85, 37.85], // Aydın
      [27.40, 37.75], // Söke / Ege Denizi
    ],
  },
  // 5. Batı Anadolu Fay Sistemi (BAFS) - Bakırçay Grabeni
  {
    id: "bafs-bakircay",
    name: "Bakırçay Grabeni Fay Sistemi",
    shortName: "Bakırçay Fayı",
    color: "#059669",
    strokeWidth: 1.8,
    strokeDasharray: "4 3",
    waypoints: [
      [27.60, 39.20], // Soma
      [27.30, 39.10], // Kınık / Bergama
      [26.90, 39.05], // Dikili / Çandarlı
    ],
  },
  // 6. Batı Anadolu Fay Sistemi (BAFS) - Gökova Grabeni
  {
    id: "bafs-gokova",
    name: "Gökova Grabeni Fay Sistemi",
    shortName: "Gökova Fayı",
    color: "#059669",
    strokeWidth: 1.8,
    strokeDasharray: "4 3",
    waypoints: [
      [28.35, 37.05], // Ula / Akyaka
      [27.95, 37.00], // Ören / Milas
      [27.60, 36.95], // Bodrum / Datça Açıkları
    ],
  },
];

/**
 * Coğrafi koordinat düğüm noktalarını MapPoint SVG koordinatlarına dönüştürerek
 * pürüzsüz SVG path `d` string'i üretir.
 */
export function buildFaultLinePath(waypoints: Array<readonly [longitude: number, latitude: number]>): string {
  if (!waypoints || waypoints.length === 0) return "";
  const points = waypoints.map(([lon, lat]) => projectToMapPoint(lon, lat));
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  const rest = points.slice(1);
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ` + rest.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}
