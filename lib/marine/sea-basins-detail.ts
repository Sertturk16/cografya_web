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
  /** The hero's lede: two or three sentences written for this sea alone. */
  lede: string;
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
    /** Mainland coastline (HGM, islands excluded). */
    coastalLengthTr: string;
    /** The same coast with its islands; the four add up to HGM's 8.333 km. */
    coastalLengthWithIslandsTr: string;
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
    badge: "Derin ama kapalı bir deniz",
    lede: "Türkiye'nin en az tuzlu denizi. Büyük nehirler üstünü tatlı suyla besler; 200 metrenin altında ise oksijen yoktur. Bu sayfa denizin nasıl oluştuğunu, kıyısına neden bu kadar yağmur düştüğünü ve 15 kıyı ilini anlatıyor.",
    identity: BASIN_IDENTITY.karadeniz,
    metrics: {
      area: "436.400 km²",
      maxDepth: "2.212 m",
      avgDepth: "1.253 m",
      salinity: "‰17 – ‰18 (en düşük)",
      coastalLengthTr: "1.695 km",
      coastalLengthWithIslandsTr: "1.701 km",
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
      title: "Kimi Zaman Göl, Kimi Zaman Deniz",
      content:
        "Karadeniz, Tetis Okyanusu'nun kuzey kalıntısı olan Paratetis Denizi'nden doğdu: kıtaların arasında sıkışıp kalan büyük bir çöküntü çanağı. Üçüncü ve Dördüncü Zaman boyunca kimi zaman tatlı su gölü, kimi zaman tuzlu deniz oldu. Yaklaşık 7.500 yıl önce boğazlar açılınca bugünkü gibi Akdeniz'e bağlandı. Kıyıdan sonra taban dik bir yamaçla 2.000 metrenin altındaki düzlüğe iner; en derin yeri orta kesimde, 2.212 metre.",
      points: [
        "Kıta sahanlığı, Samsun deltalarının çevresi dışında çok dar.",
        "Kuzey Anadolu Dağları kıyıdan hemen yükseldiği için deniz birden derinleşir.",
        "200 metrenin altındaki suda oksijen yok; su hidrojen sülfürle doymuş.",
      ],
    },
    climateImpact: {
      title: "Dağa Çarpan Nemli Hava",
      content:
        "Kuzeyden gelen soğuk Sibirya ve kutup havası deniz üstünden geçerken nem alır ve yumuşar. Nemli hava kıyıya paralel uzanan Kuzey Anadolu Dağları'na çarpar, yükselir ve soğur; Türkiye'nin en bol yamaç yağışı böyle oluşur. Rize'de yıllık yağış 2.300 mm'yi aşar. Sonuç, her mevsimi yağışlı ve yaz ile kış arasındaki sıcaklık farkı en az olan Karadeniz iklimidir.",
      points: [
        "Kışın karanın fazla soğumasını engeller, kıyıda don olayları azalır.",
        "Yazın kuraklığı önler; kurak mevsimi olmayan tek iklim kuşağımız budur.",
        "Yüksek dağlar deniz etkisini İç Anadolu'ya geçirmez, iç kesimler karasallaşır.",
      ],
    },
    coastalGeomorphology: {
      title: "Dağların Denize Dik İndiği Kıyı",
      content:
        "Karadeniz kıyısı çoğunlukla boyuna kıyı tipindedir: dağlar kıyıya paralel uzanır, kıyı çizgisi düz ve falezlidir. İstisnalar Samsun'dadır; Kızılırmak ve Yeşilırmak'ın getirdiği alüvyon Bafra ve Çarşamba deltalarını kurmuştur. Sinop'ta ise bir tombolo, yani saplı ada, Türkiye'nin tek doğal korunaklı limanını oluşturur.",
      coastalTypes: [
        "Boyuna Kıyı Tipi",
        "Delta Kıyıları (Bafra ve Çarşamba)",
        "Tombolo (Sinop İnceburun)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Kıyıyı Dolaşan Halka",
      content:
        "Karadeniz'in ana akıntısı, denizin kenarını saat yönünün tersine dolaşan büyük bir halkadır; adı Kenar Akıntısı. Gürcistan kıyısından Doğu Karadeniz'e girer, Sinop Burnu'nu dolanıp batıya, İstanbul Boğazı'na doğru ilerler. Nehirler bol su getirdiği ve buharlaşma az olduğu için Karadeniz'in yüzeyi Marmara'dan yaklaşık 30-40 cm yüksektir. Bu fark, İstanbul Boğazı'ndan Marmara'ya akan güçlü yüzey akıntısını doğurur.",
      keyPoints: [
        "Kenar Akıntısı: Türkiye kıyısı boyunca doğudan batıya, saat yönünün tersine akar.",
        "İstanbul Boğazı üst akıntısı: Karadeniz'in fazla suyunu Marmara'ya, oradan Ege'ye taşır.",
        "Katlar karışmaz: üstteki 150-200 metrelik hafif, az tuzlu su, alttaki ağır ve hidrojen sülfürlü suyun yükselmesini engeller.",
      ],
    },
    hydrographicBalance: {
      title: "Nehirlerin Tatlılaştırdığı Deniz",
      content:
        "Karadeniz, büyüklüğüne göre dünyanın en geniş nehir havzalarından birinden su alır. Avrupa'nın ikinci büyük nehri Tuna başta olmak üzere Dinyester, Dinyeper, Don ve Türkiye'den gelen Kızılırmak, Yeşilırmak, Sakarya ve Çoruh her yıl yaklaşık 350 milyar metreküp tatlı su getirir. Buharlaşma, yağışla ve nehirlerle gelen sudan az olduğu için tuzluluk binde 17-18'de kalır.",
      majorRivers: [
        "Tuna Nehri (Avrupa)",
        "Dinyeper ve Dinyester",
        "Kızılırmak (1.355 km)",
        "Yeşilırmak",
        "Sakarya Nehri",
        "Çoruh Nehri",
      ],
    },
    economicGeography: {
      title: "Türkiye'nin Balığını Veren Deniz",
      content:
        "Nehirlerin taşıdığı mineral ve besin tuzları, üstteki 100 metrelik suyu plankton bakımından çok zenginleştirir. Bu plankton hamsi, çaça, palamut ve istavrit gibi sürü hâlinde yüzen balıkları besler; Türkiye'nin denizlerden avladığı balığın yaklaşık üçte ikisi Karadeniz'den çıkar. Kıyıda Filyos, Samsun ve Trabzon limanları Kafkasya ve Orta Asya'ya giden transit ticarette önemli yer tutar.",
      sectors: [
        {
          name: "Balıkçılık",
          desc: "Türkiye'de hamsi ve küçük sürü balıkları avcılığının merkezi.",
        },
        {
          name: "Liman ve Lojistik",
          desc: "Samsun, Trabzon, Filyos ve Hopa limanlarından Karadeniz ülkeleriyle ticaret.",
        },
        {
          name: "Enerji ve Maden",
          desc: "Sakarya Gaz Sahası'nda açık denizden doğal gaz çıkarılıyor.",
        },
      ],
    },
    humanGeography: {
      title: "Dağla Deniz Arasına Sıkışan Şehirler",
      content:
        "Kuzey Anadolu Dağları kıyının hemen arkasından dik yükseldiği için tarım alanları ve yerleşmeye uygun düzlükler dar bir şeride sıkışmıştır. Bu yüzden Trabzon, Rize, Giresun ve Ordu gibi şehir merkezleri kıyı boyunca dizilir. 2025'te Karadeniz Bölgesi nüfusunun yaklaşık %72'si denize kıyısı olan 11 ilde yaşıyordu. Kırsalda ise eğimli arazi ve bol su, Türkiye'nin en tipik dağınık köy yerleşmesini ortaya çıkarmıştır.",
      points: [
        "Şehir merkezleri ve sanayi, denizden doldurulan alanlara ve vadi tabanlarına yığılmış.",
        "Karadeniz Sahil Yolu kıyı boyunca ulaşımı sağlar ama doğal kıyı çizgisini de değiştirmiştir.",
        "Kıyının arkasındaki dik yamaçlarda çay ve fındık tarımı yerleşmenin düzenini belirler.",
      ],
    },
    environmentalIssues: {
      title: "Suyunun Çoğu Oksijensiz Bir Deniz",
      content:
        "Karadeniz'in suyunun yaklaşık %90'ında oksijen yoktur: yaklaşık 200 metrenin altındaki su hidrojen sülfürle doludur ve orada balık yaşayamaz. Canlıların çoğu üstteki ince katmanda yaşar. Bu ince katman üç yönden baskı altında: Tuna gibi büyük nehirlerin taşıdığı tarım gübresi ve sanayi atığı (ötrofikasyon), aşırı avlanma ve gemilerin balast suyuyla gelen istilacı türler. Bunların en bilineni taraklı denizanası Mnemiopsis leidyi.",
      risks: [
        "Oksijensiz tabakanın sınırı: kirlilik artarsa bu tabaka yukarı doğru yükselebilir.",
        "Ötrofikasyon: nehirlerden gelen fazla fosfat ve nitrat alg patlamasına ve oksijen tükenmesine yol açar.",
        "Kıyı aşınması ve aşırı avlanma: hamsi stokları kaldırabileceğinden fazla avlanıyor.",
      ],
    },
    faq: [
      {
        question: "Karadeniz'in 200 metre altında neden canlı yaşamaz?",
        answer:
          "Karadeniz'e dökülen bol tatlı su yüzeyde hafif bir katman oluşturur; dipte ise boğazlardan gelen ağır, tuzlu Akdeniz suyu durur. Yoğunlukları farklı olduğu için bu iki su karışmaz; aradaki kalıcı sınıra piknoklin denir. Yüzeydeki oksijen dibe inemez. Dipteki organik artıkları oksijensiz yaşayan bakteriler ayrıştırır ve bu sırada zehirli hidrojen sülfür açığa çıkar.",
      },
      {
        question: "Karadeniz neden Türkiye'nin en az tuzlu denizi?",
        answer:
          "Tuna, Dinyeper, Dinyester ve Kızılırmak gibi büyük nehirler denize sürekli tatlı su taşır. Hava bulutlu, nemli ve serin olduğu için de buharlaşma azdır. İkisi birlikte tuzluluğu binde 17-18'de tutar.",
      },
      {
        question: "Karadeniz'de falez neden bu kadar yaygın?",
        answer:
          "Kuzey Anadolu Dağları kıyıya paralel uzanır ve dik bir yamaçla denize iner; deniz de birden derinleşir. Açık denizden gelen fırtına dalgaları sığ bir alanda yavaşlamadan dağ eteğine çarpar ve yamacın altını oyar. Üstteki kaya çöküp düşer, geride dik bir kıyı uçurumu kalır: falez ya da yalıyar.",
      },
    ],
  },
  marmara: {
    slug: "marmara",
    nameTr: "Marmara Denizi",
    fullNameTr: "Marmara Denizi Havzası",
    badge: "Tamamen Türkiye'de bir iç deniz",
    lede: "Karadeniz ile Ege arasında küçük bir deniz. Üstünden az tuzlu Karadeniz suyu, dibinden tuzlu Akdeniz suyu geçer; tabanında Kuzey Anadolu Fayı uzanır. Kıyılarında Türkiye'nin en kalabalık şehirleri var.",
    identity: BASIN_IDENTITY.marmara,
    metrics: {
      area: "11.350 km²",
      maxDepth: "1.370 m (Çınarcık Çukuru)",
      avgDepth: "289 m",
      salinity: "‰22 yüzeyde, ‰38 dipte",
      coastalLengthTr: "927 km",
      coastalLengthWithIslandsTr: "1.441 km",
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
      title: "Fayın Açtığı Çukurlar",
      content:
        "Marmara Denizi'nin tüm kıyıları Türkiye'dedir; bir iç denizdir. Kuzey Anadolu Fayı'nın batı ucu burada yer kabuğunu hem yana kaydırmış hem de çekip açmış, arada kalan kesim çökmüştür. Buna çek-ayır tektoniği denir. Bu yüzden sığ kıyıların ortasında, doğu-batı doğrultusunda sıralanan üç derin çukur vardır: Tekirdağ Çukuru (1.112 m), Orta Marmara Çukuru (1.220 m) ve Çınarcık Çukuru (1.370 m).",
      points: [
        "Kuzey Anadolu Fayı'nın ana kolu bu üç çukuru boydan boya geçer.",
        "Ria tipindeki İstanbul ve Çanakkale boğazları Marmara'yı Karadeniz'e ve Ege'ye bağlar.",
        "Güneyde Kapıdağ Yarımadası ve Marmara Adaları engebeli, parçalı bir kıyı oluşturur.",
      ],
    },
    climateImpact: {
      title: "Üç İklimin Buluştuğu Yer",
      content:
        "Marmara'nın çevresinde Karadeniz, Akdeniz ve karasal iklim birbirine karışır; buna Marmara geçiş iklimi denir. Deniz küçük olsa da kışın kuzeyden inen soğuk havayı yumuşatır, yazın güneyden gelen sıcağı meltemlerle serinletir. Trakya'da ve Güney Marmara ovalarında zeytin gibi Akdeniz bitkilerinin yetişmesi de bu sayededir.",
      points: [
        "Kışın Balkanlar'dan gelen soğuk havanın kıyıdaki don etkisini azaltır.",
        "Buharlaşma Karadeniz'den fazla, Ege ve Akdeniz'den azdır.",
        "Yıl boyunca kuzeydoğudan esen poyrazın ve güneybatıdan esen lodosun getirdiği deniz etkisi belirgindir.",
      ],
    },
    coastalGeomorphology: {
      title: "Küçük Bir Denizde Birçok Kıyı Tipi",
      content:
        "Marmara kıyısında birkaç kıyı tipi yan yana görülür. İstanbul ve Çanakkale boğazları, sular altında kalmış eski akarsu vadileridir: ria tipi. Kuzeyde Büyükçekmece, Küçükçekmece ve Terkos çevresinde lagün kıyıları uzanır. Güneyde, Balıkesir kıyısındaki Kapıdağ ise dalgaların biriktirdiği kumla karaya bağlanmış eski bir adadır, yani bir tombolo. Üçü de bu tiplerin Türkiye'deki en tipik örnekleridir.",
      coastalTypes: [
        "Ria Kıyı Tipi (Boğazlar)",
        "Lagün ve Limanlı Kıyı Tipi (Çekmece Gölleri)",
        "Tombolo (Kapıdağ Yarımadası)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Üst Üste, Ters Yönde İki Akıntı",
      content:
        "Marmara'da iki akıntı üst üste ve ters yönde akar. Yüzeyde Karadeniz'in fazla suyu, az tuzlu (binde 22) ve hafif su olarak güneybatıya, Ege'ye doğru gider. Yaklaşık 25 metrenin altında ise Ege ve Akdeniz'in tuzlu (binde 38) ve ağır suyu Çanakkale Boğazı'ndan girip kuzeydoğuya, Karadeniz'e doğru ilerler.",
      keyPoints: [
        "Üst akıntı: Karadeniz'den Ege'ye; nedeni yaklaşık 30-40 cm'lik seviye farkı.",
        "Alt akıntı: Ege'den Karadeniz'e; nedeni yoğunluk ve tuzluluk farkı.",
        "Termoklin ve haloklin: 20-25 metre derinlikte sıcaklığın ve tuzluluğun birden değiştiği, iki suyu ayıran ince katman.",
      ],
    },
    hydrographicBalance: {
      title: "Asıl Suyu Karadeniz Veriyor",
      content:
        "Marmara'ya dökülen akarsuların suyu azdır; en büyükleri Güney Marmara'dan gelen Susurluk (Simav) Çayı ve Gönen Çayı'dır. Denizin asıl su kaynağı bu akarsular değil, İstanbul Boğazı'ndan Karadeniz'den akan büyük yüzey suyudur. Bu yüzden Marmara'nın su bütçesi Karadeniz havzasının iklimine bağlıdır.",
      majorRivers: ["Susurluk (Simav) Çayı", "Gönen Çayı", "Biga Çayı", "Nilüfer Çayı"],
    },
    economicGeography: {
      title: "Sanayinin ve Gemi Trafiğinin Denizi",
      content:
        "Marmara, Türkiye ekonomisinin ve sanayisinin omurgasıdır. Ambarlı, İzmit Körfezi, Gemlik ve Bandırma limanları Kocaeli, İstanbul ve Bursa'daki sanayiyi dünya pazarlarına bağlar; Türkiye'nin konteyner ve otomotiv ihracatı buradan yapılır. Türk Boğazları aynı zamanda Karadeniz ülkelerinin açık denizlere çıktığı tek deniz yoludur.",
      sectors: [
        {
          name: "Deniz Ticareti ve Lojistik",
          desc: "Ambarlı, İzmit Körfezi ve Gemlik'te konteyner ve dökme yük limanları.",
        },
        {
          name: "Boğazlardan Geçiş",
          desc: "İstanbul Boğazı'ndan yılda 40 binden fazla gemi geçer; geçişler Montrö Boğazlar Sözleşmesi'ne göre işler.",
        },
        {
          name: "Balıkçılık",
          desc: "Lüfer ve palamut gibi göçmen balıkların boğazdan geçerken mevsimlik avı.",
        },
      ],
    },
    humanGeography: {
      title: "Türkiye'nin En Kalabalık Kıyısı",
      content:
        "Türkiye nüfusunun yaklaşık %30'u Marmara Bölgesi'nde yaşar. İstanbul başta olmak üzere Kocaeli, Tekirdağ, Bursa ve Yalova kıyıları sanayinin, finansın ve lojistiğin toplandığı yerlerdir. Bu yoğun yerleşme kıyının neredeyse tamamını değiştirmiştir; doğal kıyının yerini limanlar, dolgu alanları ve tersaneler almıştır.",
      points: [
        "Türkiye'nin en kalabalık ve en çok kentleşmiş kıyısı.",
        "Kıyıdaki ağır sanayi ve tersaneler denizdeki canlılara baskı yapar.",
        "Adalar ve güney kıyısı (Erdek, Çınarcık) büyük şehrin dinlenme yerleridir.",
      ],
    },
    environmentalIssues: {
      title: "Atıkla Yüklenen Kapalı Deniz",
      content:
        "Marmara'nın iki katlı yapısı, yüzeyle dip arasında oksijen alışverişini zaten sınırlar. Buna, 2025'te yaklaşık 25 milyon kişinin yaşadığı yedi kıyı ilindeki şehirlerin ve sanayinin arıtılmadan ya da yetersiz arıtılarak denize bırakılan atıkları eklenince deniz azot ve fosforla aşırı yüklendi. En çarpıcı sonuç 2021'de görüldü: müsilaj, yani deniz salyası, denizin büyük bölümünü kapladı ve tabandaki canlı çeşitliliğini boğdu.",
      risks: [
        "Müsilaj: kirlilik ve ısınan suyla birlikte bitkisel plankton aşırı çoğalır.",
        "Dipte oksijensizlik: derin çukurlarda oksijen, canlıların zorlandığı düzeye iner.",
        "Gemi trafiği: sintine ve balast suyu ile petrol kaynaklı kirlilik riski.",
      ],
    },
    faultLineNotice: {
      text: "Kuzey Anadolu Fayı Marmara'nın tabanından geçer. Fayın kolları ve bölgedeki sismik boşluklar fay hatları sayfasında.",
      href: "/deprem/fay-hatlari",
    },
    faq: [
      {
        question: "Marmara'da neden ters yönde iki akıntı var?",
        answer:
          "İki nedeni var. Birincisi seviye farkı: Karadeniz bol nehir suyu aldığı için Marmara'dan 30-40 cm yüksektir ve suyu yüzeyden güneye doğru akar. İkincisi yoğunluk farkı: Akdeniz suyu daha tuzlu olduğu için ağırdır ve dipten Karadeniz'e doğru ilerler.",
      },
      {
        question: "Müsilaj neden sadece Marmara'da felakete dönüştü?",
        answer:
          "Marmara'nın iki katlı, durgun yapısı suyun yukarıdan aşağıya karışmasını engeller. Karadeniz'den gelen organik yüke çevredeki şehirlerin ve sanayinin azot ve fosfor yükü eklenince bitkisel plankton aşırı çoğaldı ve stres altında müsilaj denen yapışkan maddeyi salgıladı.",
      },
      {
        question: "Marmara'nın tabanında neden 1.000 metreyi aşan çukurlar var?",
        answer:
          "Kuzey Anadolu Fayı'nın doğrultu atımlı kolları Marmara'nın altından geçerken yer kabuğunu çekip ayırmıştır; buna çek-ayır tektoniği denir. Ayrılan yerlerde Tekirdağ, Orta Marmara ve Çınarcık çukurları çökmüştür.",
      },
    ],
  },
  ege: {
    slug: "ege",
    nameTr: "Ege Denizi",
    fullNameTr: "Ege Denizi (Adalar Denizi) Havzası",
    badge: "Adaların ve körfezlerin denizi",
    lede: "Yüzlerce adası, derin körfezleri ve denize dik inen dağlarıyla Ege, Türkiye'nin en girintili çıkıntılı kıyısına sahip. Kuzeyinde Karadeniz'den gelen serin su, güneyinde Akdeniz'in tuzlu suyu hâkim.",
    identity: BASIN_IDENTITY.ege,
    metrics: {
      area: "214.000 km²",
      maxDepth: "2.561 m",
      avgDepth: "350 m",
      salinity: "‰33 – ‰37",
      coastalLengthTr: "2.805 km",
      coastalLengthWithIslandsTr: "3.484 km",
      provincesCount: 6,
      stationsCount: 5,
    },
    stationSlugs: ["canakkale-ege", "balikesir-ege", "izmir", "aydin", "mugla"],
    coastalProvinces: [
      { plate: "22", name: "Edirne (Enez/Saros)", slug: "edirne" },
      { plate: "17", name: "Çanakkale (Ege/Bozcaada)", slug: "canakkale" },
      { plate: "10", name: "Balıkesir (Ayvalık/Edremit)", slug: "balikesir" },
      { plate: "35", name: "İzmir (Çeşme/Karaburun)", slug: "izmir" },
      { plate: "09", name: "Aydın (Kuşadası/Didim)", slug: "aydin" },
      { plate: "48", name: "Muğla (Bodrum/Datça)", slug: "mugla" },
    ],
    physicalGeography: {
      title: "Çöken Bir Karanın Üstündeki Deniz",
      content:
        "Ege'nin yerinde bir zamanlar Egeid denen bir kara vardı. Üçüncü Zaman'ın sonunda ve Dördüncü Zaman'ın başında bu kara kırılıp çöktü, çöken yeri Akdeniz'in suyu bastı. Su üstünde kalan yüksek zirveler bugünkü Ege adalarıdır. Batı Anadolu'da dağlar denize dik uzandığı için deniz graben vadileri boyunca içeri sokulur ve kıta sahanlığı Türkiye'deki en geniş hâlini alır. Kuzeyde Saros Çukuru, güneyde Girit yayının açıkları derindir.",
      points: [
        "Kıyı enine tiptedir; dağlar kıyıya dik uzanır.",
        "Kıta sahanlığı geniş; sığ taban kıyıdan onlarca deniz mili açığa kadar sürer.",
        "Yüzlerce koy, körfez, yarımada ve doğal limanıyla Türkiye'nin en girintili çıkıntılı kıyısı.",
      ],
    },
    climateImpact: {
      title: "Denizin İçeri Uzanan Kolları",
      content:
        "Ege'nin iklime en büyük etkisi şudur: dağlar denize dik uzandığı için ılıman Akdeniz iklimi iç kesimlere kolayca girer. Bakırçay, Gediz, Küçük Menderes ve Büyük Menderes grabenleri birer koridor gibi çalışır ve deniz etkisini kıyıdan 150-200 km içeriye, Manisa, Denizli ve Uşak sınırına kadar taşır. Yazın kuzeyden esen kuru ve serin etezyen rüzgârları kıyıların sıcağını dengeler.",
      points: [
        "Kıyı ile iç kesimler arasında iklim ve bitki örtüsü birden değil, yavaş yavaş değişir.",
        "Etezyenler yazın açık denizde dalgaları büyütür, kıyıda ise bunaltıcı nemi dağıtır.",
        "Kışlar ılık ve yağışlı, yazlar sıcak ve kurak geçer.",
      ],
    },
    coastalGeomorphology: {
      title: "Denize Açılan Grabenler",
      content:
        "Ege kıyısı enine kıyı tipindedir. Kıyı boyunca ölçülen uzunlukla kuş uçuşu uzaklık arasındaki fark Türkiye'de en çok buradadır. Grabenlerin denize açılan ağızlarında Edremit, Çandarlı, İzmir, Kuşadası, Güllük ve Gökova körfezleri yer alır; aradaki horst dağları ise Karaburun, Çeşme, Dilek ve Datça yarımadaları olarak denize uzanır. Gediz ve Büyük Menderes ağızlarında geniş delta ovaları oluşmuştur.",
      coastalTypes: [
        "Enine Kıyı Tipi",
        "Geniş Körfezler ve Yarımadalar",
        "Delta Kıyıları (Gediz, Balat Deltaları)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Batıda Güneye, Doğuda Kuzeye",
      content:
        "Ege'deki su hareketini iki ayrı su belirler. Çanakkale Boğazı'ndan çıkan az tuzlu, serin Karadeniz suyu Yunanistan tarafında, batı kıyısı boyunca güneye akar. Doğu Akdeniz'den gelen sıcak ve tuzlu su ise Anadolu kıyısı boyunca kuzeye çıkar. Sıcaklık ve tuzluluk farkının sürdürdüğü bu iki hareket, Ege'de saat yönünün tersine dönen geniş bir döngü oluşturur.",
      keyPoints: [
        "Kuzey Ege ve boğaz çıkışı: Karadeniz suyu yüzünden tuzluluk görece düşük, binde 33.",
        "Güney Ege: Akdeniz suyu baskın, tuzluluk binde 38'e yaklaşır.",
        "Adalar ve dar geçitler yer yer güçlü anaforlar ve girdaplar yaratır.",
      ],
    },
    hydrographicBalance: {
      title: "Alüvyon Taşıyan Graben Nehirleri",
      content:
        "Ege'ye Türkiye'den dökülen büyük nehirler graben ovalarından gelir: Bakırçay, Gediz, Küçük Menderes ve Büyük Menderes. Taşıdıkları alüvyon o kadar çoktur ki Efes ve Milet gibi antik liman kentleri bugün denizden kilometrelerce içeride kalmıştır. Yine de yazın buharlaşma güçlü olduğu için Ege'nin tuzluluğu Karadeniz'den ve Marmara'dan çok daha yüksektir.",
      majorRivers: [
        "Büyük Menderes (548 km)",
        "Gediz Nehri (401 km)",
        "Küçük Menderes (175 km)",
        "Bakırçay (129 km)",
      ],
    },
    economicGeography: {
      title: "Korunaklı Koyların Ekonomisi",
      content:
        "Ege kıyıları deniz turizminin, mavi yolculuğun ve yatçılığın merkezidir. Bodrum, Çeşme, Kuşadası, Datça ve Ayvalık'ın korunaklı koyları ve marinaları yabancı yatların uğrak yeridir. Aynı korunaklı koylar balık çiftliklerinin de yeridir: Türkiye'de denizde kafeste yetiştirilen çipura ve levreğin neredeyse tamamı Ege kıyılarından, en çok Muğla ve İzmir'den çıkar. İzmir Alsancak ve Aliağa limanlarından Ege Bölgesi'nin sanayi ve tarım ürünleri ihraç edilir.",
      sectors: [
        {
          name: "Yat ve Deniz Turizmi",
          desc: "Mavi yolculuk rotaları, marinalar ve koylar.",
        },
        {
          name: "Kültür Balıkçılığı",
          desc: "Muğla ve İzmir kıyılarında kafeslerde çipura ve levrek yetiştiriciliği.",
        },
        {
          name: "Liman ve Sanayi",
          desc: "Aliağa'da petrokimya limanı, İzmir Alsancak'ta ihracat limanı.",
        },
      ],
    },
    humanGeography: {
      title: "Ovalar Boyunca Yayılan Yerleşme",
      content:
        "Ege'de dağlar yerleşmeyi Karadeniz'deki gibi dar bir şeride sıkıştırmaz. Tarım alanları, turizm merkezleri ve sanayi graben ovaları boyunca iç kesimlere doğru yayılmıştır. Türkiye'nin üçüncü büyük şehri İzmir, körfezin çevresinde büyümüştür.",
      points: [
        "Graben vadileri kıyıyı iç kesimlere bağlayan yol ve ticaret hatları olmuş.",
        "Mevsimlik turizm göçü en çok Muğla ve Aydın kıyılarında yaşanır.",
        "Antik liman kentleri bu kıyının uzun yerleşme tarihini gösterir.",
      ],
    },
    environmentalIssues: {
      title: "Suyu Yenilenmeyen Körfezler",
      content:
        "Ege'nin en büyük çevre sorunu, dar ve sığ iç körfezlerde, özellikle İzmir ve Çandarlı körfezlerinde biriken sanayi ve ev atıklarıdır. Kapalı körfezlerde su az yenilendiği için zaman zaman alg patlamaları ve kötü koku görülür. Kıyıdaki yazlık konutlar ve betonlaşma da lagünleri ve caretta caretta kaplumbağalarının yumurtlama alanlarını tehdit ediyor.",
      risks: [
        "İç körfez kirliliği: İzmir Körfezi'nde sığlaşma, koku ve su kalitesi sorunu.",
        "Aşırı yapılaşma: turizm baskısıyla doğal koyların ve sulak alanların bozulması.",
        "Balık çiftliği atıkları: akıntısı zayıf koylarda çiftliklerin bıraktığı organik yük.",
      ],
    },
    faultLineNotice: {
      text: "Ege'nin grabenlerini açan Batı Anadolu Fay Sistemi'ni fay hatları sayfasında inceleyebilirsin.",
      href: "/deprem/fay-hatlari",
    },
    faq: [
      {
        question: "Ege kıyısı neden Türkiye'nin en uzun kıyısı?",
        answer:
          "Dağlar denize dik uzandığı, yani kıyı enine tipte olduğu için yüzlerce koy, körfez, burun ve yarımada oluşmuştur. Bu girinti çıkıntılar kıyı çizgisini uzatır ve gerçek kıyı uzunluğu 2.800 kilometreyi aşar.",
      },
      {
        question: "Ege'de deniz etkisi neden iç kesimlere kadar ulaşır?",
        answer:
          "Karadeniz'de ve Akdeniz'de olduğu gibi kıyıya paralel sıradağlar yoktur. Dağlar kıyıya diktir; aralarındaki Bakırçay, Gediz ve Menderes grabenleri ılıman deniz havasının 150-200 km içeri girmesine izin verir.",
      },
      {
        question: "Ege'de su sıcaklığı ve tuzluluk nasıl değişir?",
        answer:
          "Kuzey Ege'de Çanakkale Boğazı'ndan çıkan az tuzlu, serin Karadeniz suyu etkilidir. Güneye, Muğla ve Rodos açıklarına indikçe Akdeniz suyu baskın olur; sıcaklık da tuzluluk da belirgin biçimde artar.",
      },
    ],
  },
  akdeniz: {
    slug: "akdeniz",
    nameTr: "Akdeniz",
    fullNameTr: "Doğu Akdeniz Havzası",
    badge: "En sıcak ve en tuzlu denizimiz",
    lede: "Toroslar'ın kıyıya paralel bir duvar gibi uzandığı, güneşin en uzun parladığı deniz. Suyu kışın bile 16-18 °C'nin altına inmez; buharlaşma o kadar güçlüdür ki tuzluluk binde 38-39'a çıkar.",
    identity: BASIN_IDENTITY.akdeniz,
    metrics: {
      area: "2.500.000 km² (tüm Akdeniz)",
      maxDepth: "5.267 m (Calypso Çukuru)",
      avgDepth: "1.500 m",
      salinity: "‰38 – ‰39 (en yüksek)",
      coastalLengthTr: "1.577 km",
      coastalLengthWithIslandsTr: "1.707 km",
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
      title: "Levhaların Buluştuğu Eski Okyanus",
      content:
        "Akdeniz, eski Tetis Okyanusu'nun ana gövdesinden kalmıştır. Afrika Levhası'nın kuzeye, Anadolu ve Avrasya levhalarının altına daldığı etkin bir dalma-batma kuşağının, Helen-Kıbrıs Yayı'nın üstünde yer alır. Türkiye kıyısında Toroslar denize paralel bir duvar gibi yükselir; bu yüzden kıyı çizgisi düzdür ve Antalya Körfezi açıklarında şelf çok dardır. Çukurova deltasının denize ilerlediği Mersin ve İskenderun körfezlerinde ise taban görece sığdır. Akdeniz'in en derin yeri, Mora Yarımadası açığındaki 5.267 metrelik Calypso Çukuru'dur.",
      points: [
        "Toroslar kıyıya paralel uzandığı için kıyı boyuna tiptedir.",
        "Kıta sahanlığı batıda, Antalya açıklarında çok dar; doğuda, Çukurova açıklarında geniş.",
        "Buharlaşma ve güneşlenme süresi yüksek olduğu için su sıcaklığı ve tuzluluk Türkiye'nin en yükseği.",
      ],
    },
    climateImpact: {
      title: "Kışı Ilık, Yazı Uzun Bir Kıyı",
      content:
        "Akdeniz, kıyılarına yazları sıcak ve kurak, kışları ılık ve yağışlı Akdeniz iklimini verir. Deniz suyu kışın bile 16-18 °C'nin altına inmediği için kıyıda kar ve don neredeyse hiç görülmez; seracılık ve turunçgil tarımı buna dayanır. Ama Toroslar nemli deniz havasının İç Anadolu'ya geçmesine izin vermez; dağların arkasındaki Konya kapalı havzası bu yüzden step iklimindedir.",
      points: [
        "Deniz turizmi sezonu Türkiye'de en uzun burada, Mayıs'tan Kasım'a kadar sürer.",
        "Kışın Akdeniz üzerinden gelen alçak basınç sistemleri Toroslar'a çarpıp bol yağış bırakır.",
        "Yazın tropikal hava yüzünden nem yüksek, hissedilen sıcaklık da çok yüksektir.",
      ],
    },
    coastalGeomorphology: {
      title: "Tek Kıyıda Dört Kıyı Tipi",
      content:
        "Genel yapı boyuna kıyı tipi olsa da Akdeniz kıyısında birçok farklı şekil yan yana görülür. Antalya şehir merkezinde karstik arazide falezler (yalıyarlar) vardır. Kaş ve Kekova açıklarında Dalmaçya tipi kıyı, Mersin Silifke'de ise kanyonlara deniz dolmasıyla oluşan kalanklı kıyı görülür. Seyhan ve Ceyhan'ın biriktirdiği alüvyon, Türkiye'nin en büyük delta ovası Çukurova'yı ve Akyatan ile Ağyatan lagünlerini oluşturmuştur.",
      coastalTypes: [
        "Boyuna Kıyı Tipi (Toroslar)",
        "Dalmaçya Kıyı Tipi (Kaş – Kekova)",
        "Kalanklı Kıyı Tipi (Silifke)",
        "Delta Kıyıları (Çukurova Deltası)",
      ],
      coastalTypesHref: "/deniz/kiyi-tipleri",
    },
    currentsAndWaterMovement: {
      title: "Güney Kıyısını Isıtan Akıntı",
      content:
        "Doğu Akdeniz'de genel akıntı saat yönünün tersine döner. Mısır açıklarından doğuya giden sıcak akıntı Levant Denizi'nde kuzeye döner ve İskenderun Körfezi'nden Türkiye sularına girer. Oradan batıya, Mersin ve Antalya kıyılarını izleyerek Rodos'a doğru ilerler. Bu sıcak kıyı akıntısı, güney kıyılarında deniz suyunun yazın 30 °C'yi aşmasına zemin hazırlar.",
      keyPoints: [
        "Doğu Akdeniz kıyı akıntısı: İskenderun'dan Antalya'ya, batıya doğru akan sıcak su.",
        "Yüksek tuzluluk (binde 38-39): güçlü buharlaşma ve azalan nehir suyu tuzu en üst düzeye çıkarır.",
        "Rodos girdabı: açık denizde dönen, soğuk çekirdekli bu girdap besin tuzlarını derinden yüzeye taşır.",
      ],
    },
    hydrographicBalance: {
      title: "Aldığından Çok Buharlaşan Deniz",
      content:
        "Akdeniz'in su bütçesi eksidedir: yüzeyinden buharlaşan su, yağmurla ve akarsularla gelenden çok daha fazladır. Bu açığı Cebelitarık Boğazı'ndan giren Atlas Okyanusu suyu ve boğazlardan gelen Karadeniz suyu kapatır. Türkiye'den Akdeniz'e dökülen başlıca akarsular, gür karstik kaynaklarla beslenen Manavgat, Düden, Aksu ve Göksu ile Toroslar'dan doğan Seyhan, Ceyhan ve Asi'dir.",
      majorRivers: [
        "Seyhan Nehri (560 km)",
        "Ceyhan Nehri (509 km)",
        "Göksu Nehri (260 km)",
        "Manavgat Çayı (karstik)",
        "Asi Nehri",
      ],
    },
    economicGeography: {
      title: "Kıyıyı Turizm ve Ticaret Besliyor",
      content:
        "Akdeniz kıyıları Türkiye'de kitle turizminin merkezidir; yalnızca Antalya 2025'te yaklaşık 17 milyon turist ağırladı. Mersin Uluslararası Limanı; İç Anadolu, Doğu ve Güneydoğu Anadolu'nun sanayi ve tarım ihracatının ana çıkış kapısıdır. İskenderun Körfezi'nde ise demir-çelik tesisleri ile Bakü-Tiflis-Ceyhan ve Kerkük-Yumurtalık petrol boru hatlarının ucu bulunur; körfez önemli bir enerji terminalidir.",
      sectors: [
        {
          name: "Kitle Turizmi",
          desc: "Antalya, Alanya ve Kemer kıyılarında büyük oteller ve plajlar.",
        },
        {
          name: "Mersin Uluslararası Limanı",
          desc: "Türkiye'nin en büyük konteyner limanı; iç bölgelerin yükü buradan gemiye aktarılır.",
        },
        {
          name: "Ceyhan Enerji Terminali",
          desc: "Uluslararası petrol boru hatlarının Akdeniz'e ulaştığı nokta.",
        },
      ],
    },
    humanGeography: {
      title: "Seyrek Platolar, Kalabalık Ovalar",
      content:
        "Akdeniz kıyısında yerleşme iki farklı yüz gösterir. Batıda Teke ve Taşeli platoları karstik ve engebeli olduğu için seyrek nüfusludur. Antalya Ovası, doğudaki Çukurova deltası (Adana, Mersin, Tarsus) ve Hatay grabeni ise Türkiye'nin en kalabalık tarım ve sanayi alanları arasındadır. Turizmin açtığı işler kıyı şehirlerine ülkenin her yerinden göç çeker.",
      points: [
        "Antalya ve Çukurova hızla büyüyen, göç alan şehir bölgeleri.",
        "Teke ve Taşeli platoları karst ve dağlık yapı yüzünden seyrek nüfuslu.",
        "Kıyı boyunca sera tarımı ile turizm tesisleri aynı arazi için yarışır.",
      ],
    },
    environmentalIssues: {
      title: "Süveyş'ten Gelen İstilacı Türler",
      content:
        "Akdeniz'in en güncel biyolojik sorunu, 1869'da açılan Süveyş Kanalı'ndan geçip Kızıldeniz ve Hint Okyanusu'ndan gelen tropikal türlerdir; bu göçe Lessepsiyen göç denir. Deniz ısındıkça zehirli balon balığı (Lagocephalus sceleratus) ve aslan balığı gibi istilacı türler hızla çoğaldı; yerli balıklara ve balıkçı ağlarına ağır zarar veriyorlar. Su az yenilendiği için Doğu Akdeniz kıyıları küçük plastik parçacıkların en çok biriktiği yerler arasında.",
      risks: [
        "Lessepsiyen istilacı türler: zehirli balon balığı ve aslan balığı.",
        "Isınma ve tuzlanma: tropikalleşen Doğu Akdeniz suyu yerli türleri geriletiyor.",
        "Plastik kirliliği: nehirlerden ve gemilerden gelen büyük ve küçük plastik parçalar birikiyor.",
      ],
    },
    faq: [
      {
        question: "Akdeniz neden Türkiye'nin en sıcak ve en tuzlu denizi?",
        answer:
          "Ekvator'a en yakın, yani en güneydeki denizimiz olduğu için güneş ışınlarını daha dik açıyla alır. Güneşlenme süresi uzun, hava sıcak olduğundan buharlaşma güçlüdür. Buharlaşan su tuzu geride bırakır ve tuzluluk binde 38-39'a çıkar.",
      },
      {
        question: "Lessepsiyen tür ne demek, Akdeniz'i nasıl etkiliyor?",
        answer:
          "Süveyş Kanalı açıldıktan sonra Kızıldeniz'den Akdeniz'e geçen Hint-Pasifik kökenli canlılara denir. Balon balığı ve aslan balığı gibi yırtıcı ve zehirli türler Akdeniz'in yerli canlılarını ve balıkçılığı tehdit ediyor.",
      },
      {
        question: "Antalya falezleri nasıl oluştu?",
        answer:
          "Antalya şehir merkezi, akarsuların ve karstik kaynakların çökelttiği traverten düzlüğünün üstüne kurulmuştur. Dalgalar bu yumuşak traverten katmanının altını oymuş, üstteki kütleler dik biçimde kırılıp düşmüş ve 30-40 metre yüksekliğinde deniz uçurumları oluşmuştur.",
      },
    ],
  },
};
