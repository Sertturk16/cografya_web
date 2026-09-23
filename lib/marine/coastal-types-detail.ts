export interface CoastalTypeItem {
  id: string;
  name: string;
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
    regions: "Karadeniz ve Akdeniz Kıyı Kuşağı",
    formation:
      "Sıradağlar kıyıya paralel uzanır ve deniz doğrudan dağ eteğine dayanır. Dağlar, denizden gelen nemli havanın önünü keser: hava yamaca çarpıp yükselir ve kıyıya bol yağış bırakır. Dağların ardındaki iç kesimlere ise kuru hava kalır, iklim karasallaşır.",
    characteristics: [
      "Kıyı çizgisi düz; girinti çıkıntı, doğal liman ve koy çok az.",
      "Kıta sahanlığı çok dar. Kıyıdan birkaç yüz metre açılınca taban dik bir eğimle birden derinleşir.",
      "Güçlü dalgalar dik yamaçların altını oyar, üstteki kaya çöker; falez (yalıyar) bu yüzden yaygındır.",
      "Kıyıdan iç kesimlere ancak dağları aşan geçitlerden gidilir: Zigana, Kop, Gülek, Sertavul, Çubuk.",
    ],
    turkeyExamples: [
      "Doğu ve Batı Karadeniz kıyı kuşağı (Rize, Trabzon, Giresun, Zonguldak, Cide)",
      "Batı ve Orta Toroslar kıyı şeridi (Antalya falezleri, Alanya, Anamur)",
    ],
    seaLinks: [
      { label: "Karadeniz", href: "/deniz/karadeniz" },
      { label: "Akdeniz", href: "/deniz/akdeniz" },
    ],
  },
  {
    id: "enine",
    name: "Enine Kıyı Tipi (Atlantik Tipi)",
    regions: "Ege Kıyıları (Edremit – Kuşadası Arası)",
    formation:
      "Dağ sıraları kıyıya dik uzanır. Batı Anadolu'da yer kabuğu kırılıp çökmüş, çöken yerler graben, yükselen yerler horst olmuş. Grabenlerin (Bakırçay, Gediz, Küçük Menderes ve Büyük Menderes vadileri) denize açılan uçlarını deniz basıp körfezlere çevirmiş. Aradaki horst dağları (Kazdağı, Madra, Yunt, Bozdağlar, Aydın Dağları) ise denize yarımada ve burun olarak uzanır.",
    characteristics: [
      "Türkiye'de en çok koy, körfez, burun ve yarımada bu kıyıda.",
      "Kıyı boyunca ölçülen uzunlukla kuş uçuşu uzaklık arasındaki fark en çok bu tipte açılır.",
      "Kıta sahanlığı geniş; taban çok yavaş derinleşir.",
      "Dalgalar aşındırmaktan çok biriktirir: geniş plajlar, kumsallar ve deltalar oluşmuş.",
      "Ilıman Akdeniz iklimi graben vadileri boyunca 150-200 km içeriye, Denizli ve Uşak sınırına kadar sokulur.",
    ],
    turkeyExamples: [
      "Edremit Körfezi, Çandarlı Körfezi, İzmir Körfezi, Kuşadası Körfezi",
      "Karaburun Yarımadası, Çeşme Yarımadası, Dilek Yarımadası",
    ],
    seaLinks: [{ label: "Ege Denizi", href: "/deniz/ege" }],
  },
  {
    id: "ria",
    name: "Ria Kıyı Tipi",
    regions: "İstanbul Boğazı, Çanakkale Boğazı, Haliç, Gökova Körfezi",
    formation:
      "Dördüncü Zaman'da buzul çağları sona erince kıtaları örten buzullar eridi ve deniz seviyesi tüm dünyada yükseldi. Yükselen deniz, kıyıya açılan derin akarsu vadilerine doldu. Böylece yamaçları dik, derin ve doğal su yolları oluştu; bunlara ria denir.",
    characteristics: [
      "Eski akarsu yatağının kıvrımlarını korur; su yolu derin ve dalgadan korunaklıdır.",
      "Doğal liman olarak kullanılır, gemiler fırtınada buraya sığınır.",
      "Boğazlarda iki denizi birbirine bağlar ve önemli birer deniz yolu olur.",
    ],
    turkeyExamples: [
      "İstanbul Boğazı (eski bir akarsu vadisinin boğulması)",
      "Haliç (Altın Boynuz - Alibeyköy ve Kâğıthane derelerinin ortak vadisi)",
      "Çanakkale Boğazı",
      "Muğla Gökova Körfezi kıyı girintileri",
    ],
    seaLinks: [
      { label: "Marmara Denizi", href: "/deniz/marmara" },
      { label: "Ege Denizi", href: "/deniz/ege" },
    ],
  },
  {
    id: "dalmacya",
    name: "Dalmaçya Kıyı Tipi",
    regions: "Teke Yarımadası Güney Kıyıları (Kaş, Kalkan, Kekova)",
    formation:
      "Kıyıya paralel uzanan sıradağların arasında çukur vadiler (senklinaller) vardır. Dördüncü Zaman'da deniz yükselince bu vadiler sular altında kaldı. Suyun üstünde kalan sırtlar ve tepeler, kıyıya paralel dizilmiş ada ve adacıklara dönüştü.",
    characteristics: [
      "Kıyı boyunca sıralanan irili ufaklı adalar, yarımadalar ve su altı kanalları görürsün.",
      "Kıyıyla adalar arasında korunaklı, durgun ve sığ geçitler kalır.",
      "Adını aldığı Hırvatistan'ın Dalmaçya kıyısının küçük bir benzeridir.",
    ],
    turkeyExamples: [
      "Antalya Kaş – Kalkan kıyı kuşağı",
      "Kekova Batık Şehir ve çevresindeki paralel adacıklar kümesi",
      "Finike açıkları",
    ],
    seaLinks: [{ label: "Akdeniz", href: "/deniz/akdeniz" }],
  },
  {
    id: "lagun_limanli",
    name: "Limanlı ve Lagün (Denizkulağı) Kıyı Tipi",
    regions: "Marmara'nın Kuzeyi, Karadeniz Kıyı Gölleri, Çukurova Deltası",
    formation:
      "Dalgaların ve kıyı akıntılarının taşıdığı kum, geniş ve sığ koyların ya da nehir ağızlarının önünde birikir. Böylece kıyı kordonu ya da kıyı oku denen bir set oluşur. Set zamanla koyun ağzını kısmen ya da tamamen kapatır; arkasında denizle bağı daralmış bir göl kalır. Buna lagün ya da denizkulağı denir. Kıyı oku bir adayı karaya bağlarsa ortaya saplı ada, yani tombolo çıkar.",
    characteristics: [
      "Dalgaların biriktirdiğinin aşındırdığından fazla olduğu sığ kıyılarda gelişir.",
      "Taban çok sığ ve kumlu. Çevresinde sulak alanlar ve kuş cennetleri bulunur.",
      "Kıyı seti dalgakıran gibi çalışır; arkasında fırtınadan korunan doğal liman cepleri kalır.",
    ],
    turkeyExamples: [
      "Büyükçekmece ve Küçükçekmece Gölleri (Marmara kıyısı lagünleri)",
      "Terkos (Durusu) Gölü (Karadeniz kıyısı lagünü)",
      "Akyatan ve Ağyatan Lagünleri (Adana Çukurova deltası kıyıları)",
      "Kapıdağ Yarımadası (Balıkesir) ve Sinop İnceburun, iki tombolo örneği",
    ],
    seaLinks: [
      { label: "Marmara Denizi", href: "/deniz/marmara" },
      { label: "Karadeniz", href: "/deniz/karadeniz" },
    ],
  },
  {
    id: "kalankli",
    name: "Kalanklı Kıyı Tipi",
    regions: "Mersin Taşeli Platosu Kıyıları (Silifke – Narlıkuyu)",
    formation:
      "Kireçtaşı suda yavaşça erir. Yer altı ve yer üstü suları kireçtaşını eritip derin kanyonlar ve kuyu gibi çöküntüler açar. Deniz yükselince bu dar, derin ve dik yamaçlı kanyonların tabanını su doldurur. Ortaya fiyorda benzeyen koylar çıkar; bunlara kalank denir.",
    characteristics: [
      "Yamaçları çok dik, beyaz kireçtaşı kayalıklar.",
      "Koyların dibinden ya da kenarından denize soğuk tatlı su kaynakları karışır.",
      "Akdeniz'de yalnızca Marsilya kıyılarında ve Türkiye'de Mersin kıyılarında görülür.",
    ],
    turkeyExamples: [
      "Mersin Silifke kıyı kuşağı",
      "Narlıkuyu Koyu (Cennet-Cehennem obruklarının deniz çıkışı)",
    ],
    seaLinks: [{ label: "Akdeniz", href: "/deniz/akdeniz" }],
  },
];

export const NON_EXISTENT_COASTAL_TYPES: NonExistentCoastalType[] = [
  {
    name: "Fiyort Kıyı Tipi",
    formation:
      "Buzulların oyduğu U biçimli vadiler, deniz yükselince sular altında kalır. Sonuç dik, derin ve uzun körfezlerdir.",
    whyNotInTurkey:
      "Matematik konum yüzünden. Türkiye orta kuşakta, 36°-42° kuzey enlemleri arasında. Buzul çağlarında bile buzullar deniz seviyesine inmedi; yalnızca 2.200-2.500 metrenin üstündeki dağ zirvelerinde kaldı.",
    globalExamples: "Norveç kıyıları, Şili'nin güneyi, Yeni Zelanda fiyortları.",
  },
  {
    name: "Skyer Kıyı Tipi",
    formation:
      "Buzulun cilaladığı hörgüç kayalar ve buzulun bıraktığı moren tepecikleri sular altında kalır. Kıyı, binlerce adacık ve kayalıkla dolar.",
    whyNotInTurkey:
      "Yine matematik konum yüzünden. Skyer de fiyort gibi buzulların aşındırıp biriktirdiği şekillerden doğar ve Türkiye kıyılarında buzul şekli hiç oluşmadı.",
    globalExamples: "İsveç ve Finlandiya kıyıları, Kanada Arktik Adaları.",
  },
  {
    name: "Haliç (Estuar) ve Watt Kıyı Tipi",
    formation:
      "Okyanuslarda Ay'ın ve Güneş'in çekimi gel-git yaratır ve su 4-10 metre alçalıp yükselir. Bu güçlü hareket akarsu ağızlarını oyup derinleştirir: haliç böyle oluşur. Sular çekildiğinde açıkta kalan çamur düzlükleri de watt kıyısıdır.",
    whyNotInTurkey:
      "Özel konum yüzünden. Karadeniz, Marmara, Ege ve Akdeniz iç ya da yarı kapalı denizler. Cebelitarık ve Çanakkale boğazları okyanusun gel-git gücünü kestiği için kıyılarımızda gel-git 20-40 santimetreyi geçmez. Akarsu ağızlarını oyacak güç olmadığından orada haliç değil, alüvyonun biriktiği deltalar oluşur: Çukurova, Bafra, Çarşamba, Silifke.",
    globalExamples: "İngiltere Thames Halici, Almanya Elbe Nehri kıyıları, Hollanda Watt Denizi.",
  },
];
