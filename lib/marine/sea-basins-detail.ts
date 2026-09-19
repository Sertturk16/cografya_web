import { BASIN_IDENTITY, type BasinIdentity } from "@/lib/theme/basin-identity";

export interface SeaBasinFAQ {
  question: string;
  answer: string;
}

export interface SeaBasinDetailData {
  slug: "karadeniz" | "marmara" | "ege" | "akdeniz";
  nameTr: string;
  fullNameTr: string;
  badge: string;
  /**
   * The basin's colour, read from `lib/theme/basin-identity.ts` by `slug`.
   *
   * Three literal class fields used to sit here: `themeColor`, `gradientClass` and
   * `borderAccent`. Only `gradientClass` was ever rendered (the hero band in
   * `components/v2/v2-sea-basin-detail-view.tsx`); the other two were DEAD on all four
   * basins — declared, typed, and read nowhere. They are not bound, they are gone, because
   * binding a field nothing renders would have kept a second spelling of every basin's hue
   * alive for no surface at all.
   */
  identity: BasinIdentity;
  metrics: {
    area: string;
    maxDepth: string;
    avgDepth: string;
    salinity: string;
    coastalLengthTr: string;
    provincesCount: number;
    stationsCount: number;
  };
  stationSlugs: string[];
  coastalProvinces: { plate: string; name: string; slug: string }[];
  physicalGeography: {
    title: string;
    content: string;
    points: string[];
  };
  climateImpact: {
    title: string;
    content: string;
    points: string[];
  };
  coastalGeomorphology: {
    title: string;
    content: string;
    coastalTypes: string[];
    coastalTypesHref: string;
  };
  currentsAndWaterMovement: {
    title: string;
    content: string;
    keyPoints: string[];
  };
  hydrographicBalance: {
    title: string;
    content: string;
    majorRivers: string[];
  };
  economicGeography: {
    title: string;
    content: string;
    sectors: { name: string; desc: string }[];
  };
  humanGeography: {
    title: string;
    content: string;
    points: string[];
  };
  environmentalIssues: {
    title: string;
    content: string;
    risks: string[];
  };
  faultLineNotice?: {
    text: string;
    href: string;
  };
  faq: SeaBasinFAQ[];
}

export const SEA_BASINS_DETAIL: Record<
  "karadeniz" | "marmara" | "ege" | "akdeniz",
  SeaBasinDetailData
> = {
  karadeniz: {
    slug: "karadeniz",
    nameTr: "Karadeniz",
    fullNameTr: "Karadeniz Havzası",
    badge: "Okyanusal Karakterli Kapalı Deniz",
    identity: BASIN_IDENTITY.karadeniz,
    metrics: {
      area: "436.400 km²",
      maxDepth: "2.212 m",
      avgDepth: "1.253 m",
      salinity: "%o17 – %o18 (En Düşük)",
      coastalLengthTr: "1.695 km",
      provincesCount: 15,
      stationsCount: 15,
    },
    stationSlugs: [
      "kirklareli",
      "istanbul-karadeniz",
      "kocaeli-karadeniz",
      "sakarya",
      "duzce",
      "zonguldak",
      "bartin",
      "kastamonu",
      "sinop",
      "samsun",
      "ordu",
      "giresun",
      "trabzon",
      "rize",
      "artvin",
    ],
    coastalProvinces: [
      { plate: "39", name: "Kırklareli", slug: "kirklareli" },
      { plate: "34", name: "İstanbul (Şile/Kilyos)", slug: "istanbul" },
      { plate: "41", name: "Kocaeli (Kandıra)", slug: "kocaeli" },
      { plate: "54", name: "Sakarya (Karasu)", slug: "sakarya" },
      { plate: "81", name: "Düzce (Akçakoca)", slug: "duzce" },
      { plate: "67", name: "Zonguldak", slug: "zonguldak" },
      { plate: "74", name: "Bartın (Amasra)", slug: "bartin" },
      { plate: "37", name: "Kastamonu (Cide)", slug: "kastamonu" },
      { plate: "57", name: "Sinop", slug: "sinop" },
      { plate: "55", name: "Samsun", slug: "samsun" },
      { plate: "52", name: "Ordu", slug: "ordu" },
      { plate: "28", name: "Giresun", slug: "giresun" },
      { plate: "61", name: "Trabzon", slug: "trabzon" },
      { plate: "53", name: "Rize", slug: "rize" },
      { plate: "08", name: "Artvin (Hopa)", slug: "artvin" },
    ],
    physicalGeography: {
      title: "Fiziki Coğrafya & Havza Morfolojisi",
      content:
        "Karadeniz, jeolojik olarak Tetis Okyanusu'nun kuzey kalıntısı olan Paratetis Denizi'nin zamanla kıtalar arasında sıkışarak izole olmasıyla meydana gelmiş büyük bir çöküntü çanağıdır. Üçüncü ve Dördüncü Zaman boyunca tatlı su gölü ile tuzlu deniz evreleri arasında gidip gelmiş, yaklaşık 7.500 yıl önce Boğazlar'ın açılmasıyla bugünkü Akdeniz bağlantısına kavuşmuştur. Taban topoğrafyası son derece dik bir şelf yamacıyla hızla 2.000 metrenin üzerindeki abisal düzlüğe iner. En derin noktası orta kesimde 2.212 metredir.",
      points: [
        "Kıta sahanlığı (şelf alanı) Orta Karadeniz (Samsun deltaları) hariç son derece dardır.",
        "Kıyının hemen ardından yükselen Kuzey Anadolu Dağları nedeniyle deniz aniden derinleşir.",
        "200 metrenin altındaki su katmanı oksijensizdir (anoksik) ve hidrojen sülfür (H2S) gazıyla doygundur.",
      ],
    },
    climateImpact: {
      title: "İklime Etkisi & Yağış Dinamiği",
      content:
        "Karadeniz, kuzeyinden gelen soğuk Sibirya ve kutupsal hava kütlelerini bünyesindeki su buharıyla ılımanlaştırır. Deniz üzerinden nem yüklenen hava kütleleri kıyıya paralel uzanan Kuzey Anadolu Dağları'nın kuzey yamaçlarına çarparak yükselir ve soğur; bunun sonucunda Türkiye'nin en yüksek orografik (yamaç) yağışları oluşur (Rize'de yıllık 2.300 mm'yi aşar). Bu mekanizma Karadeniz kıyı kuşağında her mevsimi yağışlı, yıllık sıcaklık farkı en az olan Karadeniz (Ilıman Okyanusal) İklimi'ni doğurur.",
      points: [
        "Kış mevsiminde karaların aşırı soğumasını engelleyerek kıyı kuşağında don olaylarını sınırlandırır.",
        "Yaz mevsiminde aşırı kuraklığı önleyerek Türkiye'nin tek kurak mevsimi olmayan iklim kuşağını besler.",
        "Dağların yüksekliği denizel etkinin İç Anadolu'ya geçmesini engelleyerek iç kısımları karasallaştırır.",
      ],
    },
    coastalGeomorphology: {
      title: "Kıyı Tipi & Kıyı Şekilleri",
      content:
        "Karadeniz'in Türkiye kıyılarında baskın kıyı tipi Boyuna Kıyı Tipi'dir. Dağlar kıyıya paralel uzandığı için kıyı çizgisi düz ve falezlidir. İstisna olarak Samsun kıyılarında Kızılırmak ve Yeşilırmak nehirlerinin getirdiği alüvyonlarla Bafra ve Çarşamba deltaları oluşmuştur. Sinop'ta ise bir tombolo (saplı ada) oluşumuyla Türkiye'nin tek doğal korunaklı limanı meydana gelmiştir.",
      coastalTypes: [
        "Boyuna Kıyı Tipi",
        "Delta Kıyıları (Bafra & Çarşamba)",
        "Tombolo (Sinop İnceburun)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Akıntı Sistemi & Su Hareketi",
      content:
        "Karadeniz'de ana akıntı sistemi saat yönünün tersine (siklonik) dönen dev bir halka akıntısıdır (Rim Current / Kenar Akıntısı). Bu siklonik döngü Gürcistan kıyılarından Türkiye'nin Doğu Karadeniz sahiline girer ve Sinop Burnu üzerinden batıya Boğazlar'a doğru ilerler. İkincil olarak, bol nehir girdisi ve düşük buharlaşma nedeniyle Karadeniz'in su seviyesi Marmara'dan yaklaşık 30-40 cm daha yüksektir; bu seviye farkı İstanbul Boğazı üzerinden Marmara'ya akan güçlü yüzey akıntısını doğurur.",
      keyPoints: [
        "Rim Current (Kenar Akıntısı): Türkiye kıyılarında doğudan batıya doğru saat yönünün tersine akar.",
        "İstanbul Boğazı Üst Akıntısı: Karadeniz'in seviye fazlasını Marmara ve Ege'ye boşaltır.",
        "Dikey karışımın olmaması: İlk 150-200 metredeki az tuzlu hafif su katmanı, alttaki ağır ve H2S'li tabakanın yukarı çıkmasını engeller.",
      ],
    },
    hydrographicBalance: {
      title: "Beslenme Kaynakları & Hidrografik Bilanço",
      content:
        "Karadeniz, yüzölçümüne oranla dünyanın en geniş nehir beslenme havzalarından birine sahiptir. Avrupa'nın ikinci büyük nehri olan Tuna Nehri başta olmak üzere Dinyester, Dinyeper, Don nehri ve Türkiye'den dökülen Kızılırmak, Yeşilırmak, Sakarya ve Çoruh nehirleri her yıl Karadeniz'e yaklaşık 350 milyar metreküp tatlı su pompalar. Buharlaşmanın yağış ve nehir girdisinden az olması, deniz suyunu seyreltir ve tuzluluğu binde 17-18 seviyesinde tutar.",
      majorRivers: [
        "Tuna Nehri (Avrupa)",
        "Dinyeper & Dinyester",
        "Kızılırmak (1.355 km)",
        "Yeşilırmak",
        "Sakarya Nehri",
        "Çoruh Nehri",
      ],
    },
    economicGeography: {
      title: "Ekonomik Coğrafya: Balıkçılık & Ulaşım",
      content:
        "Karadeniz, Türkiye deniz balıkçılığı üretiminin yaklaşık yüzde yetmişini (%70) tek başına karşılar. Nehirlerin taşıdığı bol mineral ve besin tuzu sayesinde üst 100 metrelik yüzey katmanı plankton açısından olağanüstü zengindir; bu da başta hamsi, çaça, palamut ve istavrit olmak üzere muazzam pelajik balık sürülerini besler. Kıyı illerinde limancılık (Filyos Limanı, Samsun, Trabzon) Kafkasya ve Orta Asya transit ticaretinde kilit roldedir.",
      sectors: [
        {
          name: "Balıkçılık",
          desc: "Türkiye hamsi ve küçük pelajik balık avcılığının tartışmasız merkezi.",
        },
        {
          name: "Liman & Lojistik",
          desc: "Samsun, Trabzon, Filyos ve Hopa limanları üzerinden Karadeniz Havzası ticareti.",
        },
        {
          name: "Enerji & Maden",
          desc: "Sakarya Gaz Sahası açık deniz doğal gaz üretim platformları.",
        },
      ],
    },
    humanGeography: {
      title: "Nüfus & Kıyı Yerleşme Dokusu",
      content:
        "Kuzey Anadolu Dağları'nın hemen deniz kıyısından dik yükselmesi, tarım arazilerini ve yerleşilebilir düzlükleri kıyıda daracık bir şeride sıkıştırmıştır. Bu jeomorfolojik kısıt nedeniyle Karadeniz Bölgesi'nde şehir merkezleri ve nüfusun yüzde sekseni kıyı çizgisi boyunca dizilmiştir (Trabzon, Rize, Giresun, Ordu). Kırsal kesimde ise arazi eğimi ve su kaynaklarının bolluğu Türkiye'nin en karakteristik 'dağınık kır yerleşmesi' dokusunu ortaya çıkarmıştır.",
      points: [
        "Şehir merkezleri ve sanayi tesisleri kıyı dolgu alanları ve vadi tabanlarına yığılmıştır.",
        "Karadeniz Sahil Yolu kıyı boyunca ulaşımı sağlarken doğal kıyı çizgisinde antropojenik değişim yaratmıştır.",
        "Kıyı gerisindeki dik yamaçlarda çay ve fındık monokültür tarımı yerleşme düzenini şekillendirir.",
      ],
    },
    environmentalIssues: {
      title: "Çevre Sorunları & Ekolojik Tehditler",
      content:
        "Karadeniz'in en büyük ekolojik açmazı, 200 metrenin altındaki su hacminin yüzde doksanının (%90) hidrojen sülfür gazı nedeniyle biyolojik olarak ölü olmasıdır. Canlı yaşam yalnızca üstteki incecik yüzey kabuğuna sıkışmıştır. Bu kırılgan yapı; Tuna gibi devasa uluslararası nehirlerin taşıdığı tarımsal nitrat ve endüstriyel atıklarla (ötrofikasyon), aşırı ve kontrolsüz avcılıkla ve balast sularıyla gelen istilacı türlerle (taraklı denizanası Mnemiopsis leidyi) ciddi tehdit altındadır.",
      risks: [
        "H2S Sınırı: Oksijensiz tabakanın aşırı kirlilikle yukarı doğru yükselme riski.",
        "Tarımsal Ötrofikasyon: Nehirlerden gelen aşırı fosfat ve nitrat nedeniyle alg patlamaları ve oksijen tükenmesi.",
        "Kıyı Erozyonu ve Aşırı Avlanma: Hamsi stoklarının biyolojik taşıma kapasitesinin zorlanması.",
      ],
    },
    faq: [
      {
        question: "Karadeniz'in 200 metre altında neden canlı yaşamaz?",
        answer:
          "Karadeniz'e dökülen bol tatlı su yüzeyde hafif bir katman oluştururken, dipte Boğazlar'dan gelen yoğun tuzlu Akdeniz suyu bulunur. Bu iki su kütlesi yoğunluk farkı yüzünden birbirine karışamaz (kalıcı piknoklin). Yüzeydeki oksijen dibe inemez; dipteki organik artıklar oksijensiz bakterilerce parçalanırken zehirli hidrojen sülfür (H2S) gazı açığa çıkar.",
      },
      {
        question: "Karadeniz neden Türkiye'nin en az tuzlu denizidir?",
        answer:
          "Tuna, Dinyeper, Dinyester ve Kızılırmak gibi dev nehirlerin havuza sürekli tatlı su taşıması ve bölgenin bulutlu, nemli ve serin havası nedeniyle buharlaşmanın düşük olması deniz suyunun tuzluluğunu binde 17-18 seviyesinde tutar.",
      },
      {
        question: "Karadeniz'de neden falez oluşumu çok yaygındır?",
        answer:
          "Kuzey Anadolu sıradağları kıyıya paralel ve dik bir yamaçla indiği için deniz aniden derinleşir. Açık denizden gelen yüksek enerjili fırtına dalgaları sığlaşmadan dağ eteklerine çarparak yamacın altını oyar; üstteki kütlelerin göçmesiyle dik kıyı uçurumları (falez/yalıyar) oluşur.",
      },
    ],
  },
  marmara: {
    slug: "marmara",
    nameTr: "Marmara Denizi",
    fullNameTr: "Marmara Denizi Havzası",
    badge: "Türkiye'nin Jeolojik İç Denizi",
    identity: BASIN_IDENTITY.marmara,
    metrics: {
      area: "11.350 km²",
      maxDepth: "1.370 m (Çınarcık Çukuru)",
      avgDepth: "289 m",
      salinity: "%o22 (Yüzey) / %o38 (Dip)",
      coastalLengthTr: "927 km",
      provincesCount: 7,
      stationsCount: 6,
    },
    stationSlugs: [
      "canakkale-marmara",
      "tekirdag",
      "balikesir-marmara",
      "istanbul-marmara",
      "bursa",
      "yalova",
    ],
    coastalProvinces: [
      { plate: "34", name: "İstanbul (Marmara)", slug: "istanbul" },
      { plate: "41", name: "Kocaeli (Gebze/Körfez)", slug: "kocaeli" },
      { plate: "77", name: "Yalova", slug: "yalova" },
      { plate: "16", name: "Bursa (Mudanya/Gemlik)", slug: "bursa" },
      { plate: "10", name: "Balıkesir (Bandırma/Erdek)", slug: "balikesir" },
      { plate: "17", name: "Çanakkale (Biga/Gelibolu)", slug: "canakkale" },
      { plate: "59", name: "Tekirdağ", slug: "tekirdag" },
    ],
    physicalGeography: {
      title: "Fiziki Coğrafya & Taban Tektoniği",
      content:
        "Marmara Denizi, tamamı Türkiye'nin egemenlik sınırları içinde yer alan jeolojik bir 'iç deniz'dir. Kuzey Anadolu Fay Hattı'nın (KAF) batı uzantısının çek-ayır (pull-apart) tektoniğiyle kabuğu yırtıp çökertmesi sonucunda oluşmuştur. Bu tektonik köken nedeniyle sığ kıyı şelflerinin ortasında doğu-batı doğrultusunda sıralanan 3 derin tektonik çukur bulunur: Tekirdağ Çukuru (1.112 m), Orta Marmara Çukuru (1.220 m) ve Çınarcık Çukuru (1.370 m).",
      points: [
        "Kuzey Anadolu Fayı'nın ana kolu deniz tabanındaki bu 3 derin çukurluğu boydan boya kat eder.",
        "İstanbul ve Çanakkale Boğazları ria tipi su yolları ile Karadeniz ve Ege'yi birbirine bağlar.",
        "Güneyde Kapıdağ Yarımadası ve Marmara Adaları karmaşık bir jeomorfolojik topoğrafya sunar.",
      ],
    },
    climateImpact: {
      title: "İklime Etkisi & Geçiş Karakteri",
      content:
        "Marmara Denizi, çevresinde Karadeniz, Akdeniz ve Karasal iklim tiplerinin birbiriyle kaynaştığı 'Marmara Geçiş İklimi'ni dengeler. Küçük bir su kütlesi olmasına rağmen kışın kuzeyden inen soğuk hava kütlelerini yumuşatır; yaz aylarında ise güneyden gelen tropikal sıcaklıkları deniz meltemleriyle törpüler. Etrafındaki Trakya platosu ve Güney Marmara ovalarında zeytin gibi Akdeniz bitkilerinin yetişebilmesini sağlayan mikroklimayı besler.",
      points: [
        "Kışın Balkanlar üzerinden gelen soğuk hava kütlelerinin kıyı boyunca don şiddetini azaltır.",
        "Buharlaşma oranı Karadeniz'den yüksek, Ege ve Akdeniz'den düşüktür.",
        "Yıl genelinde kuzeydoğudan esen poyraz ve güneybatıdan esen lodos fırtınalarının denizel termal etkisi belirgindir.",
      ],
    },
    coastalGeomorphology: {
      title: "Kıyı Tipi & Yer Şekilleri",
      content:
        "Marmara kıyılarında karmaşık kıyı şekilleri bir arada bulunur. İstanbul ve Çanakkale boğazlarında boğulmuş akarsu vadileri olan Ria Kıyı Tipi; kuzeyde Büyükçekmece, Küçükçekmece ve Terkos çevresinde Limanlı / Lagün Kıyı Tipi; güneyde Balıkesir kıyısında eski bir adanın dalga biriktirmesiyle karaya bağlanmasıyla oluşan Kapıdağ Tombolosu (saplı ada) Türkiye'nin en tipik örnekleridir.",
      coastalTypes: [
        "Ria Kıyı Tipi (Boğazlar)",
        "Lagün & Limanlı Kıyı Tipi (Çekmece Gölleri)",
        "Tombolo (Kapıdağ Yarımadası)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Akıntı Sistemi: İki Tabakalı Zıt Sirkülasyon",
      content:
        "Marmara Denizi, oşinografide iki zıt akıntı tabakasının üst üste aktığı dünyadaki en özgün hidrolojik laboratuvardır. Yüzeyde Karadeniz'in seviye fazlalığından kaynaklanan az tuzlu (%o22) ve hafif sular güneybatıya Ege'ye doğru akar. Dipte ise (yaklaşık 25 metrenin altında) Akdeniz ve Ege'nin yüksek tuzlu (%o38) ve ağır suları Çanakkale Boğazı'ndan girerek kuzeydoğuya Karadeniz'e doğru ilerler.",
      keyPoints: [
        "Üst Akıntı: Karadeniz'den Ege'ye yüzey akıntısı (seviye/kot farkı ~30-40 cm).",
        "Alt Akıntı: Ege'den Karadeniz'e dip akıntısı (yoğunluk ve tuzluluk farkı).",
        "Termoklin & Haloklin: 20-25 metre derinlikte iki farklı su kütlesini ayıran keskin geçiş tabakası.",
      ],
    },
    hydrographicBalance: {
      title: "Beslenme Kaynakları & Akarsu Dengesi",
      content:
        "Marmara'ya dökülen karasal akarsu debisi küçüktür; en büyük akarsuyu Güney Marmara'dan dökülen Susurluk (Simav) Çayı ve Gönen Çayı'dır. Havzanın asıl hidrolojik girdisi karasal nehirlerden değil, İstanbul Boğazı üzerinden Karadeniz'den boşalan devasa yüzey suyudur. Bu durum Marmara'nın su bütçesini doğrudan Karadeniz havzasının iklimsel koşullarına bağımlı kılar.",
      majorRivers: ["Susurluk (Simav) Çayı", "Gönen Çayı", "Biga Çayı", "Nilüfer Çayı"],
    },
    economicGeography: {
      title: "Ekonomik Coğrafya: Sanayi, Limanlar & Boğaz Geçişi",
      content:
        "Marmara Denizi, Türkiye ekonomisinin ve sanayi üretiminin omurgasıdır. Kocaeli, İstanbul ve Bursa sanayi havzalarını dünya pazarlarına bağlayan Ambarlı Limanı, İzmit Körfez Limanları (Kocaeli Port), Gemlik ve Bandırma limanları Türkiye'nin konteyner ve otomotiv ihracatının merkezidir. Aynı zamanda Türk Boğazları Deniz Trafik Düzeni ile Karadeniz ülkelerinin dünya okyanuslarına açılan tek ve alternatifsiz uluslararası deniz ticaret yoludur.",
      sectors: [
        {
          name: "Deniz Ticareti & Lojistik",
          desc: "Ambarlı, İzmit Körfezi ve Gemlik konteyner ve dökme yük limanları.",
        },
        {
          name: "Uluslararası Boğaz Transit Geçişi",
          desc: "Montrö Boğazlar Sözleşmesi çerçevesinde yılda 40 binden fazla gemi geçişi.",
        },
        {
          name: "Balıkçılık",
          desc: "Göçmen balıkların (lüfer, palamut) boğaz koridorundaki mevsimsel avcılığı.",
        },
      ],
    },
    humanGeography: {
      title: "Nüfus & Metropoliten Yığılma",
      content:
        "Marmara kıyıları Türkiye nüfusunun dörtte birinden fazlasını (yaklaşık 25 milyon insanı) barındırır. İstanbul megapolü başta olmak üzere Kocaeli, Tekirdağ, Bursa ve Yalova kıyı şeridi sanayileşme, finans ve lojistiğin odak noktasıdır. Bu yoğun yerleşim kıyı topoğrafyasının neredeyse tamamını insan eliyle değiştirmiş, limanlar, dolgu alanları ve tersanelerle kaplamıştır.",
      points: [
        "Türkiye'nin en yoğun nüfuslu ve en yüksek kentleşme oranına sahip kıyı havzasıdır.",
        "Kıyı boyunca yerleşen ağır sanayi tesisleri ve tersaneler deniz ekosistemi üzerinde baskı oluşturur.",
        "Adalar ve güney kıyıları (Erdek, Çınarcık) metropolün dinlenme ve rekreasyon alanlarıdır.",
      ],
    },
    environmentalIssues: {
      title: "Çevre Sorunları: Müsilaj & Kentsel Atık Baskısı",
      content:
        "Marmara Denizi'nin iki tabakalı kapalı su yapısı, dip ve yüzey arasındaki oksijen transferini doğal olarak sınırlandırır. Bu hassas dengeye çevresindeki 25 milyonluk kentsel nüfusun ve yoğun sanayi tesislerinin evsel ve endüstriyel atıklarının arıtılmadan veya yetersiz arıtılarak deşarj edilmesi eklenince deniz aşırı besin tuzu (azot ve fosfor) yüklenmesine uğramıştır. Bunun en çarpıcı sonucu 2021 yılında tüm denizi kaplayan ve deniz tabanındaki biyoçeşitliliği boğan kitlesel 'müsilaj' (deniz salyası) felaketi olmuştur.",
      risks: [
        "Müsilaj (Deniz Salyası): Aşırı kirlilik ve deniz suyu sıcaklık artışıyla fitoplankton patlaması.",
        "Dip Suyu Oksijensizliği: Derin çukurluklarda oksijen oranının hipoksik sınırlara inmesi.",
        "Gemi Trafiği ve Balast Kirliliği: Sintine, balast ve petrol türevi kirlilik riskleri.",
      ],
    },
    faultLineNotice: {
      text: "Marmara Denizi tabanından geçen Kuzey Anadolu Fay Hattı (KAF) ve sismik boşluklar hakkında detaylı jeolojik analiz için:",
      href: "/deprem/fay-hatlari",
    },
    faq: [
      {
        question: "Marmara Denizi'ndeki iki zıt akıntının sebebi nedir?",
        answer:
          "İki temel neden vardır: (1) Seviye farkı: Karadeniz bol nehirle beslendiği için Marmara'dan 30-40 cm daha yüksektir ve yüzeyden güneye doğru akar. (2) Yoğunluk farkı: Akdeniz daha sıcak ve tuzlu olduğu için suları ağırdır; dip kısımdan Karadeniz'e doğru ilerler.",
      },
      {
        question: "Müsilaj (deniz salyası) neden sadece Marmara'da felakete dönüştü?",
        answer:
          "Marmara'nın iki tabakalı durağan hidrolojik yapısı dikey su sirkülasyonunu engeller. Karadeniz'den gelen organik yük ile çevredeki 25 milyonluk nüfus ve sanayi atıklarının azot-fosfor girdisi birleştiğinde, fitoplankton türleri aşırı çoğalarak stres ortamında mukus (müsilaj) salgılamıştır.",
      },
      {
        question: "Marmara Denizi tabanında neden 1.000 metreyi aşan çukurlar vardır?",
        answer:
          "Kuzey Anadolu Fayı'nın doğrultu atımlı kolları Marmara Denizi altından geçerken gerilme faylarıyla kabuğu birbirinden ayırmış (çek-ayır tektoniği); bu faylanma sonucunda Tekirdağ, Orta Marmara ve Çınarcık çukurlukları çökmüştür.",
      },
    ],
  },
  ege: {
    slug: "ege",
    nameTr: "Ege Denizi",
    fullNameTr: "Ege Denizi (Adalar Denizi) Havzası",
    badge: "Enine Kıyı & Geniş Şelf Denizi",
    identity: BASIN_IDENTITY.ege,
    metrics: {
      area: "214.000 km²",
      maxDepth: "2.561 m",
      avgDepth: "350 m",
      salinity: "%o33 – %o37",
      coastalLengthTr: "2.805 km (Adalar hariç)",
      provincesCount: 5,
      stationsCount: 5,
    },
    stationSlugs: ["canakkale-ege", "balikesir-ege", "izmir", "aydin", "mugla"],
    coastalProvinces: [
      { plate: "17", name: "Çanakkale (Ege/Bozcaada)", slug: "canakkale" },
      { plate: "10", name: "Balıkesir (Ayvalık/Edremit)", slug: "balikesir" },
      { plate: "35", name: "İzmir (Çeşme/Karaburun)", slug: "izmir" },
      { plate: "09", name: "Aydın (Kuşadası/Didim)", slug: "aydin" },
      { plate: "48", name: "Muğla (Bodrum/Datça)", slug: "mugla" },
    ],
    physicalGeography: {
      title: "Fiziki Coğrafya & Horst-Graben Morfolojisi",
      content:
        "Ege Denizi, jeolojik geçmişte 'Egeid Karası' adı verilen kara kütlesinin Üçüncü Zaman sonlarında ve Dördüncü Zaman başında tektonik kırılmalarla çökmesi ve Akdeniz sularının bu çöküntüyü basmasıyla oluşmuş yarı kapalı bir denizdir. Su üstünde kalan yüksek dağ zirveleri yüzlerce Ege adasını meydana getirmiştir. Batı Anadolu'daki dağ sıraları denize dik uzandığı için deniz tabanı graben vadileri boyunca içeri sokulur; kıta sahanlığı (şelf) Türkiye'nin en geniş bölgesidir. Kuzeyde Saros Çukuru ve güneyde Girit yayı açıkları derin çukurluklara sahiptir.",
      points: [
        "Enine kıyı tipi hâkimdir; dağlar kıyıya dik uzanır.",
        "Kıta sahanlığı geniş olup kıyıdan onlarca deniz mili açığa kadar sığ deniz tabanı devam eder.",
        "Yüzlerce koy, körfez, yarımada ve doğal liman ile Türkiye'nin en girintili çıkıntılı kıyısıdır.",
      ],
    },
    climateImpact: {
      title: "İklime Etkisi & İç Kesimlere Sokulma",
      content:
        "Ege Denizi'nin iklim üzerindeki en belirleyici rolü, dağların denize dik uzanması sayesinde denizel nemli ılıman Akdeniz ikliminin iç kesimlere rahatça girmesine olanak tanımasıdır. Bakırçay, Gediz, Küçük Menderes ve Büyük Menderes graben vadileri adeta birer iklim kanalı görevi görerek deniz etkisini kıyıdan 150-200 kilometre içeriye (Manisa, Denizli, Uşak sınırlarına) kadar taşır. Yaz aylarında kuzeyden esen kuru ve serinletici 'etezyen' rüzgârları Ege kıyılarının sıcaklık dengesini sağlar.",
      points: [
        "Kıyı ile iç kesimler arasında iklim ve bitki örtüsü keskin bir sınırla ayrılmaz; yumuşak geçiş vardır.",
        "Etezyen rüzgârları yazın açık denizde dalga boyunu artırırken kıyılarda bunaltıcı nemi dağıtır.",
        "Kışlar ılık ve yağışlı, yazlar sıcak ve kurak Akdeniz iklim rejimi hâkimdir.",
      ],
    },
    coastalGeomorphology: {
      title: "Kıyı Tipi & Yer Şekilleri",
      content:
        "Ege Denizi kıyıları Türkiye'de Enine Kıyı Tipi'nin dünyadaki en belirgin temsilcisidir. Gerçek kıyı uzunluğu (girinti ve çıkıntılar dahil) ile kuş uçuşu mesafe arasındaki fark en fazladır. Graben çöküntülerinin ağzında Edremit, Çandarlı, İzmir, Kuşadası, Güllük ve Gökova körfezleri açılırken; horst dağ kütleleri denize doğru Karaburun, Çeşme, Dilek ve Datça yarımadaları şeklinde sokulur. Gediz ve Büyük Menderes nehirleri ağızlarında devasa delta ovaları oluşturmuştur.",
      coastalTypes: [
        "Enine Kıyı Tipi",
        "Geniş Körfezler & Yarımadalar",
        "Delta Kıyıları (Gediz, Balat Deltaları)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Akıntı Sistemi: Boğaz Suyu & Akdeniz Döngüsü",
      content:
        "Ege Denizi'nin hidrodinamik yapısını iki ana su kütlesi belirler. Çanakkale Boğazı'ndan çıkan Karadeniz kökenli az tuzlu ve serin su kütlesi Ege'nin batı kıyısı boyunca (Yunanistan tarafı) güneye doğru akar. Buna karşılık Doğu Akdeniz'den gelen sıcak ve yüksek tuzlu su kütlesi Anadolu'nun batı kıyısı (Türkiye tarafı) boyunca kuzeye doğru tırmanır. Bu iki zıt hareket Ege genelinde saat yönünün tersine dönen geniş bir termohalin döngü meydana getirir.",
      keyPoints: [
        "Kuzey Ege ve Boğaz çıkışı: Karadeniz suyunun etkisiyle tuzluluk görece düşüktür (%o33).",
        "Güney Ege: Akdeniz suyunun hâkimiyetiyle tuzluluk %o38'e yaklaşır.",
        "Karmaşık ada ve boğaz topoğrafyası yerel güçlü anaforlar ve girdaplar üretir.",
      ],
    },
    hydrographicBalance: {
      title: "Beslenme Kaynakları & Akarsular",
      content:
        "Ege Denizi Türkiye kıyılarından dökülen büyük graben nehirleriyle beslenir: Bakırçay, Gediz Nehri, Küçük Menderes ve Büyük Menderes nehirleri yüksek miktarda alüvyon taşır. Bu nehirlerin taşıdığı alüvyonlar tarihi çağlarda liman kentlerini (Efes ve Milet) denizden kilometrelerce içeride bırakacak kadar güçlü biriktirme yapmıştır. Ancak yaz aylarındaki şiddetli buharlaşma nedeniyle deniz suyu tuzluluğu Karadeniz ve Marmara'dan çok daha yüksektir.",
      majorRivers: [
        "Büyük Menderes (548 km)",
        "Gediz Nehri (401 km)",
        "Küçük Menderes (175 km)",
        "Bakırçay (129 km)",
      ],
    },
    economicGeography: {
      title: "Ekonomik Coğrafya: Turizm, Yatçılık & Limanlar",
      content:
        "Ege kıyıları Türkiye'nin deniz turizmi, mavi yolculuk ve yatçılık başkentidir. Bodrum, Çeşme, Kuşadası, Datça ve Ayvalık koyları doğal korunaklı marinalarıyla uluslararası yat turizminin odak noktasıdır. İzmir Alsancak ve Aliağa limanları Ege Bölgesi'nin sanayi ve tarım ihracat kapısıdır. Ayrıca korunaklı koylar Türkiye kültür balıkçılığının (çipura ve levrek yetiştiriciliği) yüzde yetmişini barındırır.",
      sectors: [
        {
          name: "Yat & Deniz Turizmi",
          desc: "Mavi yolculuk rotaları, marinalar ve zengin koy turizmi.",
        },
        {
          name: "Kültür Balıkçılığı",
          desc: "Muğla ve İzmir kıyılarında çipura ve levrek kafes çiftlikleri.",
        },
        {
          name: "Liman & Sanayi",
          desc: "Aliağa petrokimya limanı ve İzmir Alsancak ihracat kapısı.",
        },
      ],
    },
    humanGeography: {
      title: "Nüfus & Yerleşme İlişkisi",
      content:
        "Ege kıyılarında topoğrafya yerleşmeyi Karadeniz gibi dar bir şeride hapsetmez. Graben ovaları boyunca verimli tarım alanları, turizm merkezleri ve sanayi tesisleri iç kesimlere doğru dengeli bir şekilde yayılmıştır. Türkiye'nin üçüncü büyük kenti olan İzmir metropolü körfez etrafında büyümüştür. Yaz aylarında turizme bağlı olarak Muğla ve Aydın kıyılarındaki yerel nüfus kış nüfusunun beş ila on katına çıkar.",
      points: [
        "Graben vadileri boyunca kıyı ile iç kesimler arasında güçlü ulaşım ve ticaret ağları kurulmuştur.",
        "Muğla ve Aydın kıyıları mevsimlik turizm göçünün en yoğun yaşandığı alandır.",
        "Tarih boyunca kurulan antik liman kentleri zengin kıyı coğrafyasının mirasıdır.",
      ],
    },
    environmentalIssues: {
      title: "Çevre Sorunları: Kıyı Baskısı & Kapalı Körfezler",
      content:
        "Ege Denizi'nin en büyük çevre sorunu, dar ve sığ iç körfezlerdeki (özellikle İzmir Körfezi ve Çandarlı Körfezi) sanayi ve evsel atık birikimidir. Kapalı körfezlerde su sirkülasyonunun zayıf olması dönemsel alg patlamalarına ve deniz kokusuna yol açabilir. Ayrıca kıyı şeridindeki aşırı ikinci konut ve betonlaşma baskısı, lagün ekosistemlerini ve caretta caretta üreme alanlarını tehdit etmektedir.",
      risks: [
        "İç Körfez Kirliliği: İzmir Körfezi'nde sığlaşma, koku ve su kalitesi sorunları.",
        "Aşırı Kıyı Yapılaşması: Doğal koyların ve sulak alanların turizm baskısıyla tahribi.",
        "Kültür Balıkçılığı Atıkları: Yetersiz akıntılı koylardaki balık çiftliklerinin organik yükü.",
      ],
    },
    faultLineNotice: {
      text: "Batı Anadolu Fay Sistemi (BAFS) ve Ege graben tektoniği hakkında detaylı sismik analiz için:",
      href: "/deprem/fay-hatlari",
    },
    faq: [
      {
        question: "Ege Denizi kıyıları neden Türkiye'nin en uzun kıyı şerididir?",
        answer:
          "Dağların denize dik uzanması (enine kıyı tipi) sonucunda yüzlerce koy, körfez, burun ve yarımada meydana gelmiştir. Bu olağanüstü girinti-çıkıntı kıyı çizgisini uzatarak gerçek kıyı uzunluğunu 2.800 kilometrenin üzerine çıkarır.",
      },
      {
        question: "Ege kıyılarında deniz etkisi neden iç kesimlere kadar ulaşır?",
        answer:
          "Karadeniz ve Akdeniz'deki gibi kıyıya paralel sıradağlar yoktur. Dağlar kıyıya diktir ve aralarındaki Bakırçay, Gediz, Menderes graben vadileri denizel ılıman havanın 150-200 km içeriye kolayca sokulmasını sağlar.",
      },
      {
        question: "Ege Denizi'nin su sıcaklığı ve tuzluluğu nasıl dağılır?",
        answer:
          "Kuzey Ege'de Çanakkale Boğazı'ndan çıkan az tuzlu ve serin Karadeniz suları etkilidir. Güneye Muğla ve Rodos açıklarına inildikçe Akdeniz suyu baskın hale gelir; sıcaklık ve tuzluluk belirgin şekilde yükselir.",
      },
    ],
  },
  akdeniz: {
    slug: "akdeniz",
    nameTr: "Akdeniz",
    fullNameTr: "Doğu Akdeniz Havzası",
    badge: "En Sıcak & En Tuzlu Denizimiz",
    identity: BASIN_IDENTITY.akdeniz,
    metrics: {
      area: "2.500.000 km² (Tüm Havza)",
      maxDepth: "5.267 m (Calypso Çukuru)",
      avgDepth: "1.500 m",
      salinity: "%o38 – %o39 (En Tuzlu)",
      coastalLengthTr: "1.577 km (Türkiye Kıyısı)",
      provincesCount: 4,
      stationsCount: 4,
    },
    stationSlugs: ["antalya", "mersin", "adana", "hatay"],
    coastalProvinces: [
      { plate: "07", name: "Antalya (Alanya/Kaş)", slug: "antalya" },
      { plate: "33", name: "Mersin (Silifke/Anamur)", slug: "mersin" },
      { plate: "01", name: "Adana (Karataş/Yumurtalık)", slug: "adana" },
      { plate: "31", name: "Hatay (Samandağ/İskenderun)", slug: "hatay" },
    ],
    physicalGeography: {
      title: "Fiziki Coğrafya & Levha Sınırı Tektoniği",
      content:
        "Akdeniz, jeolojik olarak eski Tetis Okyanusu'nun ana gövdesidir. Afrika Levhası'nın kuzeye doğru Anadolu ve Avrasya levhalarının altına daldığı aktif bir dalma-batma zonu (Helen-Kıbrıs Yayı) üzerinde yer alır. Türkiye kıyıları boyunca yükselen Toros Sıradağları denize paralel bir duvar gibi uzanır. Bu nedenle kıyı çizgisi sadedir ve şelf alanı Antalya Körfezi açıklarında çok dardır. Buna karşılık Çukurova deltasının denize doğru ilerlediği Mersin ve İskenderun körfezlerinde taban görece sığlaşır. Akdeniz'in en derin noktası Mora Yarımadası açığındaki 5.267 metrelik Calypso Çukuru'dur.",
      points: [
        "Toros Dağları kıyıya paralel uzandığı için Boyuna Kıyı Tipi hâkimdir.",
        "Kıta sahanlığı batıda (Antalya açıkları) son derece dar, doğuda (Çukurova açıkları) geniştir.",
        "Yüksek buharlaşma ve güneşlenme süresi nedeniyle deniz suyu sıcaklığı ve tuzluluğu Türkiye'nin zirvesindedir.",
      ],
    },
    climateImpact: {
      title: "İklime Etkisi & Akdeniz Makroiklimi",
      content:
        "Akdeniz, kıyılarında tipik Akdeniz Makroiklimi'nin (yazları sıcak ve kurak, kışları ılık ve bol yağışlı) oluşmasını sağlar. Deniz suyunun kışın dahi 16-18 °C'nin altına düşmemesi, kıyı kuşağında kış ılıklığı yaratarak kar yağışı ve don olaylarını neredeyse sıfıra indirir; bu durum seracılık ve turunçgil tarımının temel dayanağıdır. Ancak Toros Dağları'nın heybetli kütlesi denizel ılıman nemli havanın İç Anadolu'ya geçmesini tamamen engelleyerek arkasındaki Konya kapalı havzasını step iklimine mahkûm eder.",
      points: [
        "Türkiye'de deniz turizmi sezonunun en uzun olduğu (Mayıs – Kasım arası) denizdir.",
        "Kış aylarında Akdeniz üzerinden gelen cephesel alçak basınçlar Toroslar'a çarparak bol yağış bırakır.",
        "Yaz aylarında tropikal hava baskısıyla aşırı nem ve yüksek hissedilen sıcaklıklar üretir.",
      ],
    },
    coastalGeomorphology: {
      title: "Kıyı Tipi & Yer Şekilleri",
      content:
        "Akdeniz kıyılarında morfolojik çeşitlilik çok zengindir. Genel yapı Boyuna Kıyı Tipi olmakla birlikte, karstik arazinin etkisiyle Antalya kent merkezinde falezler (yalıyarlar); Kaş ve Kekova açıklarında Dalmaçya Kıyı Tipi; Mersin Silifke kıyılarında kanyon vadilerin boğulmasıyla Kalanklı Kıyı Tipi görülür. Seyhan ve Ceyhan nehirlerinin biriktirmesiyle Türkiye'nin en büyük delta ovası olan Çukurova ve lagünleri (Akyatan, Ağyatan) meydana gelmiştir.",
      coastalTypes: [
        "Boyuna Kıyı Tipi (Toroslar)",
        "Dalmaçya Kıyı Tipi (Kaş – Kekova)",
        "Kalanklı Kıyı Tipi (Silifke)",
        "Delta Kıyıları (Çukurova Deltası)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Akıntı Sistemi: Sıcak Doğu Akdeniz Çevrimi",
      content:
        "Doğu Akdeniz baseninde genel akıntı sistemi saat yönünün tersine hareket eder. Afrika kıyılarından (Mısır açıkları) doğuya doğru ilerleyen sıcak akıntı, Levant Denizi üzerinden kuzeye yönelerek İskenderun Körfezi'nden Türkiye karasularına girer. Buradan batıya doğru Mersin ve Antalya kıyılarını izleyerek Rodos Adası'na yönelir. Bu sıcak kıyı akıntısı Türkiye'nin güney kıyılarında deniz suyu sıcaklığının yaz aylarında 30 °C'yi aşmasına zemin hazırlar.",
      keyPoints: [
        "Doğu Akdeniz siklonik akıntısı: İskenderun'dan Antalya'ya batı yönlü sıcak kıyı akıntısı.",
        "Yüksek Tuzluluk (%o38-39): Şiddetli buharlaşma ve azalan nehir debileriyle suyun tuz yoğunluğu en üst düzeydedir.",
        "Rodos Siklonik Girdabı: Açık denizde besin tuzlarını yukarı taşıyan (upwelling) soğuk çekirdekli girdap.",
      ],
    },
    hydrographicBalance: {
      title: "Beslenme Kaynakları & Buharlaşma Açığı",
      content:
        "Akdeniz negatif su bilançosuna sahip bir denizdir; yani deniz yüzeyinden buharlaşan su miktarı, yağışlarla ve akarsularla gelen tatlı su miktarından çok daha fazladır. Bu su açığı Cebelitarık Boğazı'ndan giren Atlantik suları ve Boğazlar'dan gelen Karadeniz suları ile kapatılır. Türkiye kıyılarından Akdeniz'e dökülen en önemli nehirler karstik gür kaynaklarla beslenen Manavgat, Düden, Aksu, Göksu ile Toroslar'dan doğan Seyhan, Ceyhan ve Asi nehirleridir.",
      majorRivers: [
        "Seyhan Nehri (560 km)",
        "Ceyhan Nehri (509 km)",
        "Göksu Nehri (260 km)",
        "Manavgat Çayı (karstik)",
        "Asi Nehri",
      ],
    },
    economicGeography: {
      title: "Ekonomik Coğrafya: Turizm, Mersin Limanı & Enerji",
      content:
        "Akdeniz kıyıları Türkiye'nin uluslararası kitle turizminin merkez üssüdür; Antalya tek başına yılda 15 milyonu aşkın yabancı turisti ağırlar. Ekonominin diğer devi ise Mersin Uluslararası Limanı'dır (MIP); İç Anadolu, Doğu ve Güneydoğu Anadolu'nun sanayi ve tarım ihracatının ana çıkış kapısıdır. İskenderun Körfezi ise demir-çelik tesisleri, petrol boru hatları (Bakü-Tiflis-Ceyhan ve Kerkük-Yumurtalık) ile stratejik bir enerji terminalidir.",
      sectors: [
        {
          name: "Kitle Turizmi",
          desc: "Antalya, Alanya ve Kemer kıyılarında devasa konaklama ve plaj ekonomisi.",
        },
        {
          name: "Mersin Uluslararası Limanı",
          desc: "Türkiye'nin en büyük konteyner ve hinterlant aktarma limanı.",
        },
        {
          name: "Ceyhan Enerji Terminali",
          desc: "Uluslararası petrol boru hatlarının Akdeniz'e döküldüğü enerji üssü.",
        },
      ],
    },
    humanGeography: {
      title: "Nüfus & Yerleşme Dokusu",
      content:
        "Akdeniz kıyılarında yerleşme iki zıt topoğrafik karakter sergiler. Batıda Teke ve Taşeli platolarında karstik ve engebeli yapı nedeniyle yerleşim seyrektir. Buna karşılık Antalya Ovası ile doğudaki bereketli Çukurova deltası (Adana, Mersin, Tarsus) ve Hatay grabeni Türkiye'nin en yoğun nüfuslu, tarımsal ve endüstriyel üretim merkezleridir. Turizm sektörünün yarattığı istihdam kıyı kentlerine Türkiye'nin dört bir yanından yoğun iç göç çekmektedir.",
      points: [
        "Antalya ve Çukurova havzası hızlı nüfus artışı ve göç alan metropoliten alanlardır.",
        "Teke ve Taşeli platoları karstik erimeler ve dağlık yapı nedeniyle seyrek nüfusludur.",
        "Kıyı boyunca sera tarımı ve turizm tesisleri arazi kullanımında birbiriyle yarışır.",
      ],
    },
    environmentalIssues: {
      title: "Çevre Sorunları: Lessepsiyen Türler & Plastik Atık",
      content:
        "Akdeniz ekosistemini tehdit eden en güncel biyolojik sorun, 1869'da açılan Süveyş Kanalı üzerinden Kızıldeniz ve Hint Okyanusu'ndan gelen tropikal göçmen canlılardır ('Lessepsiyen göç'). Küresel ısınmayla Akdeniz suyunun ısınması, zehirli balon balığı (Lagocephalus sceleratus) ve aslan balığı gibi istilacı türlerin hızla çoğalarak yerli balık faunası ve balıkçılık ağları üzerinde ağır tahribat yaratmasına neden olmuştur. Ayrıca kapalı sirkülasyon nedeniyle Doğu Akdeniz sahilleri plastik mikropartikül kirliliğinin en yoğun olduğu alanlardandır.",
      risks: [
        "Lessepsiyen İstilacı Türler: Zehirli balon balığı ve aslan balığı istilası.",
        "Deniz Isınması & Tuzlanma: Tropikalleşen Doğu Akdeniz suyunun yerli türleri baskılaması.",
        "Plastik Kirliliği: Nehirler ve deniz ticareti kaynaklı makro ve mikroplastik yığılması.",
      ],
    },
    faq: [
      {
        question: "Akdeniz neden Türkiye'nin en sıcak ve tuzlu denizidir?",
        answer:
          "Ekvator'a en yakın (en güneydeki) denizimiz olduğu için güneş ışınlarını daha dik açıyla alır. Yıllık güneşlenme süresinin ve hava sıcaklığının yüksek olması şiddetli buharlaşmaya yol açar; buharlaşan su tuzu geride bıraktığı için tuzluluk binde 38-39'a ulaşır.",
      },
      {
        question: "Lessepsiyen tür ne demektir ve Akdeniz'i nasıl etkiler?",
        answer:
          "Süveyş Kanalı'nın açılmasıyla Kızıldeniz'den Akdeniz'e göç eden Hint-Pasifik kökenli canlılara denir. Balon balığı ve aslan balığı gibi yırtıcı ve zehirli türler, Akdeniz'in yerli ekosistemini ve balıkçılığı tehdit etmektedir.",
      },
      {
        question: "Antalya falezleri nasıl oluşmuştur?",
        answer:
          "Antalya kent merkezi, akarsuların ve karstik kaynakların çökelttiği traverten platosu üzerine kuruludur. Deniz dalgaları bu yumuşak traverten tabakasının altını oymuş; kütlelerin dik kırılmasıyla 30-40 metre yüksekliğinde deniz uçurumları (falezler) oluşmuştur.",
      },
    ],
  },
};
