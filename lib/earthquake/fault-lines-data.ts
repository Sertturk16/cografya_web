import { FAULT_IDENTITY, type FaultId } from "@/lib/theme/fault-identity";

/**
 * The three fault zones `/deprem` and `/deprem/fay-hatlari` publish.
 *
 * COLOUR IS A TOKEN HERE, NOT A HUE (T-031c). `badgeClass`, `borderClass` and `accentColor`
 * used to hold three literal hue strings per zone — twenty-four raw palette classes, in
 * `lib/`, where a counter that walked only `components/` and `app/` never looked. The call
 * sites could have reached zero while the definition went on shipping the hues. They now read
 * `lib/theme/fault-identity.ts`, which reads `--fault-*`.
 *
 * The hue is a CLASSIFICATION, which is why it is data and not decoration: each zone's `type`
 * field below names its faulting kinematics, and the three are the three kinematic classes an
 * active-fault legend is built on. `app/globals.css` carries the argument and the measurements.
 * Binding these to the danger/information/success families would put three data categories on
 * three semantic hues — the data-viz rule run backwards — and would make red mean both "KAF"
 * and "hazard" on a card whose risk level is already `text-destructive`.
 */
export interface FaultLineSegment {
  name: string;
  detail: string;
}

export interface FaultLineItem {
  /** The `--fault-*` token this zone wears, and its in-page anchor. */
  id: FaultId;
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
    type: "Sağ Yanal Doğrultu Atımlı Fay",
    riskLevel: "Çok Yüksek",
    lengthKm: 1200,
    badgeClass: FAULT_IDENTITY.kaf.badge,
    borderClass: FAULT_IDENTITY.kaf.articleEdge,
    accentColor: FAULT_IDENTITY.kaf.label,
    formation:
      "Kuzeye ilerleyen Arap Levhası Anadolu'yu sıkıştırıyor. Kuzeyde Avrasya Levhası'na dayanan Anadolu bu baskıdan batıya doğru kaçıyor, yılda yaklaşık 20-25 milimetre. KAF, bu kaymanın Anadolu ile Avrasya arasındaki sınırıdır. Doğuda, Kuzey Anadolu Fayı ile Doğu Anadolu Fayı'nın buluştuğu Karlıova üçlü ekleminden başlar, Marmara Denizi ve Saros Körfezi'nden geçerek Kuzey Ege'deki çukurlara kadar uzanır. Dünyanın karada en etkin doğrultu atımlı faylarından biridir.",
    movementMechanism:
      "Sağ yanal doğrultu atım: fayın bir yanında durup karşıya baktığında, karşı taraf sağa doğru kayar. Hareket yataydır. Fayın iki yanı pürüzlü yüzeylerinden birbirine takılır ve bu sırada gerilim birikir. Gerilim sürtünmeyi yendiğinde iki yan bir anda kayar; deprem bu ani kaymadır.",
    segments: [
      {
        name: "Doğu Parçası (Karlıova – Erzincan – Suşehri)",
        detail:
          "Karlıova'dan başlar; Yedisu Fayı, Erzincan Ovası ve Kelkit Vadisi boyunca ilerler. 1939 Erzincan depremi bu yüksek, dağlık bölümde başladı.",
      },
      {
        name: "Orta Parça (Koyulhisar – Tokat – Niksar – Ladik – Kargı – Bolu)",
        detail:
          "Kuzey Anadolu Dağları'nın güney eteklerindeki vadileri izler. 1942, 1943 ve 1944'te art arda, her seferinde biraz daha batıda kırıldı.",
      },
      {
        name: "Batı Parçası (Bolu – Düzce – Adapazarı – İzmit Körfezi)",
        detail:
          "Düzce ve Gölcük üzerinden Marmara'ya girer. 17 Ağustos ve 12 Kasım 1999 depremlerinde fayın iki yanı yüzeyde yer yer 5 metreden fazla yana kaydı ve öyle kaldı.",
      },
      {
        name: "Marmara Denizi'nin Altındaki Kuzey Kol",
        detail:
          "İzmit Körfezi'nden çıkınca Prens Adaları'nın güneyinden, Çınarcık Çukuru'ndan, Orta Marmara Sırtı'ndan ve Tekirdağ Çukurluğu'ndan geçer; Gaziköy-Şarköy üzerinden Saros Körfezi'ne bağlanır.",
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
        note: "2023 depremlerine kadar Cumhuriyet döneminin en çok can alan depremiydi. 33 binden fazla kişi hayatını kaybetti. Yerde yaklaşık 350 km uzunluğunda bir kırık açıldı.",
      },
      {
        year: 1942,
        place: "Niksar – Erbaa",
        magnitude: "Ms 7.0",
        note: "1939'dan sonra gerilim fay boyunca batıya aktarıldı; bu, o dizinin ikinci büyük depremi.",
      },
      {
        year: 1943,
        place: "Tosya – Ladik",
        magnitude: "Ms 7.2",
        note: "Orta Karadeniz'in iç kesiminde fay yaklaşık 280 kilometre boyunca kırıldı.",
      },
      {
        year: 1944,
        place: "Bolu – Gerede",
        magnitude: "Ms 7.2",
        note: "Batı Karadeniz'in iç kesiminde kırık yüzeye kadar çıktı, binalar ağır hasar gördü.",
      },
      {
        year: 1999,
        place: "Kocaeli (Gölcük)",
        magnitude: "Mw 7.4",
        note: "17 Ağustos 1999. Sanayinin yoğun olduğu Marmara'da 17 binden fazla can kaybı oldu. Fay yüzeyde 120 km boyunca kırıldı, iki yan 5,5 metreye kadar kaydı.",
      },
      {
        year: 1999,
        place: "Düzce",
        magnitude: "Mw 7.2",
        note: "12 Kasım 1999. Gölcük depremi gerilimi doğuya aktardı; 87 gün sonra o kırığın hemen doğusundaki parça kırıldı.",
      },
    ],
    seismicGapAndRisk:
      "1999 Gölcük depreminde boşalan gerilimin bir kısmı Marmara Denizi'nin altındaki kuzey parçaya aktarıldı. Prens Adaları ile Silivri açıkları arasındaki bölüm 1766'dan beri kırılmadı. Uzun süredir kırılmayan böyle parçalara sismik boşluk denir.",
    marineConnection: {
      seaName: "Marmara Denizi",
      href: "/deniz/marmara",
      description:
        "KAF'ın Marmara Denizi tabanında açtığı üç derin çukuru (Tekirdağ, Orta Marmara, Çınarcık) Marmara Denizi sayfası anlatıyor.",
    },
  },
  {
    id: "daf",
    name: "Doğu Anadolu Fay Hattı (DAF)",
    shortName: "DAF",
    type: "Sol Yanal Doğrultu Atımlı Fay",
    riskLevel: "Çok Yüksek",
    lengthKm: 550,
    badgeClass: FAULT_IDENTITY.daf.badge,
    borderClass: FAULT_IDENTITY.daf.articleEdge,
    accentColor: FAULT_IDENTITY.daf.label,
    formation:
      "Anadolu'nun güneydoğu kenarıdır ve kuzeye doğru iten Arap Levhası'nın baskısıyla oluşmuştur. Hatay'daki Antakya grabeninden ve İskenderun Körfezi'nin doğusundan başlar; Kahramanmaraş, Gölbaşı, Elazığ'daki Hazar Gölü ve Bingöl üzerinden Karlıova'da KAF ile birleşir.",
    movementMechanism:
      "Sol yanal doğrultu atım: fayın karşı tarafı sola doğru kayar. DAF, KAF'tan daha yavaş hareket eder, yılda ortalama 8-10 mm. Ama yüzyıllarca kilitli kalmış bir parçası kırıldığında çok büyük bir deprem olabilir.",
    segments: [
      {
        name: "Karlıova – Bingöl – Palu Parçası",
        detail: "İki fayın buluştuğu Karlıova'dan Murat Nehri vadisini izleyerek güneybatıya iner.",
      },
      {
        name: "Palu – Hazar Gölü – Sivrice Parçası",
        detail:
          "Elazığ'daki Hazar Gölü'nün oturduğu çukuru boydan boya geçer. 24 Ocak 2020 depreminde kırıldı ve gerilimini güneybatıya aktardı.",
      },
      {
        name: "Doğanyol – Pütürge – Erkenek Parçası",
        detail: "Malatya ile Adıyaman arasındaki dağlık bölgeyi keser.",
      },
      {
        name: "Pazarcık – Türkoğlu – Gölbaşı Parçası",
        detail:
          "6 Şubat 2023'te sabaha karşı 04:17'de olan Mw 7.7 büyüklüğündeki depremin merkez üssü bu parçadaydı.",
      },
      {
        name: "Amanos – Hatay – Samandağ Parçası",
        detail:
          "Fayın güney ucu. Amik Ovası'ndan ve Asi Nehri havzasından geçer, Ölü Deniz Fayı ile kesişir.",
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
        note: "DAF'ın güney ucunun Ölü Deniz Fayı ile kesiştiği yerde oldu. Can kaybı büyüktü, tarihi kentler ağır hasar gördü.",
      },
      {
        year: 1872,
        place: "Amik Gölü (Antakya)",
        magnitude: "Ms 7.2",
        note: "Amik Ovası'nın suya doygun zemini sıvılaştı, yani bir süre sıvı gibi davrandı; geniş alanlar çöktü.",
      },
      {
        year: 1971,
        place: "Bingöl",
        magnitude: "Ms 6.8",
        note: "Fayın kuzeydoğu ucunda oldu; yapılar ağır hasar aldı.",
      },
      {
        year: 2020,
        place: "Elazığ (Sivrice)",
        magnitude: "Mw 6.8",
        note: "Pütürge parçası kırıldı. Malatya ve Elazığ'da can kaybı oldu.",
      },
      {
        year: 2023,
        place: "Pazarcık (Kahramanmaraş)",
        magnitude: "Mw 7.7",
        note: "6 Şubat 2023, saat 04:17. DAF'ın yaklaşık 300 kilometrelik ana hattında dokuz saat arayla olan iki büyük depremin ilki. 11 ilde 53 binden fazla kişi hayatını kaybetti.",
      },
      {
        year: 2023,
        place: "Elbistan (Kahramanmaraş)",
        magnitude: "Mw 7.6",
        note: "6 Şubat 2023, saat 13:24. İlk deprem yakındaki Çardak Fayı'nı tetikledi. Bu ikincisi bir artçı değil, o fayda olan ayrı bir depremdi.",
      },
    ],
    seismicGapAndRisk:
      "6 Şubat 2023 depremleri, DAF'ın güneybatı kollarında yüzlerce yıldır biriken gerilimin büyük kısmını boşalttı. Kuzey uçtaki Yedisu Fayı (Erzincan ile Bingöl arası) ise 1784'ten beri kırılmadı; hâlâ bir sismik boşluk.",
    marineConnection: {
      seaName: "Akdeniz (İskenderun Körfezi)",
      href: "/deniz/akdeniz",
      description:
        "DAF'ın güney ucu Samandağ kıyısında denize ulaşır ve Doğu Akdeniz'de Kıbrıs Yayı'na bağlanır.",
    },
  },
  {
    id: "bafs",
    name: "Batı Anadolu Fay Sistemi (BAFS)",
    shortName: "BAFS",
    type: "Normal Faylar, Horst ve Graben",
    riskLevel: "Yüksek",
    lengthKm: 800,
    badgeClass: FAULT_IDENTITY.bafs.badge,
    borderClass: FAULT_IDENTITY.bafs.articleEdge,
    accentColor: FAULT_IDENTITY.bafs.label,
    formation:
      "Afrika Levhası, Helen Yayı boyunca Ege Denizi'nin altına dalıyor. Bunun arkasında kalan Batı Anadolu'nun yer kabuğu kuzey-güney yönünde çekiliyor ve yılda yaklaşık 30-40 milimetre esniyor. Gerilen kabuk kırılıyor: bazı bloklar yükselip dağları (horst), aralarındakiler dik fay yamaçları boyunca çöküp ovaları (graben) oluşturuyor.",
    movementMechanism:
      "Normal fay: kabuk iki yana çekildikçe fayın üstünde kalan blok (asılı blok) alttaki bloğa göre aşağı kayar. Hareketin büyük kısmı dikeydir. Yüzeyde basamak basamak fay aynaları ve dik yamaçlar oluşur, kırıklardan sıcak su çıkar.",
    segments: [
      {
        name: "Bakırçay Grabeni",
        detail:
          "Soma, Kınık ve Bergama çukurlarını izler ve Çandarlı Körfezi açıklarına kadar sürer.",
      },
      {
        name: "Gediz (Alaşehir) Grabeni",
        detail:
          "Sarıgöl, Alaşehir, Salihli ve Turgutlu boyunca Bozdağlar'ın kuzey eteğini çizer. 1969 Alaşehir depremi burada oldu.",
      },
      {
        name: "Küçük Menderes Çöküntüsü",
        detail:
          "Ödemiş, Tire ve Torbalı ovalarının kenarlarında basamak gibi dizilen normal faylar.",
      },
      {
        name: "Büyük Menderes Grabeni",
        detail:
          "Denizli'nin Sarayköy yöresinden başlayıp Nazilli, Aydın ve Söke üzerinden Ege Denizi'ne kadar uzanan, yaklaşık 150-200 km uzunluğunda bir çöküntü vadisi. Büyük Menderes Nehri bu vadiyi izler.",
      },
      {
        name: "Gökova & Muğla Fay Kuşağı",
        detail:
          "Muğla, Ula, Ören ve Bodrum Yarımadası boyunca uzanan, deniz altında süren graben fayları.",
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
        note: "Gediz grabeninde bir normal fay kaydı ve yer yüzeyinde izi görüldü.",
      },
      {
        year: 1970,
        place: "Gediz (Kütahya)",
        magnitude: "Ms 7.2",
        note: "Batı Anadolu'nun iç kesiminde oldu. Binden fazla can kaybı yaşandı.",
      },
      {
        year: 1995,
        place: "Dinar (Afyonkarahisar)",
        magnitude: "Ms 6.1",
        note: "Büyük Menderes Nehri'nin doğduğu yörede, Dinar Fayı'nda oldu. Yere yakın (sığ odaklı) bir depremdi ve yıkıma yol açtı.",
      },
      {
        year: 2017,
        place: "Bodrum – Kos",
        magnitude: "Mw 6.6",
        note: "Gökova Körfezi açığında bir normal fay kırıldı. Kıyıya küçük, yerel bir tsunami ulaştı.",
      },
      {
        year: 2020,
        place: "Sisam – İzmir",
        magnitude: "Mw 6.6",
        note: "30 Ekim 2020. Sisam Adası'nın kuzeyindeki normal fay kırıldı. 70 km uzaktaki Bayraklı ve Bornova'da, yumuşak alüvyon zemin üzerindeki binalarda ağır yıkım oldu; Seferihisar kıyısına tsunami ulaştı.",
      },
    ],
    seismicGapAndRisk:
      "BAFS, KAF gibi tek bir hat değildir; yüzlerce parçalı, birbirine paralel kırıktan oluşan bir ağdır. Bu yüzden 5.0 ile 6.5 arası orta büyüklükte depremler çok sık olur. Ovaların yumuşak alüvyon zemini sarsıntıyı büyütür, bu yüzden oradaki binalar daha büyük risk altındadır.",
    marineConnection: {
      seaName: "Ege Denizi",
      href: "/deniz/ege",
      description:
        "Graben vadilerinin Ege Denizi tabanında nasıl sürdüğünü ve kıyıyı nasıl biçimlendirdiğini Ege Denizi sayfasında okuyabilirsin.",
    },
  },
];
