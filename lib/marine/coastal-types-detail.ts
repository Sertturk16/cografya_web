export interface CoastalTypeItem {
  id: string;
  name: string;
  badge: string;
  regions: string;
  formation: string;
  characteristics: string[];
  turkeyExamples: string[];
  seaLinks: { label: string; href: string }[];
}

export interface NonExistentCoastalType {
  name: string;
  formation: string;
  whyNotInTurkey: string;
  globalExamples: string;
}

export const COASTAL_TYPES_DATA: CoastalTypeItem[] = [
  {
    id: "boyuna",
    name: "Boyuna Kıyı Tipi (Pasifik Tipi)",
    badge: "Karadeniz & Akdeniz",
    regions: "Karadeniz ve Akdeniz Kıyı Kuşağı",
    formation:
      "Sıradağların kıyı çizgisine paralel uzandığı alanlarda denizin dağ etekleriyle doğrudan buluşmasıyla meydana gelir. Dağların denize paralel olması iç kesimlerle kıyı arasındaki hava kütlesi geçişini keser; denizel nemli hava dağ yamaçlarına çarparak bol orografik yağış bırakırken iç bölgeler karasallaşır.",
    characteristics: [
      "Kıyı çizgisi düz ve sadedir; girinti, çıkıntı, doğal liman ve koy sayısı son derece azdır.",
      "Kıta sahanlığı (şelf alanı) çok dardır; kıyıdan birkaç yüz metre açılınca deniz tabanı dik eğimlerle aniden derinleşir.",
      "Dalga aşındırması yoğundur; yüksek enerjili dalgaların dik yamaçları alttan oymasıyla falez (yalıyar) oluşumu yaygındır.",
      "Kıyı ile iç kesimler arasındaki ulaşım ancak dağları aşan derin vadi geçitleriyle (Zigana, Kop, Gülek, Sertavul, Çubuk) sağlanabilir.",
    ],
    turkeyExamples: [
      "Doğu ve Batı Karadeniz kıyı kuşağı (Rize, Trabzon, Giresun, Zonguldak, Cide)",
      "Batı ve Orta Toroslar kıyı şeridi (Antalya falezleri, Alanya, Anamur)",
    ],
    seaLinks: [
      { label: "Karadeniz Coğrafyası & Telemetrisi", href: "/v2/deniz/karadeniz" },
      { label: "Akdeniz Havzası & Telemetrisi", href: "/v2/deniz/akdeniz" },
    ],
  },
  {
    id: "enine",
    name: "Enine Kıyı Tipi (Atlantik Tipi)",
    badge: "Ege Bölgesi",
    regions: "Ege Kıyıları (Edremit – Kuşadası Arası)",
    formation:
      "Dağ sıralarının kıyı çizgisine dik uzandığı alanlarda görülür. Batı Anadolu'daki graben çöküntüleri (Bakırçay, Gediz, Küçük Menderes, Büyük Menderes vadileri) deniz suları altında kalarak derin körfezler oluşturmuş; aralarındaki horst dağ kütleleri (Kazdağı, Madra, Yunt, Bozdağlar, Aydın Dağları) ise denize doğru yarımada ve burunlar halinde uzanmıştır.",
    characteristics: [
      "Girinti, çıkıntı, koy, körfez, burun ve yarımada sayısı Türkiye'nin en yüksek seviyesindedir.",
      "Türkiye'nin gerçek kıyı uzunluğu ile kuş uçuşu kıyı uzunluğu arasındaki farkın en yüksek olduğu kıyı tipidir.",
      "Kıta sahanlığı (şelf alanı) son derece geniştir; deniz tabanı çok yumuşak bir eğimle derinleşir.",
      "Dalga biriktirmesi yoğundur; geniş plajlar, kumsallar ve deltalar oluşmuştur.",
      "Denizel ılıman Akdeniz iklimi graben vadileri boyunca 150-200 kilometre iç kesimlere (Denizli, Uşak sınırına) kadar sokulabilir.",
    ],
    turkeyExamples: [
      "Edremit Körfezi, Çandarlı Körfezi, İzmir Körfezi, Kuşadası Körfezi",
      "Karaburun Yarımadası, Çeşme Yarımadası, Dilek Yarımadası",
    ],
    seaLinks: [{ label: "Ege Denizi Coğrafyası & Telemetrisi", href: "/v2/deniz/ege" }],
  },
  {
    id: "ria",
    name: "Ria Kıyı Tipi",
    badge: "Boğazlar & Gökova",
    regions: "İstanbul Boğazı, Çanakkale Boğazı, Haliç, Gökova Körfezi",
    formation:
      "Dördüncü Zaman (Kuvaterner) başlarında, buzul çağlarının sona ermesi ve kıtasal buzulların erimesiyle dünya deniz seviyesi küresel çapta (östatik hareket) yükselmiştir. Bu süreçte kara içlerindeki derin akarsu vadi yataklarının deniz suları altında boğulmasıyla dik yamaçlı, derin ve doğal su yolları olan 'ria' tipi kıyılar meydana gelmiştir.",
    characteristics: [
      "Eski akarsu yatağı morfolojisini koruduğu için kıvrımlı, doğal korunaklı ve derin su yollarıdır.",
      "Doğal liman niteliği taşır; dalga enerjisinden korunmuş sığınma alanları sunar.",
      "Boğazlar örneğinde iki farklı deniz havzasını birbirine bağlayan stratejik deniz ulaştırma koridorlarına dönüşmüştür.",
    ],
    turkeyExamples: [
      "İstanbul Boğazı (eski bir akarsu vadisinin boğulması)",
      "Haliç (Altın Boynuz - Alibeyköy ve Kâğıthane derelerinin ortak vadisi)",
      "Çanakkale Boğazı",
      "Muğla Gökova Körfezi kıyı girintileri",
    ],
    seaLinks: [
      { label: "Marmara Denizi Coğrafyası & Telemetrisi", href: "/v2/deniz/marmara" },
      { label: "Ege Denizi Coğrafyası & Telemetrisi", href: "/v2/deniz/ege" },
    ],
  },
  {
    id: "dalmacya",
    name: "Dalmaçya Kıyı Tipi",
    badge: "Antalya (Kaş – Finike)",
    regions: "Teke Yarımadası Güney Kıyıları (Kaş, Kalkan, Kekova)",
    formation:
      "Kıyı çizgisine paralel uzanan sıradağların aralarındaki senklinal (çukur) vadi oluklarının Dördüncü Zaman deniz seviyesi yükselmesiyle sular altında kalması sonucu oluşur. Vadiler suyla dolarken, suyun üzerinde kalan dağ sırtları ve tepeleri kıyı çizgisine paralel dizilmiş ada ve adacık zincirlerine dönüşmüştür.",
    characteristics: [
      "Kıyıya paralel uzanan çok sayıda irili ufaklı ada, yarımada ve su altı kanalı bulunur.",
      "Kıyı çizgisi ile adalar arasında korunaklı, durgun ve sığ lagün benzeri deniz boğazları oluşur.",
      "Adriyatik Denizi'ndeki Hırvatistan kıyılarının (Dalmaçya sahili) minyatür bir benzeridir.",
    ],
    turkeyExamples: [
      "Antalya Kaş – Kalkan kıyı kuşağı",
      "Kekova Batık Şehir ve çevresindeki paralel adacıklar kümesi",
      "Finike açıkları",
    ],
    seaLinks: [{ label: "Akdeniz Havzası & Telemetrisi", href: "/v2/deniz/akdeniz" }],
  },
  {
    id: "lagun_limanli",
    name: "Limanlı ve Lagün (Denizkulağı) Kıyı Tipi",
    badge: "Marmara & Karadeniz",
    regions: "Marmara'nın Kuzeyi, Karadeniz Kıyı Gölleri, Çukurova Deltası",
    formation:
      "Geniş tabanlı sığ koyların ve nehir ağızlarının önünde dalgaların ve kıyı akıntılarının taşıdığı kumların birikmesiyle kıyı kordonları (kıyı okları) oluşur. Bu kordon zamanla koyun ağzını tamamen veya kısmen kapatarak denizle bağlantısı daralan bir kıyı set gölü (lagün / denizkulağı) meydana getirir. Kıyı oku bir adayı karaya bağladığında ise 'saplı ada' (tombolo) oluşur.",
    characteristics: [
      "Dalga biriktirme faaliyetinin aşındırmadan daha güçlü olduğu sığ deniz kıyılarında gelişir.",
      "Deniz tabanı son derece sığ ve kumluktur; zengin sulak alan ve kuş cenneti ekosistemlerine ev sahipliği yapar.",
      "Dalgakıran görevi gören kıyı setleri geride fırtınasız doğal liman cepleri oluşturur.",
    ],
    turkeyExamples: [
      "Büyükçekmece ve Küçükçekmece Gölleri (Marmara kıyısı lagünleri)",
      "Terkos (Durusu) Gölü (Karadeniz kıyısı lagünü)",
      "Akyatan ve Ağyatan Lagünleri (Adana Çukurova deltası kıyıları)",
      "Kapıdağ Yarımadası (Balıkesir) ve Sinop İnceburun (Tombolo / Saplı Ada örnekleri)",
    ],
    seaLinks: [
      { label: "Marmara Denizi Coğrafyası & Telemetrisi", href: "/v2/deniz/marmara" },
      { label: "Karadeniz Coğrafyası & Telemetrisi", href: "/v2/deniz/karadeniz" },
    ],
  },
  {
    id: "kalankli",
    name: "Kalanklı Kıyı Tipi",
    badge: "Mersin (Silifke)",
    regions: "Mersin Taşeli Platosu Kıyıları (Silifke – Narlıkuyu)",
    formation:
      "Kalkerli (kireçtaşı / karstik) arazilerde yer altı ve yer üstü sularının kireçtaşını kimyasal olarak eritmesiyle derin kanyon vadiler ve kuyu benzeri çöküntüler oluşur. Deniz seviyesinin yükselmesiyle bu dik yamaçlı, dar ve derin karstik kanyonların tabanı deniz suları ile dolarak 'kalank' adı verilen benzersiz fiyort benzeri koylar meydana getirir.",
    characteristics: [
      "Koyların yamaçları son derece dik, beyaz kalker kayalıklarından oluşur.",
      "Koyların tabanından veya kenarından denize karışan soğuk karstik tatlı su kaynakları bulunur.",
      "Akdeniz havzasında yalnızca Marsilya kıyılarında ve Türkiye'de Mersin kıyılarında rastlanır.",
    ],
    turkeyExamples: [
      "Mersin Silifke kıyı kuşağı",
      "Narlıkuyu Koyu (Cennet-Cehennem obruklarının deniz çıkışı)",
    ],
    seaLinks: [{ label: "Akdeniz Havzası & Telemetrisi", href: "/v2/deniz/akdeniz" }],
  },
];

export const NON_EXISTENT_COASTAL_TYPES: NonExistentCoastalType[] = [
  {
    name: "Fiyort Kıyı Tipi",
    formation:
      "Buzul vadilerinin (U profilli tekneler) deniz seviyesinin yükselmesiyle sular altında kalması sonucu oluşan dik, derin ve uzun körfezlerdir.",
    whyNotInTurkey:
      "**Mutlak (Matematiksel) Konum Nedeniyle Görülmez:** Türkiye orta kuşakta (36°-42° Kuzey enlemleri) yer alır. Buzul çağlarında dahi kıtasal buzullar deniz seviyesine kadar inememiş, yalnızca 2.200-2.500 metrenin üzerindeki yüksek dağ zirvelerinde etkili olmuştur.",
    globalExamples: "Norveç kıyıları, Şili'nin güneyi, Yeni Zelanda fiyortları.",
  },
  {
    name: "Skyer Kıyı Tipi",
    formation:
      "Hörgüçkayalar ve moren tepeciklerinin sular altında kalmasıyla oluşan binlerce buzul kökenli adacık ve kayalıktan meydana gelen kıyılardır.",
    whyNotInTurkey:
      "**Mutlak (Matematiksel) Konum Nedeniyle Görülmez:** Fiyort gibi bu kıyı tipi de buzul aşındırma ve biriktirmesine bağlıdır. Türkiye kıyılarında buzul morfolojisi oluşmamıştır.",
    globalExamples: "İsveç ve Finlandiya kıyıları, Kanada Arktik Adaları.",
  },
  {
    name: "Haliç (Estuar) ve Watt Kıyı Tipi",
    formation:
      "Okyanuslardaki Ay ve Güneş çekimine bağlı yüksek gel-git (med-cezir) genliğinin (4-10 metre) akarsu ağızlarını derinleştirip aşındırmasıyla haliç; gel-gitte suların çekilmesiyle ortaya çıkan çamur düzlükleriyle watt kıyıları oluşur.",
    whyNotInTurkey:
      "**Göreceli (Özel) Konum Nedeniyle Görülmez:** Türkiye'yi çevreleyen Karadeniz, Marmara, Ege ve Akdeniz birer iç deniz ve yarı kapalı havzadır. Cebelitarık ve Çanakkale boğazları okyanus gel-git enerjisini kestiği için kıyılarımızda gel-git genliği 20-40 santimetreyi geçmez. Bu sebeple akarsu ağızlarında haliç değil, tam aksine alüvyon birikintisi olan deltalar (Çukurova, Bafra, Çarşamba, Silifke) oluşur.",
    globalExamples: "İngiltere Thames Halici, Almanya Elbe Nehri kıyıları, Hollanda Watt Denizi.",
  },
];
