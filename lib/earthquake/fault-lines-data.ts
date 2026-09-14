export interface FaultLineSegment {
  name: string;
  detail: string;
}

export interface FaultLineItem {
  id: "kaf" | "daf" | "bafs";
  name: string;
  shortName: string;
  type: string;
  riskLevel: "Çok Yüksek" | "Yüksek";
  lengthKm: number;
  badgeClass: string;
  borderClass: string;
  accentColor: string;
  formation: string;
  movementMechanism: string;
  segments: FaultLineSegment[];
  provinces: { name: string; plate: string; slug: string }[];
  historicalEarthquakes: { year: number; place: string; magnitude: string; note: string }[];
  seismicGapAndRisk: string;
  marineConnection?: {
    seaName: string;
    href: string;
    description: string;
  };
}

export const FAULT_LINES_DATA: FaultLineItem[] = [
  {
    id: "kaf",
    name: "Kuzey Anadolu Fay Hattı (KAF)",
    shortName: "KAF",
    type: "Sağ Yanal Doğrultu Atımlı Fay Zonu",
    riskLevel: "Çok Yüksek",
    lengthKm: 1200,
    badgeClass: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    borderClass: "border-red-500/40 hover:border-red-500/60",
    accentColor: "text-red-600 dark:text-red-400",
    formation:
      "Avrasya Levhası'nın güneye, Anadolu Levhacığı'nın ise Arap Levhası'nın kuzeye doğru sıkıştırmasıyla batıya doğru yılda yaklaşık 20-25 milimetre hızla ötelenmesi sonucunda oluşmuştur. Doğu Anadolu'daki Karlıova üçlü eklem noktasından başlayıp Marmara Denizi ve Saros Körfezi üzerinden Kuzey Ege çukurluklarına kadar uzanan, yerkürenin en sismik ve aktif doğrultu atımlı kıtasal kırık zonlarından biridir.",
    movementMechanism:
      "Sağ yanal doğrultu atım: Fay düzleminin karşısında duran bir gözlemciye göre fayın sağ tarafındaki blok görece kendine doğru hareket eder. Bu yatay hareket sırasında fay üzerindeki pürüzler ve kilitlenmeler sismik enerji biriktirir; sürtünme direnci aşıldığında ani atımlarla yıkıcı depremler açığa çıkar.",
    segments: [
      {
        name: "Doğu Segmenti (Karlıova – Erzincan – Suşehri)",
        detail:
          "Karlıova düğüm noktasından başlayarak Yedisu Fayı, Erzincan Ovası ve Kelkit Vadisi boyunca uzanır. 1939 büyük felaketinin başladığı yüksek dağlık kırık hattıdır.",
      },
      {
        name: "Orta Segment (Koyulhisar – Tokat – Niksar – Ladik – Kargı – Bolu)",
        detail:
          "Kuzey Anadolu sıradağlarının güney eteklerini takip eden vadi oluklarını kat eder. 1942, 1943 ve 1944 yıllarında batıya doğru domino etkisiyle kırılan silsiledir.",
      },
      {
        name: "Batı Segmenti (Bolu – Düzce – Adapazarı – İzmit Körfezi)",
        detail:
          "Gölcük ve Düzce üzerinden Marmara havzasına giriş yapar. 17 Ağustos ve 12 Kasım 1999 kırılmalarıyla yüzeyde 5 metreyi aşan kalıcı yatay ötelemeler oluşturmuştur.",
      },
      {
        name: "Marmara Denizi Geçişi & Kuzey Kol",
        detail:
          "İzmit Körfezi çıkışından Prens Adaları güneyi, Çınarcık Çukuru, Orta Marmara Sırtı ve Tekirdağ Çukurluğu üzerinden Gaziköy-Şarköy ve Saros Körfezi'ne bağlanır.",
      },
    ],
    provinces: [
      { name: "Bingöl", plate: "12", slug: "bingol" },
      { name: "Erzincan", plate: "24", slug: "erzincan" },
      { name: "Tunceli", plate: "62", slug: "tunceli" },
      { name: "Sivas", plate: "58", slug: "sivas" },
      { name: "Tokat", plate: "60", slug: "tokat" },
      { name: "Amasya", plate: "05", slug: "amasya" },
      { name: "Samsun", plate: "55", slug: "samsun" },
      { name: "Çorum", plate: "19", slug: "corum" },
      { name: "Kastamonu", plate: "37", slug: "kastamonu" },
      { name: "Çankırı", plate: "18", slug: "cankiri" },
      { name: "Bolu", plate: "14", slug: "bolu" },
      { name: "Düzce", plate: "81", slug: "duzce" },
      { name: "Sakarya", plate: "54", slug: "sakarya" },
      { name: "Kocaeli", plate: "41", slug: "kocaeli" },
      { name: "Yalova", plate: "77", slug: "yalova" },
      { name: "İstanbul", plate: "34", slug: "istanbul" },
      { name: "Tekirdağ", plate: "59", slug: "tekirdag" },
      { name: "Çanakkale", plate: "17", slug: "canakkale" },
    ],
    historicalEarthquakes: [
      {
        year: 1939,
        place: "Erzincan",
        magnitude: "Ms 7.9",
        note: "Türkiye Cumhuriyeti tarihinin en yıkıcı aletsel dönem depremi; 33 binden fazla can kaybı ve ~350 km yüzey kırığı.",
      },
      {
        year: 1942,
        place: "Niksar – Erbaa",
        magnitude: "Ms 7.0",
        note: "KAF boyunca batıya göç eden gerilim transferinin ikinci büyük adımı.",
      },
      {
        year: 1943,
        place: "Tosya – Ladik",
        magnitude: "Ms 7.2",
        note: "Orta Karadeniz geçiş kuşağında yaklaşık 280 kilometrelik fay kırığı.",
      },
      {
        year: 1944,
        place: "Bolu – Gerede",
        magnitude: "Ms 7.2",
        note: "Batı Karadeniz iç kesiminde yüzey kırığı ve ağır yapısal hasar.",
      },
      {
        year: 1999,
        place: "Kocaeli (Gölcük)",
        magnitude: "Mw 7.4",
        note: "17 Ağustos 1999: Sanayi kalbi Marmara'da 17 binden fazla can kaybı, 120 km yüzey kırığı ve 5.5 metreye varan atım.",
      },
      {
        year: 1999,
        place: "Düzce",
        magnitude: "Mw 7.2",
        note: "12 Kasım 1999: Gölcük depreminin doğu ucundaki gerilim transferiyle 87 gün sonra kırılan fay segmenti.",
      },
    ],
    seismicGapAndRisk:
      "1999 Gölcük depremiyle boşalan gerilim enerjisi Marmara Denizi altındaki Kuzey Marmara Segmenti'ne aktarılmıştır. Prens Adaları ile Silivri açıkları arasındaki fay parçası 1766'dan beri kırılmamış olup kritik bir 'sismik boşluk' niteliği taşımaktadır.",
    marineConnection: {
      seaName: "Marmara Denizi",
      href: "/v2/deniz/marmara",
      description:
        "KAF'ın Marmara Denizi tabanındaki 3 derin çukurluk (Tekirdağ, Orta Marmara, Çınarcık) ve denizaltı fay geometrisi Marmara Denizi sayfasında incelenmektedir.",
    },
  },
  {
    id: "daf",
    name: "Doğu Anadolu Fay Hattı (DAF)",
    shortName: "DAF",
    type: "Sol Yanal Doğrultu Atımlı Fay Zonu",
    riskLevel: "Çok Yüksek",
    lengthKm: 550,
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    borderClass: "border-blue-500/40 hover:border-blue-500/60",
    accentColor: "text-blue-600 dark:text-blue-400",
    formation:
      "Arap Levhası'nın kuzeye doğru yaptığı tektonik baskı sonucunda Anadolu Levhacığı'nın güneydoğu sınırını çizer. Hatay-Antakya grabeninden ve İskenderun Körfezi doğusundan başlayarak Kahramanmaraş, Gölbaşı, Hazar Gölü (Elazığ) ve Bingöl üzerinden Karlıova birleşim noktasına uzanır.",
    movementMechanism:
      "Sol yanal doğrultu atım: Fay hattının karşısındaki blok sola doğru hareket eder. Yıllık deformasyon hızı KAF'a kıyasla daha mütevazı (ortalama 8-10 mm/yıl) olmakla birlikte, yüzyıllar boyu kilitlenen segmentler kırıldığında devasa magnitüdlü sismik enerji boşalımı meydana getirir.",
    segments: [
      {
        name: "Karlıova – Bingöl – Palu Segmenti",
        detail: "KAF ile DAF'ın kesiştiği Karlıova düğümünden Murat Nehri vadisi boyunca uzanır.",
      },
      {
        name: "Palu – Hazar Gölü – Sivrice Segmenti",
        detail:
          "Elazığ Hazar Gölü tektonik çöküntüsünü boydan boya geçer. 24 Ocak 2020 depreminde kırılarak gerilimini güneybatıya aktarmıştır.",
      },
      {
        name: "Doğanyol – Pütürge – Erkenek Segmenti",
        detail: "Malatya ile Adıyaman arasındaki dağlık kuşağı kat eden derin kırık zonudur.",
      },
      {
        name: "Pazarcık – Türkoğlu – Gölbaşı Segmenti",
        detail:
          "6 Şubat 2023 sabaha karşı saat 04:17'de Mw 7.7 büyüklüğündeki ana şokun merkez üssünü barındıran segment.",
      },
      {
        name: "Amanos – Hatay – Samandağ Segmenti",
        detail:
          "Amik Ovası ve Asi Nehri havzasından geçerek Ölü Deniz Fay Zonu ile kesişen güney ucu.",
      },
    ],
    provinces: [
      { name: "Hatay", plate: "31", slug: "hatay" },
      { name: "Osmaniye", plate: "80", slug: "osmaniye" },
      { name: "Gaziantep", plate: "27", slug: "gaziantep" },
      { name: "Kahramanmaraş", plate: "46", slug: "kahramanmaras" },
      { name: "Adıyaman", plate: "02", slug: "adiyaman" },
      { name: "Malatya", plate: "44", slug: "malatya" },
      { name: "Elazığ", plate: "23", slug: "elazig" },
      { name: "Bingöl", plate: "12", slug: "bingol" },
    ],
    historicalEarthquakes: [
      {
        year: 1822,
        place: "Antakya – Halep",
        magnitude: "Ms ~7.0",
        note: "Güney DAF ve Ölü Deniz Fay kesişiminde büyük can kaybı ve tarihi yerleşim tahribatı.",
      },
      {
        year: 1872,
        place: "Amik Gölü (Antakya)",
        magnitude: "Ms 7.2",
        note: "Amik Ovası zemininde sıvılaşma ve geniş çaplı tektonik çöküntü.",
      },
      {
        year: 1971,
        place: "Bingöl",
        magnitude: "Ms 6.8",
        note: "DAF'ın kuzeydoğu ucunda ağır yapı hasarı.",
      },
      {
        year: 2020,
        place: "Elazığ (Sivrice)",
        magnitude: "Mw 6.8",
        note: "Pütürge segmenti üzerinde kırılma; Malatya ve Elazığ'da can kayıpları.",
      },
      {
        year: 2023,
        place: "Pazarcık (Kahramanmaraş)",
        magnitude: "Mw 7.7",
        note: "6 Şubat 2023 saat 04:17: DAF'ın yaklaşık 300 kilometrelik ana hattı üzerinde 9 saat arayla yaşanan 'Asrın Felaketi'nin ilk ana şoku; 11 ilde 53 bini aşkın can kaybı.",
      },
      {
        year: 2023,
        place: "Elbistan (Kahramanmaraş)",
        magnitude: "Mw 7.6",
        note: "6 Şubat 2023 saat 13:24: İlk depremin tetiklediği Çardak Fayı üzerinde gerçekleşen ikinci bağımsız sarsıntı.",
      },
    ],
    seismicGapAndRisk:
      "6 Şubat 2023 depremleri DAF'ın güneybatı kollarındaki yüzlerce yıllık enerji birikimini büyük ölçüde boşaltmıştır. Buna karşılık kuzey uçtaki Yedisu Fayı (Erzincan-Bingöl arası) 1784'ten beri kırılmamış olup sismik boşluk vasfını sürdürmektedir.",
    marineConnection: {
      seaName: "Akdeniz (İskenderun Körfezi)",
      href: "/v2/deniz/akdeniz",
      description:
        "DAF'ın güney ucu Samandağ kıyısından Doğu Akdeniz basenine ve Kıbrıs Yayı tektoniğine bağlanır.",
    },
  },
  {
    id: "bafs",
    name: "Batı Anadolu Fay Sistemi (BAFS)",
    shortName: "BAFS",
    type: "Normal Faylanma ve Horst-Graben Genişleme Sistemi",
    riskLevel: "Yüksek",
    lengthKm: 800,
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    borderClass: "border-emerald-500/40 hover:border-emerald-500/60",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    formation:
      "Afrika Levhası'nın Helen Yayı boyunca Ege Denizi'nin altına dalması ve yay gerisi açılma tektoniği (back-arc extension) nedeniyle Batı Anadolu kabuğu kuzey-güney yönünde yılda yaklaşık 30-40 milimetre hızla esnemektedir. Bu gerilme, dağlık kütlelerin (horst) yükselmesine ve aralarındaki çöküntü ovalarının (graben) fay diklikleriyle tabana oturmasına yol açmıştır.",
    movementMechanism:
      "Normal faylanma: Kabuktaki açılma ve çekme kuvvetleri sonucunda asılı blok taban bloğuna göre aşağıya doğru kayar. Bu faylarda düşey yer değiştirme bileşeni baskındır ve yüzeyde basamaklı fay aynaları, dik yamaçlar ve termal su çıkışları oluşturur.",
    segments: [
      {
        name: "Bakırçay Grabeni & Kırıkları",
        detail:
          "Soma, Kınık ve Bergama olukları boyunca uzanarak Çandarlı Körfezi açıklarına kavuşur.",
      },
      {
        name: "Gediz (Alaşehir) Grabeni",
        detail:
          "Sarıgöl, Alaşehir, Salihli ve Turgutlu hattı boyunca Bozdağlar horstunun kuzey yamacını belirler; 1969 Alaşehir depreminin kaynağıdır.",
      },
      {
        name: "Küçük Menderes Çöküntüsü",
        detail: "Ödemiş, Tire ve Torbalı ovalarını çevreleyen basamaklı normal fay zonlarıdır.",
      },
      {
        name: "Büyük Menderes Grabeni",
        detail:
          "Dinar, Nazilli, Aydın ve Söke üzerinden Ege Denizi'ne dökülen Türkiye'nin en karakteristik tektonik graben vadisidir.",
      },
      {
        name: "Gökova & Muğla Fay Kuşağı",
        detail:
          "Muğla, Ula, Ören ve Bodrum yarımadası boyunca uzanan derin denizaltı graben faylarıdır.",
      },
    ],
    provinces: [
      { name: "İzmir", plate: "35", slug: "izmir" },
      { name: "Manisa", plate: "45", slug: "manisa" },
      { name: "Aydın", plate: "09", slug: "aydin" },
      { name: "Denizli", plate: "20", slug: "denizli" },
      { name: "Muğla", plate: "48", slug: "mugla" },
      { name: "Uşak", plate: "64", slug: "usak" },
      { name: "Kütahya", plate: "43", slug: "kutahya" },
      { name: "Balıkesir", plate: "10", slug: "balikesir" },
    ],
    historicalEarthquakes: [
      {
        year: 1969,
        place: "Alaşehir (Manisa)",
        magnitude: "Ms 6.5",
        note: "Gediz grabenindeki normal fay hareketine bağlı yüzey deformasyonu.",
      },
      {
        year: 1970,
        place: "Gediz (Kütahya)",
        magnitude: "Ms 7.2",
        note: "İç Batı Anadolu geçiş kuşağında binden fazla can kaybı.",
      },
      {
        year: 1995,
        place: "Dinar (Afyonkarahisar)",
        magnitude: "Ms 6.1",
        note: "Büyük Menderes grabeninin doğu basamağında sığ odaklı yıkım.",
      },
      {
        year: 2017,
        place: "Bodrum – Kos",
        magnitude: "Mw 6.6",
        note: "Gökova Körfezi açığında normal faylanma ve küçük çaplı yerel kıyı tsunamisi.",
      },
      {
        year: 2020,
        place: "Sisam – İzmir",
        magnitude: "Mw 6.6",
        note: "30 Ekim 2020: Sisam adası kuzeyindeki normal fayın kırılmasıyla 70 km uzaktaki Bayraklı ve Bornova alüvyon zeminlerinde ağır yıkım ve Seferihisar kıyısında tsunami.",
      },
    ],
    seismicGapAndRisk:
      "BAFS üzerindeki faylar KAF gibi tek bir ana iz üzerinde değil, yüzlerce parçalı paralel kırık ağından oluşur. Bu nedenle 5.0 - 6.5 büyüklüğündeki orta ölçekli depremler çok sık tekrarlanır. Alüvyon zeminli ovalardaki yapı stokları zemin büyütmesi nedeniyle yüksek risk taşır.",
    marineConnection: {
      seaName: "Ege Denizi",
      href: "/v2/deniz/ege",
      description:
        "BAFS graben vadilerinin Ege Denizi tabanında devam eden denizaltı kırıkları ve kıta sahanlığı etkileşimi Ege Denizi sayfasında incelenmektedir.",
    },
  },
];
