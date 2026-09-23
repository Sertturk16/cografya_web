import type { Continent } from "@/lib/api/types";

export interface ContinentSubregionInfo {
  nameTr: string;
  nameEn: string;
  descriptionTr: string;
  sampleCountriesTr: string[];
}

export interface ContinentFaq {
  question: string;
  answer: string;
}

export interface ContinentDetailData {
  id: Continent;
  slugTr: string;
  slugEn: string;
  nameTr: string;
  nameEn: string;
  code: string;
  taglineTr: string;

  // Hero & Key Facts Metrics
  countryCount: number;
  countryCountNoteTr?: string;
  population: number; // approximate total
  populationFormattedTr: string;
  populationSharePercent: number; // % of world population
  areaKm2: number;
  areaFormattedTr: string;
  areaSharePercent: number; // % of world land area
  densityPerKm2: number;

  highestPoint: {
    name: string;
    elevationM: number;
    locationTr: string;
  };
  lowestPoint: {
    name: string;
    elevationM: number;
    locationTr: string;
    noteTr?: string;
  };
  longestRiver: {
    name: string;
    lengthKm: number;
    noteTr?: string;
  };
  largestLake: {
    name: string;
    areaKm2: number;
  };
  dominantClimateTr: string;
  classificationSourceTr: string;

  // Summary points for cards
  keyCharacteristicsTr: string[];

  // Prose sections (ne -> nerede -> neden -> sonuç)
  prose: {
    introTr: string;
    locationAndBordersTr: string;
    landformsAndGeologyTr: string;
    climateAndVegetationTr: string;
    hydrographyTr: string;
    populationAndSettlementTr: string;
    economyAndResourcesTr: string;
    subregionsIntroTr: string;
    disasterAndEnvironmentTr: string;
    historicalAndCulturalTr: string;
  };

  // Subregions (UN M49)
  subregions: ContinentSubregionInfo[];

  // Disaster profile
  disasterProfile: {
    primaryRisks: string[];
    faultLinesOrZones: string[];
    warningNoteTr: string;
  };

  // Curated FAQs
  faqs: ContinentFaq[];
}

/**
 * The FAQ block on the `/dunya/kita` HUB — the questions about the continent SYSTEM ("how many
 * continents are there", "why are Europe and Asia counted separately") rather than about any one
 * continent, which is why they are not a `faqs` field on a registry entry.
 *
 * It lived as a page-local `HUB_FAQS` const in `app/[locale]/(site)/dunya/kita/page.tsx` until
 * T-035 PR5. Moved here because that is where the other 28 continent questions already live, and
 * because a page module is not reachable from a unit test: the uniqueness guarantee
 * `components/v2/page-composition-faq.test.ts` asserts over every FAQ source (Ruling CE) could not
 * cover it while it sat in a page. `FaqSection` keys its items by the question string, so a
 * duplicate here is a real defect and not a style point.
 */
export const CONTINENT_HUB_FAQS: readonly ContinentFaq[] = [
  {
    question: "Dünyada kaç kıta vardır?",
    answer:
      "Hangi modele baktığına göre değişir. Türkiye'de okullarda 7 kıta öğretilir: Asya, Afrika, Kuzey Amerika, Güney Amerika, Antarktika, Avrupa ve Okyanusya. Birleşmiş Milletler'in istatistik sınıflandırması iki Amerika'yı tek grupta topladığı için 6 kıtayla çalışır. Jeolojiye bakarsan Avrupa ile Asya da ayrı değildir, ikisi birlikte Avrasya'yı oluşturur.",
  },
  {
    question: "Avrupa ile Asya neden iki ayrı kıta sayılır?",
    answer:
      "Aralarında okyanus da levha sınırı da yok; jeolojik olarak tek bir kara kütlesidir. İkiye ayrılmaları 18. yüzyıldan beri süren tarihî ve kültürel bir alışkanlıktır. Sınır olarak genellikle Ural Dağları, Ural Nehri, Hazar Denizi ve Türk Boğazları kabul edilir.",
  },
  {
    question: "En büyük ve en küçük kıta hangisi?",
    answer:
      "En büyüğü Asya: yaklaşık 44,6 milyon km² yüzölçümü ve 4,75 milyarı aşan nüfusuyla hem alanda hem nüfusta birinci. En küçüğü yaklaşık 8,5 milyon km² karasıyla Okyanusya; bu alanın büyük kısmı Avustralya anakarasıdır.",
  },
  {
    question: "Antarktika neden kıta sayılır, üzerinde ülke var mı?",
    answer:
      "Çünkü buzun altında yaklaşık 14,2 milyon km²'lik gerçek bir kara var. Kuzey Kutbu'nda ise altında kara olmayan, donmuş deniz buzu bulunur. Antarktika'da hiçbir devlet ve kalıcı yerleşim yok; 1959 Antarktika Antlaşması kıtayı barışçıl amaçlara ve bilime ayırdı.",
  },
  {
    question: "Okyanusya kıta mı, bölge mi?",
    answer:
      "7 kıta modelinde kıtadır: Avustralya anakarası ve Büyük Okyanus'a dağılmış Polinezya, Mikronezya ve Melanezya adaları Okyanusya adı altında toplanır. Karası 8,5 milyon km², ama ülkelerinin denizdeki ekonomik hak alanı 40 milyon km²'yi aşar; bu, karanın neredeyse 5 katıdır.",
  },
];

export const CONTINENTS_REGISTRY: Record<string, ContinentDetailData> = {
  afrika: {
    id: "AFRIKA",
    slugTr: "afrika",
    slugEn: "africa",
    nameTr: "Afrika",
    nameEn: "Africa",
    code: "AF",
    taglineTr:
      "Ekvator tam ortasından geçer; kuzeye ve güneye gittikçe aynı iklim kuşakları sırayla tekrar eder.",
    countryCount: 54,
    countryCountNoteTr: "BM üyesi 54 bağımsız devlet.",
    population: 1460000000,
    populationFormattedTr: "1,46 Milyar",
    populationSharePercent: 18.2,
    areaKm2: 30370000,
    areaFormattedTr: "30.370.000 km²",
    areaSharePercent: 20.4,
    densityPerKm2: 48,
    highestPoint: {
      name: "Kilimanjaro Dağı",
      elevationM: 5895,
      locationTr: "Tanzanya (Kibo Zirvesi)",
    },
    lowestPoint: {
      name: "Assal Gölü",
      elevationM: -155,
      locationTr: "Cibuti (Afar Çöküntüsü)",
      noteTr: "Deniz seviyesinin 155 m altında, kıtanın en derin tektonik çukurluğu.",
    },
    longestRiver: {
      name: "Nil Nehri",
      lengthKm: 6650,
      noteTr: "Beyaz Nil ve Mavi Nil kollarının Hartum'da birleşmesiyle Akdeniz'e ulaşır.",
    },
    largestLake: {
      name: "Victoria Gölü",
      areaKm2: 68800,
    },
    dominantClimateTr: "Ekvatoral Yağmur Ormanı, Savan, Step ve Sıcak Çöl (Hadley Hücresi Kuşağı)",
    classificationSourceTr: "BM İstatistik Bölümü (UN M49) — 5 Coğrafi Alt Bölge",
    keyCharacteristicsTr: [
      "Sahra, dünyanın en geniş sıcak çölü",
      "Doğu Afrika Rift Vadisi'nde levhalar ayrılıyor, yanardağlar yükseliyor",
      "Ekvatorun iki yanında aynı bitki kuşakları ayna gibi sıralanır",
    ],
    prose: {
      introTr:
        "Ekvator Afrika'nın neredeyse tam ortasından geçer. Kongo Havzası'nın yağmur ormanlarından kuzeye de güneye de gidersen aynı sırayla savanlara, yarı kurak steplere ve sonunda çöllere varırsın. Kıtanın büyük kısmı yaşlı ve sağlam bir kabuğun üstünde durur. Bu yüzden Afrika'da uzun sıradağlar yerine yüksek platolar ve kıtayı boydan boya yaran kırık hatları öne çıkar.",
      locationAndBordersTr:
        "Afrika'nın kuzeyinde Akdeniz, batısında Atlas Okyanusu, doğusunda Hint Okyanusu ve Kızıldeniz var. Kıtanın Avrasya'ya karadan bağlandığı tek yer dar Süveyş Kıstağı'dır. 1869'da açılan Süveyş Kanalı bu son kara bağlantısını bir suyoluyla kesti. Kuzeybatıda Cebelitarık Boğazı, Afrika'yı Avrupa'dan yalnızca 14 kilometrelik bir deniz geçidiyle ayırır.",
      landformsAndGeologyTr:
        "Afrika'nın büyük bölümü Prekambriyen'den kalma, yaşlı ve durağan bir kıta kabuğu üzerindedir. Güney Amerika'daki Andlar ya da Asya'daki Himalayalar gibi kıtayı baştan başa kesen genç bir sıradağ yoktur. Onların yerine yükseltisi çoğunlukla 300 ile 1.000 metre arasında değişen basamaklı platolar ve aralarındaki çanaklar uzanır: Kongo, Çad ve Kalahari havzaları.\n\nJeolojik olarak en hareketli kesim doğudaki Doğu Afrika Rift Sistemi'dir. Ürdün Vadisi'nden Mozambik kıyılarına kadar uzanan bu hat, Nubya ve Somali levhaları birbirinden uzaklaştıkça yaklaşık 30 milyon yıldır genişliyor. Kilimanjaro ve Kenya Dağı gibi volkanik zirveler ile Afrika'nın Büyük Göller'i bu hattın ürünüdür. Güney ucunda ise iç yaylayı kıyıdan ayıran dik bir basamak, Büyük Yarkenar uzanır; Drakensberg Dağları da bu basamağın parçasıdır.",
      climateAndVegetationTr:
        "Afrika'nın iklimini büyük ölçüde Hadley hücresi denen hava dolaşımı belirler. Ekvator çevresinde ısınan hava yükselir, bol yağış bırakır ve Kongo Havzası'nın yağmur ormanlarını besler. Bu hava 20° ile 30° kuzey ve güney enlemlerinde yeniden alçalır. Alçalan hava kurudur ve yağış bırakmaz. Kuzeyde Büyük Sahra, güneyde Kalahari ve Namib çölleri bu yüzden oluşur.\n\nNamib Çölü'nün aşırı kuraklığını yalnız enlem açıklamaz. Kıyı boyunca kuzeye akan soğuk Benguela Akıntısı denizden gelen havanın alt katını soğutur. Kıyıda yoğun sis olur ama yağmur yağmaz. Kıtanın en kuzeyindeki Mağrip kıyılarında ve en güneyindeki Kap bölgesinde ise Akdeniz iklimi ve maki bitki örtüsü görülür.",
      hydrographyTr:
        "Platolar basamak basamak alçaldığı için Afrika nehirleri de basamaklı bir yatakta akar. 6.650 kilometrelik Nil iki koldan beslenir: Ekvator gölleri bölgesinden gelen Beyaz Nil ve Etiyopya Yaylaları'nda muson yağmurlarıyla dolan Mavi Nil. İki kol Hartum'da birleşir, çölü aşar ve Akdeniz'e ulaşır.\n\nKongo Nehri, Amazon'dan sonra dünyada en çok su taşıyan ikinci nehirdir. Ekvatoru iki kez keser ve yıl boyu yağış alan geniş bir havzanın suyunu toplar. Kongo, Nijer ve Zambezi yolları üzerindeki basamakları çağlayanlarla aşar; Livingstone ve Viktorya çağlayanları bunlardandır. Bu çağlayanlar, gemilerin iç kesimlerden okyanusa kesintisiz ulaşmasını tarih boyunca engelledi.",
      populationAndSettlementTr:
        "Afrika'da nüfus çok dengesiz dağılır. Suyun ve verimli toprağın bulunduğu yerler kalabalıktır: Nil deltası ve vadisi, Nijerya'nın büyük kentleriyle Gine Körfezi kıyısı, Etiyopya, Ruanda ve Burundi'nin volkanik topraklı serin yaylaları. Bu yerlerde kilometrekareye yüzlerce kişi düşer.\n\nSahra'nın kum ve kaya çöllerinde neredeyse hiç su yoktur. İç Kongo Havzası'nda ise aşırı nem, sık orman ve tropikal hastalıklar yerleşmeyi zorlaştırır. Bu iki bölge dünyanın en seyrek nüfuslu yerleri arasındadır.",
      economyAndResourcesTr:
        "Afrika ekonomisi büyük ölçüde maden ve enerji yataklarına dayanır. Güney Afrika'daki Witwatersrand havzası, dünyanın altın ve platin yataklarının önemli bir bölümünü barındırır. Kongo Demokratik Cumhuriyeti ile Zambiya'ya yayılan Bakır Kuşağı, pillerde kullanılan kobaltın başlıca kaynağıdır. Gine Körfezi'nde, Nijerya ve Angola açıklarında büyük petrol yatakları vardır.\n\nTarımda birkaç ürün öne çıkar. Fildişi Sahili ve Gana dünyanın en çok kakao üreten ülkeleridir; Etiyopya ve Kenya'nın yüksek yaylalarında kahve yetişir. Sömürge döneminde döşenen demiryolları hammaddeyi limanlara taşımak için yapıldı. Bu da ülkelerin birbiriyle ticaret yapmasını geciktirdi.",
      subregionsIntroTr:
        "BM'nin M49 sınıflandırması Afrika'yı beş alt bölgeye ayırır. Her birinin iklimi, kültürü ve geçim kaynakları farklıdır.",
      disasterAndEnvironmentTr:
        "Afrika'nın en ağır çevre sorunu Sahel'deki kuraklık ve çölleşmedir. Sahel, Sahra'nın hemen güneyindeki kuşaktır. İklim dalgalanmaları ve aşırı otlatma yüzünden buradaki savanlar giderek kumula dönüşüyor.\n\nDoğu Afrika'daki kırık hattı deprem üretebilir. Virunga Dağları'ndaki Nyiragongo ve Nyamuragira etkin yanardağlardır. Hem çevredeki yerleşimler hem de Kivu Gölü'nün derinlerinde birikmiş gazlar yüzünden sürekli bir tehlike oluştururlar.",
      historicalAndCulturalTr:
        "Bugünkü Afrika sınırlarının çoğu 1884-1885 Berlin Konferansı'nda Avrupalı sömürge devletleri tarafından cetvelle çizildi. Bu sınırlar nehir havzalarını ve halkların yaşadığı yerleri hesaba katmadı. Aynı halk birkaç devlete bölündü, birbiriyle çatışan topluluklar ise aynı devletin içinde kaldı. Bağımsızlıktan sonraki sınır sorunlarının çoğu buradan çıkar.",
    },
    subregions: [
      {
        nameTr: "Kuzey Afrika",
        nameEn: "Northern Africa",
        descriptionTr:
          "Büyük Sahra ile Akdeniz kıyısı arasında. Arap ve Berberi kültürü, petrol ve doğalgaz.",
        sampleCountriesTr: ["Mısır", "Cezayir", "Fas", "Tunus", "Libya", "Sudan"],
      },
      {
        nameTr: "Batı Afrika",
        nameEn: "Western Africa",
        descriptionTr:
          "Gine Körfezi kıyısından Sahel'e uzanır. Nüfusu kalabalık; tarım ve petrol öne çıkar.",
        sampleCountriesTr: ["Nijerya", "Gana", "Senegal", "Fildişi Sahili", "Mali", "Nijer"],
      },
      {
        nameTr: "Orta Afrika",
        nameEn: "Middle Africa",
        descriptionTr: "Kongo Havzası'nın yağmur ormanları, bol nehir ve zengin maden yatakları.",
        sampleCountriesTr: ["Kongo DC", "Kamerun", "Angola", "Gabon", "Çad"],
      },
      {
        nameTr: "Doğu Afrika",
        nameEn: "Eastern Africa",
        descriptionTr:
          "Rift Vadisi'nin geçtiği yer: volkanik yaylalar, Büyük Göller ve yaban hayatı.",
        sampleCountriesTr: ["Etiyopya", "Kenya", "Tanzanya", "Uganda", "Ruanda", "Madagaskar"],
      },
      {
        nameTr: "Güney Afrika",
        nameEn: "Southern Africa",
        descriptionTr: "Kalahari Çölü, elmas ve platin madenleri, ılıman kıyılar.",
        sampleCountriesTr: ["Güney Afrika", "Namibya", "Botsvana", "Zimbabve", "Zambiya"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Sahel ve Doğu Afrika'da şiddetli kuraklık ve çölleşme",
        "Doğu Afrika Rift Vadisi boyunca deprem ve yanardağ tehlikesi",
        "Madagaskar ve güneydoğu kıyılarında Hint Okyanusu siklonları",
        "Büyük nehir havzalarında ani taşkınlar",
      ],
      faultLinesOrZones: [
        "Doğu Afrika Rift Sistemi, Afar bölgesinden Mozambik'e",
        "Kızıldeniz ve Aden Körfezi'nde okyanus tabanının açıldığı hatlar",
        "Kuzey Afrika'da Atlas Dağları kıvrım kuşağı",
      ],
      warningNoteTr:
        "Doğu Afrika Rift Sistemi boyunca devam eden levha açılması, yüzeye yakın sığ odaklı depremler ve lav göllerine sahip tehlikeli volkanizma üretmektedir.",
    },
    faqs: [
      {
        question: "Afrika'da kaç bağımsız devlet var?",
        answer:
          "Afrika'da BM üyesi 54 devlet var. Bunların dışında statüsü tartışmalı topraklar da bulunur: Afrika Birliği üyesi olan ama BM'deki durumu tartışmalı Sahra Arap Demokratik Cumhuriyeti (Batı Sahra) ve fiilen bağımsız olan Somaliland.",
      },
      {
        question: "Büyük Rift Vadisi kıtayı ikiye bölecek mi?",
        answer:
          "Evet, ama çok yavaş. Doğu Afrika Rift Sistemi boyunca Nubya ve Somali levhaları yılda birkaç milimetre birbirinden uzaklaşıyor. Hesaplara göre on milyonlarca yıl içinde Doğu Afrika ana kütleden ayrılacak ve arada yeni bir okyanus oluşacak.",
      },
      {
        question: "Afrika'nın en büyük gölü ve en uzun nehri hangileri?",
        answer:
          "Kıtanın en büyük tatlı su gölü, 68.800 km² yüzölçümüyle Victoria Gölü'dür. En uzun nehri ise 6.650 kilometre boyunca akıp Akdeniz'e dökülen Nil'dir.",
      },
      {
        question: "Afrika'daki sınırlar neden cetvelle çizilmiş gibi düz?",
        answer:
          "Çünkü gerçekten öyle çizildiler. 1884-1885 Berlin Konferansı'nda Avrupalı sömürge devletleri kıtayı paylaşırken dağlara, nehir havzalarına ve halkların yaşadığı yerlere bakmadılar; sınırların çoğunu enlem ve boylam çizgilerine göre belirlediler.",
      },
    ],
  },

  asya: {
    id: "ASYA",
    slugTr: "asya",
    slugEn: "asia",
    nameTr: "Asya",
    nameEn: "Asia",
    code: "AS",
    taglineTr:
      "Dünyadaki her beş kişiden üçü Asya'da, Himalayaların ve muson yağmurlarının kıtasında yaşar.",
    countryCount: 44,
    countryCountNoteTr: "BM sınıflamasına göre, Türkiye dahil.",
    population: 4750000000,
    populationFormattedTr: "4,75 Milyar",
    populationSharePercent: 59.3,
    areaKm2: 44579000,
    areaFormattedTr: "44.579.000 km²",
    areaSharePercent: 29.8,
    densityPerKm2: 107,
    highestPoint: {
      name: "Everest Dağı",
      elevationM: 8848.86,
      locationTr: "Nepal - Çin Sınırı (Himalayalar)",
    },
    lowestPoint: {
      name: "Lut Gölü Kıyısı",
      elevationM: -430,
      locationTr: "İsrail - Ürdün Sınırı",
      noteTr: "Dünyanın kara üzerindeki en alçak noktası.",
    },
    longestRiver: {
      name: "Yangtze Nehri",
      lengthKm: 6300,
      noteTr: "Tibet Platosu'ndan doğup Doğu Çin Denizi'ne dökülür; Asya'nın en uzunu.",
    },
    largestLake: {
      name: "Hazar Denizi",
      areaKm2: 371000,
    },
    dominantClimateTr: "Muson, Step, Çöl, Karasal ve Subarktik Tundra",
    classificationSourceTr: "BM İstatistik Bölümü (UN M49) — 5 Coğrafi Alt Bölge",
    keyCharacteristicsTr: [
      "Büyük nehirlerinin çoğu Himalayalar ve Tibet Platosu'ndan doğar",
      "Dünya nüfusunun yaklaşık %60'ı burada yaşar",
      "Hem en yüksek zirve Everest hem karadaki en alçak nokta Lut Gölü bu kıtadadır",
    ],
    prose: {
      introTr:
        "Dünya karalarının yaklaşık üçte biri Asya'da; dünya nüfusunun neredeyse beşte üçü de burada yaşıyor. Kıtanın biçimini en çok Hindistan Levhası'nın Avrasya'ya çarpması belirledi. Bu çarpışma Himalayaları ve 'Dünyanın Çatısı' denen Tibet Platosu'nu yükseltti. Asya'nın iklimi de nehirleri de bu yüksek kütleye bağlıdır.",
      locationAndBordersTr:
        "Asya'yı kuzeyde Arktik Okyanusu, doğuda Büyük Okyanus, güneyde Hint Okyanusu çevreler. Batı sınırı ise bir deniz değil, insanların üzerinde anlaştığı bir çizgidir. 18. yüzyıldan bu yana Ural Dağları, Ural Nehri, Hazar Denizi, Kafkasya ve Türk Boğazları iki kıta arasındaki sınır sayılır. Bu hatta bir levha sınırı yoktur: Asya ile Avrupa, jeolojik olarak Avrasya denen tek bir kara kütlesinin parçalarıdır.",
      landformsAndGeologyTr:
        "Hindistan ve Avrasya levhaları yaklaşık 50 milyon yıldır birbirine çarpıyor. Bu çarpışma dünyanın en yüksek dağ sistemi olan Himalayaları ve ortalama 4.500 metre yükseklikteki Tibet Platosu'nu ortaya çıkardı. Pamir, Tanrı Dağları ve Karakurum sıraları da buradan çevreye uzanır ve büyük bir dağ düğümü oluşturur.\n\nKuzeyde Sibirya Kalkanı gibi eski, aşınmış ve düz araziler uzanır. Doğu ve güneydoğuda Pasifik Ateş Çemberi'nin genç volkanik adaları dizilir: Japonya, Filipinler ve Endonezya. Batıda ise Arap Levhası'nın sıkıştırmasıyla oluşan Zagros kıvrım dağları yer alır.",
      climateAndVegetationTr:
        "Tibet Platosu, Asya'nın hem en yağışlı hem en kurak yerlerini belirler. Yazın plato hızla ısınır ve üzerinde alçak basınç oluşur. Bu alçak basınç Hint Okyanusu'ndan nemli havayı çeker ve Güney ile Güneydoğu Asya'ya muson yağmurlarını getirir. Dünyanın en çok yağış alan yeri, Meghalaya eyaletindeki Çerapunçi, Himalayaların güney eteklerindedir.\n\nAynı dağ duvarı bulutların kuzeye geçmesini engeller. Bu yüzden dağların arkasında kalan Orta Asya ve Tibet, dünyanın en büyük yağmur gölgesi çöllerine dönüşür: Gobi ve Taklamakan. Kuzeyde tayga ormanları ve tundra, güneyde tropikal yağmur ormanları yaygındır.",
      hydrographyTr:
        "Tibet Platosu ve çevresindeki buzullara 'Asya'nın su kulesi' denir. Sarı Nehir, Yangtze, Mekong, Salween, Brahmaputra, Ganj ve İndus bu dağlık bölgeden doğar. Aşağı havzalarında 1,5 milyardan fazla insan içme, sulama ve enerji için bu nehirlere bağlıdır.\n\nKıtanın iç kesimlerinde okyanusa çıkışı olmayan kapalı havzalar vardır; Hazar Denizi ve Aral Gölü bunların en bilinenleridir. Lut Gölü de kapalı bir havzadır ve kıyısı karadaki en alçak noktadır. Sibirya'daki Baykal Gölü ise tek başına yeryüzündeki donmamış tatlı suyun yaklaşık beşte birini tutar.",
      populationAndSettlementTr:
        "Nüfus, muson yağmurlarının ve nehirlerin getirdiği alüvyonun tarımı mümkün kıldığı ovalarda ve deltalarda toplanır. Kuzey Çin Ovası, Yangtze Deltası, Hint-Gang Ovası ve Endonezya'nın Java Adası'nda kilometrekareye binlerce kişi düşer.\n\nTibet Platosu, Gobi Çölü, Moğolistan bozkırları ve Sibirya'nın donmuş toprakları ise sert iklim ve yükseklik yüzünden neredeyse boştur; buralarda kilometrekareye 2 kişi bile düşmez.",
      economyAndResourcesTr:
        "Basra Körfezi çevresinde dünyanın en büyük petrol ve doğalgaz yatakları bulunur. Çin, Japonya, Güney Kore ve Tayvan; elektronik, yarı iletken, otomotiv ve ağır sanayi ürünlerinin büyük kısmını üretir.\n\nPirinç, milyarlarca insanın temel besinidir. Malakka Boğazı ise dünya deniz ticaretinin en işlek geçitlerinden biridir.",
      subregionsIntroTr:
        "BM'nin M49 sınıflaması Asya'yı beş alt bölgeye ayırır. Her birinin iklimi, yeryüzü şekilleri ve kültürü ayrıdır.",
      disasterAndEnvironmentTr:
        "Japonya, Endonezya ve Filipinler, Pasifik Ateş Çemberi üzerindeki ada yaylarında yer alır; bu ülkelerde yıkıcı depremler, tsunamiler ve yanardağ patlamaları sık görülür. Himalaya kuşağında levhaların kıta içinde çarpışması 7,5 ve üzeri büyüklükte depremler üretir.\n\nMuson mevsiminde Bangladeş ve Hindistan'da nehirler taşar. Aşırı sulama yüzünden kuruyan Aral Gölü ise kıtanın en bilinen çevre felaketlerinden biridir.",
      historicalAndCulturalTr:
        "Dünyanın en eski uygarlıklarından bazıları Asya'nın nehir kıyılarında doğdu: Mezopotamya, İndus Vadisi ve Sarı Nehir. İslam, Hristiyanlık, Musevilik, Budizm ve Hinduizm de bu kıtada ortaya çıktı. Çin'den Akdeniz'e uzanan İpek Yolu, vahalar ve dağ geçitleri üzerinden yalnız mal değil inanç, alfabe ve bilim de taşıdı. Bugünkü Asya'nın kültür haritası büyük ölçüde bu yolun izlerini taşır.",
    },
    subregions: [
      {
        nameTr: "Doğu Asya",
        nameEn: "Eastern Asia",
        descriptionTr:
          "Sarı Nehir ve Yangtze havzaları. Eski uygarlıkların yurdu, bugün dünyanın en büyük üretim ve teknoloji merkezi.",
        sampleCountriesTr: ["Çin", "Japonya", "Güney Kore", "Moğolistan", "Kuzey Kore"],
      },
      {
        nameTr: "Güneydoğu Asya",
        nameEn: "South-eastern Asia",
        descriptionTr:
          "Tropikal adalar ve yarımadalar; Pasifik Ateş Çemberi'nin üzerinde, işlek deniz ticaret yollarının kıyısında.",
        sampleCountriesTr: ["Endonezya", "Malezya", "Filipinler", "Vietnam", "Tayland", "Singapur"],
      },
      {
        nameTr: "Güney Asya",
        nameEn: "Southern Asia",
        descriptionTr:
          "Himalayaların güneyi ve Hint-Gang Ovası; kalabalık nüfus ve musona bağlı tarım.",
        sampleCountriesTr: ["Hindistan", "Pakistan", "Bangladeş", "Nepal", "Sri Lanka"],
      },
      {
        nameTr: "Orta Asya",
        nameEn: "Central Asia",
        descriptionTr:
          "Okyanuslardan çok uzak bozkırlar; İpek Yolu'nun geçtiği topraklar, petrol, doğalgaz ve maden yatakları.",
        sampleCountriesTr: [
          "Kazakistan",
          "Özbekistan",
          "Türkmenistan",
          "Kırgızistan",
          "Tacikistan",
        ],
      },
      {
        nameTr: "Batı Asya",
        nameEn: "Western Asia",
        descriptionTr:
          "Bereketli Hilal ve Basra Körfezi'nin petrol sahaları; Akdeniz ile Kafkasya arasında bir köprü.",
        sampleCountriesTr: [
          "Türkiye",
          "Suudi Arabistan",
          "İran",
          "Azerbaycan",
          "BAE",
          "İsrail",
          "Gürcistan",
        ],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Pasifik Ateş Çemberi'nde deprem ve tsunami: Japonya, Endonezya, Filipinler",
        "Himalaya-Alp kuşağında yıkıcı depremler",
        "Güney ve Güneydoğu Asya'da muson taşkınları ve tropikal siklonlar",
        "Orta ve Batı Asya'da kuraklık ve toz fırtınaları",
      ],
      faultLinesOrZones: [
        "Himalaya Ana Bindirme Fayı",
        "Kuzey Anadolu ve Doğu Anadolu fayları (Türkiye)",
        "Zagros kıvrım ve bindirme kuşağı (İran)",
        "Sunda Hendeği dalma-batma zonu (Endonezya)",
      ],
      warningNoteTr:
        "Asya'nın doğu ve güneydoğu kıyıları Pasifik Ateş Çemberi'nin üstündedir; dünyadaki volkanik patlamaların ve tsunamilerin büyük bölümü bu çemberde olur.",
    },
    faqs: [
      {
        question: "Avrupa ile Asya arasındaki sınır nereden geçer?",
        answer:
          "İki kıta arasında bir levha sınırı yoktur; sınır gelenekle çizilir. Ural Dağları, Ural Nehri, Hazar Denizi, Kafkas Dağları'nın su bölümü çizgisi, Karadeniz, İstanbul Boğazı ve Çanakkale Boğazı sınır kabul edilir.",
      },
      {
        question: "Türkiye Asya kıtasında mı yer alır?",
        answer:
          "Türkiye topraklarının %97'si (Anadolu) Asya'da, %3'ü (Doğu Trakya) Avrupa'dadır. BM'nin M49 sınıflaması Türkiye'nin tamamını Batı Asya bölgesine koyar.",
      },
      {
        question: "Asya neden dünyanın en kalabalık kıtasıdır?",
        answer:
          "Muson yağmurları bol su, nehir deltaları da verimli alüvyon toprak sağlar. Bu sayede binlerce yıldır yılda birden fazla ürün, özellikle pirinç, alınabilmiş ve çok büyük nüfuslar beslenebilmiştir.",
      },
      {
        question: "Lut Gölü neden dünyanın en alçak noktasıdır?",
        answer:
          "Lut Gölü, yani Ölü Deniz, Afrika ve Arap levhalarının birbirine göre yana kaydığı Ölü Deniz fay hattı üzerindeki derin bir çöküntüdedir. Su yüzeyi deniz seviyesinin yaklaşık 430 metre altındadır.",
      },
    ],
  },

  avrupa: {
    id: "AVRUPA",
    slugTr: "avrupa",
    slugEn: "europe",
    nameTr: "Avrupa",
    nameEn: "Europe",
    code: "EU",
    taglineTr: "Denizin her yöne sokulduğu küçük bir kıta; kışlarını Golf Akıntısı yumuşatır.",
    countryCount: 43,
    countryCountNoteTr: "BM M49'a göre 43 bağımsız ülke, Rusya dahil.",
    population: 745000000,
    populationFormattedTr: "745 Milyon",
    populationSharePercent: 9.3,
    areaKm2: 10180000,
    areaFormattedTr: "10.180.000 km²",
    areaSharePercent: 6.8,
    densityPerKm2: 73,
    highestPoint: {
      name: "Elbrus Dağı",
      elevationM: 5642,
      locationTr: "Rusya (Elbrus 5.642 m) — Batı Avrupa'da Mont Blanc 4.808 m",
    },
    lowestPoint: {
      name: "Hazar Denizi Kıyısı",
      elevationM: -28,
      locationTr: "Rusya / Hazar Havzası kıyı şeridi",
    },
    longestRiver: {
      name: "Volga Nehri",
      lengthKm: 3530,
      noteTr: "Avrupa Rusyası'ndan akıp Hazar Denizi'ne dökülür; kıtanın en uzun nehri.",
    },
    largestLake: {
      name: "Ladoga Gölü",
      areaKm2: 17700,
    },
    dominantClimateTr: "Ilıman Okyanusal, Akdeniz ve Nemli Karasal",
    classificationSourceTr: "BM İstatistik Bölümü (UN M49) — 4 Coğrafi Alt Bölge",
    keyCharacteristicsTr: [
      "Girintili kıyılar: deniz, yarımadaların arasından iç kesimlere kadar sokulur",
      "Kuzey Atlantik Akıntısı sayesinde enlemine göre ılık kışlar",
      "Kentleşme yüksek, sanayi bölgeleri birbirine yakın",
    ],
    prose: {
      introTr:
        "Haritaya bakınca Avrupa, Asya'nın batıya uzanan bir yarımadası gibi durur. Bu büyük yarımada da kendi içinde küçüklerine bölünür: İber, İtalya, Balkan ve İskandinav yarımadaları. Aralarına denizler girer, bu yüzden kıtada denizden çok uzak bir yer neredeyse yoktur. Kuzey Atlantik Akıntısı kışları yumuşatır; aynı enlemdeki Sibirya ya da Kanada tundrasına göre burada yaşamak çok daha kolaydır.",
      locationAndBordersTr:
        "Batıda Atlas Okyanusu, kuzeyde Arktik Okyanusu, güneyde Akdeniz ve Karadeniz vardır. Doğu sınırı Ural Dağları, Ural Nehri ve Hazar Denizi boyunca çizilir. Güneybatıda Cebelitarık Boğazı Afrika'ya, güneydoğuda Çanakkale ve İstanbul boğazları Anadolu'ya açılır.\n\nRusya'nın topraklarının yaklaşık %77'si Ural'ın doğusunda, yani Sibirya'dadır. Ama başkenti ve nüfusunun %75'i batıda olduğu için BM M49 şeması Rusya'nın tamamını Doğu Avrupa'ya koyar.",
      landformsAndGeologyTr:
        "Güneyde genç ve yüksek dağlar, kuzeyde geniş ovalar vardır. Alpler, Pireneler, Apeninler ve Karpatlar, Afrika ile Avrasya levhalarının çarpışmasıyla yükseldi. Genç oldukları için yamaçları dik, vadileri derindir.\n\nKuzeyde Kuzey Avrupa Ovası, Fransa'dan Ural Dağları'na kadar kesintisiz uzanır. Tarih boyunca göçler, ticaret ve ordular bu düzlükten geçti. İskandinavya ve İskoçya'da ise buzul çağlarından kalan fiyortlar ve Baltık Kalkanı'nın çok eski kayaları görülür.",
      climateAndVegetationTr:
        "Avrupa'nın iklimini en çok Golf Akıntısı ile onun devamı olan Kuzey Atlantik Akıntısı ve batı rüzgârları belirler. Meksika Körfezi'nden gelen bu sıcak su sayesinde 50°-60° kuzey enlemlerindeki Londra, Paris ve Hamburg'da kışlar genellikle donma noktasının üstünde, ılık ve yağışlı geçer. Bu okyanusal iklimdir.\n\nAkdeniz kıyılarında yazlar sıcak ve kurak, kışlar ılık ve yağışlıdır. Doğuya gittikçe denizin etkisi azalır; yazlar sıcak, kışlar sert ve karlı olur. Güneyde maki, orta kesimde geniş yapraklı karışık ormanlar, kuzeyde iğne yapraklı tayga ormanları vardır.",
      hydrographyTr:
        "Avrupa nehirleri yıl boyunca düzenli akar ve birçoğu kanallarla birbirine bağlıdır; bu da onları taşımacılık için değerli kılar. Ren Nehri İsviçre Alpleri'nden doğar, Almanya ve Hollanda'nın sanayi bölgelerinden geçer ve Rotterdam'da Kuzey Denizi'ne dökülür.\n\nTuna Nehri Kara Orman'dan doğar, 10 ülkeden geçip Karadeniz'e ulaşır. Volga 3.530 km ile Avrupa'nın en uzun nehridir. Kuzeydeki Ladoga ve Onega gölleri buzulların oyduğu çukurlarda oluşmuş büyük tatlı su gölleridir.",
      populationAndSettlementTr:
        "Avrupa'da insanların yaklaşık dörtte üçü şehirde yaşar; bu, dünya ortalamasının çok üstündedir. İngiltere'den başlayıp Benelüks ülkeleri ve Ren Vadisi üzerinden Kuzey İtalya'ya uzanan Mavi Muz kuşağı, kıtada nüfusun, paranın ve sanayinin en çok toplandığı yerdir.\n\nNüfus yaşlanıyor. Köylerden şehirlere, Doğu Avrupa'dan Batı Avrupa'nın büyük şehirlerine sürekli göç var.",
      economyAndResourcesTr:
        "Sanayi Devrimi Avrupa'da başladı. 19. yüzyılda Almanya'daki Ruhr ve İngiltere'deki Midlands kömür havzalarında kurulan fabrikalar, zamanla yerini makine, kimya, otomotiv, havacılık ve finans sektörlerine bıraktı.\n\nAvrupa Birliği'nin ortak pazarında mallar gümrüksüz, sermaye serbestçe dolaşır. Tarımda makine kullanımı yaygın ve verim yüksektir. Kuzey Denizi'nde petrol ve doğal gaz çıkarılır.",
      subregionsIntroTr:
        "BM M49 standardı Avrupa'yı dört alt bölgeye ayırır: Batı, Kuzey, Güney ve Doğu Avrupa. Ayrım coğrafyaya, ekonomiye ve tarihe dayanır.",
      disasterAndEnvironmentTr:
        "Depremler en çok Afrika ile Avrasya levhalarının karşılaştığı Akdeniz kuşağında, yani İtalya, Yunanistan ve Balkanlar'da olur. Etna, Vezüv ve Stromboli etkin yanardağlardır. İzlanda, Orta Atlantik Sırtı'nın üzerinde durur; lav burada yer yer uzun yarıklardan çıkar.\n\nSon yıllarda Güney Avrupa'da şiddetli sıcak dalgaları ve orman yangınları, Ren ve Tuna havzalarında ani seller en büyük çevre sorunları arasına girdi.",
      historicalAndCulturalTr:
        "Antik Yunan demokrasisi ve Roma hukuku Avrupa'nın temelini attı. Orta Çağ'ın ardından Rönesans, Reform, Aydınlanma ve 1789 Fransız İhtilali geldi; bugünkü ulus devlet ve insan hakları fikirleri bu dönemde şekillendi. 15. yüzyılda başlayan Coğrafi Keşifler ve sömürgecilikle Avrupa dilleri ve kurumları dünyanın dört bir yanına yayıldı.",
    },
    subregions: [
      {
        nameTr: "Batı Avrupa",
        nameEn: "Western Europe",
        descriptionTr: "Ren havzası, okyanusal iklim, güçlü sanayi, büyük finans merkezleri.",
        sampleCountriesTr: ["Almanya", "Fransa", "Hollanda", "Belçika", "İsviçre", "Avusturya"],
      },
      {
        nameTr: "Güney Avrupa",
        nameEn: "Southern Europe",
        descriptionTr:
          "Akdeniz kıyıları ile İber, İtalya ve Balkan yarımadaları; tarihi kentlerle dolu.",
        sampleCountriesTr: [
          "İtalya",
          "İspanya",
          "Portekiz",
          "Yunanistan",
          "Hırvatistan",
          "Sırbistan",
        ],
      },
      {
        nameTr: "Kuzey Avrupa",
        nameEn: "Northern Europe",
        descriptionTr:
          "İskandinav ve Baltık ülkeleri ile Britanya Adaları; fiyortlu kıyılar, yüksek refah.",
        sampleCountriesTr: [
          "Birleşik Krallık",
          "İsveç",
          "Norveç",
          "Danimarka",
          "Finlandiya",
          "İrlanda",
        ],
      },
      {
        nameTr: "Doğu Avrupa",
        nameEn: "Eastern Europe",
        descriptionTr:
          "Kuzey Avrupa Ovası'nın doğu ucu, Volga ve Tuna havzaları; kışlar sert, iklim karasal.",
        sampleCountriesTr: ["Rusya", "Polonya", "Ukrayna", "Romanya", "Çekya", "Macaristan"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Akdeniz kuşağında depremler, özellikle İtalya ve Yunanistan'da",
        "İzlanda ve İtalya'da yanardağ patlamaları",
        "Sıcak dalgaları, kuraklık ve orman yangınları",
        "Ren, Elbe ve Tuna gibi büyük nehirlerde taşkınlar",
      ],
      faultLinesOrZones: [
        "Afrika levhasının Avrasya'nın altına daldığı Akdeniz yayı",
        "İtalya'da Apenin fay sistemi",
        "İzlanda'dan geçen Orta Atlantik Sırtı",
      ],
      warningNoteTr:
        "İtalya ve Balkanlar boyunca uzanan fay hatları, sığ odaklı yıkıcı depremler üretme potansiyeline sahiptir.",
    },
    faqs: [
      {
        question: "Avrupa'nın en yüksek dağı Mont Blanc mı, Elbrus mu?",
        answer:
          "Sınırı nereden çektiğine bağlı. Kafkas Dağları'nın su bölümü çizgisini Avrupa-Asya sınırı sayarsan, Rusya'daki 5.642 metrelik Elbrus en yüksek dağdır. Kafkasları Avrupa'nın dışında tutarsan, Fransa-İtalya sınırındaki 4.808 metrelik Mont Blanc birinci olur.",
      },
      {
        question: "Avrupa neden aynı enlemdeki Kanada ve Sibirya'dan daha sıcaktır?",
        answer:
          "Meksika Körfezi'nden kuzeydoğuya akan Golf Akıntısı ve devamı Kuzey Atlantik Akıntısı, okyanusun ısısını batı rüzgârlarıyla birlikte Batı ve Kuzey Avrupa kıyılarına taşır. Bu yüzden kışlar aynı enlemdeki Kanada ve Sibirya'dan çok daha ılık geçer.",
      },
      {
        question: "Mavi Muz ne demek?",
        answer:
          "Londra'dan başlayıp Benelüks, Batı Almanya ve İsviçre üzerinden Milano ve Cenova'ya kadar kavis çizen şeridin adıdır. Yaklaşık 110 milyon kişinin yaşadığı bu kuşak, Avrupa'da sanayinin, ticaretin ve nüfusun en yoğun olduğu yerdir.",
      },
      {
        question: "Fiyort nedir ve nerede görülür?",
        answer:
          "Buzulların oyduğu U biçimli vadiler, buzul çağından sonra deniz suyuyla dolunca fiyort denen dik yamaçlı, derin ve uzun körfezler oluşur. Avrupa'daki en bilinen örnekler Norveç ve İskoçya kıyılarındadır.",
      },
    ],
  },

  "kuzey-amerika": {
    id: "KUZEY_AMERIKA",
    slugTr: "kuzey-amerika",
    slugEn: "north-america",
    nameTr: "Kuzey Amerika",
    nameEn: "North America",
    code: "NA",
    taglineTr:
      "Dağlar kuzey-güney uzandığı için kutup havası ile tropik hava ovada karşı karşıya gelir.",
    countryCount: 23,
    countryCountNoteTr: "Kanada, ABD, Meksika, 7 Orta Amerika ve 13 Karayip ülkesi.",
    population: 600000000,
    populationFormattedTr: "600 Milyon",
    populationSharePercent: 7.5,
    areaKm2: 24709000,
    areaFormattedTr: "24.709.000 km²",
    areaSharePercent: 16.5,
    densityPerKm2: 24,
    highestPoint: {
      name: "Denali (McKinley)",
      elevationM: 6190,
      locationTr: "ABD (Alaska Sıradağları)",
    },
    lowestPoint: {
      name: "Ölüm Vadisi",
      elevationM: -86,
      locationTr: "ABD (Kaliforniya)",
      noteTr: "Kuzey Amerika'nın en derin ve en sıcak çöl çukuru.",
    },
    longestRiver: {
      name: "Mississippi-Missouri",
      lengthKm: 5970,
      noteTr: "Meksika Körfezi'ne dökülen dünyanın en büyük drenaj havzalarından biri.",
    },
    largestLake: {
      name: "Superior Gölü (Büyük Göller)",
      areaKm2: 82100,
    },
    dominantClimateTr: "Kutup Tundrası, Karasal, Ilıman, Step, Çöl ve Karayip Tropikali",
    classificationSourceTr: "National Geographic ve BM M49 — 23 Egemen Devlet Kapsamı",
    keyCharacteristicsTr: [
      "Büyük Ovalar'da kutup havası ile tropik hava çarpışır, hortumlar buradan çıkar",
      "Büyük Göller, yüzey alanıyla dünyanın en büyük tatlı su göl grubu",
      "Batıda Pasifik boyunca uzanan genç ve sarp Kayalık Dağlar",
    ],
    prose: {
      introTr:
        "Kanada'nın kuzeyindeki buzlu Arktik adalardan yola çıkıp güneye inersen tundradan, iğne yapraklı ormanlardan, geniş tahıl ovalarından ve çöllerden geçerek Panama'nın tropik ormanlarına varırsın. Hepsi aynı kıtada. Batıda genç ve sarp Kayalık Dağlar, doğuda aşınmış, yaşlı Appalaş Dağları uzanır. Aradaki Büyük Ovalar'da doğu-batı yönünde hiçbir dağ yoktur. Bu yüzden Arktik'in soğuk havası ile Meksika Körfezi'nin sıcak ve nemli havası burada doğrudan karşılaşır.",
      locationAndBordersTr:
        "Kuzeyde Arktik Okyanusu, batıda Büyük Okyanus, doğuda Atlas Okyanusu, güneydoğuda Karayip Denizi vardır. Güneyde Panama Kıstağı ve Darién Boşluğu'nun bataklıkları üzerinden Güney Amerika'ya bağlanır.\n\nKıtanın nerede bittiği kaynağa göre değişir. BM M49 şeması 'Kuzey Amerika' adını yalnızca ABD ve Kanada için kullanır. National Geographic ve fiziki coğrafya kitapları ise Orta Amerika ile Karayip adalarını da katar, kıtayı Panama Kıstağı'na kadar uzatır. Bu sitede ikinci yaklaşım kullanılır.",
      landformsAndGeologyTr:
        "Kıtayı üç büyük kuşağa ayırabilirsin. Doğuda Appalaş Dağları vardır. Yaklaşık 480 milyon yıl önce yükselmeye başlayan bu dağlar, aşınarak yuvarlak tepelere dönüşmüştür. Ortada ve kuzeyde Kanada Kalkanı uzanır. Burada yeryüzünün en yaşlı kayaçları yüzeye çıkar. Buzullar bu sert zemini oyarak binlerce göl çanağı açmıştır.\n\nBatıda ise Pasifik levhası ile Kuzey Amerika levhasının birbirine sürtünüp bindirmesiyle yükselen genç dağlar yer alır: Kayalık Dağlar, Cascade ve Sierra Nevada sıraları. Bu kuşakta aktif faylar, volkanlar ve Büyük Kanyon gibi derin kanyonlar bulunur.",
      climateAndVegetationTr:
        "Kuzey Amerika'nın iklimini en çok belirleyen şey dağların yönüdür. Sıradağlar doğu-batı değil, kuzey-güney doğrultusunda uzanır. Kutuptan gelen dondurucu hava hiçbir engele takılmadan Teksas'a ve Meksika Körfezi'ne kadar iner. Güneyin sıcak ve nemli havası da aynı yoldan iç kesimlere sokulur.\n\nBu iki hava kütlesinin Büyük Ovalar üzerinde buluştuğu hatta 'Hortum Koridoru' denir. Dünyada hortumların en sık ve en şiddetli görüldüğü yer burasıdır. Batı kıyısında Akdeniz ve okyanusal iklim, güneybatıda kurak Sonora ve Mojave çölleri, kuzeyde tayga ve tundra kuşağı yer alır.",
      hydrographyTr:
        "Kıtanın ortasındaki Büyük Göller (Superior, Michigan, Huron, Erie, Ontario) buzulların çekilmesiyle oluştu. Dünyadaki yüzey tatlı suyunun yaklaşık beşte biri bu göllerdedir. Saint Lawrence Nehri gölleri Atlas Okyanusu'na bağlar, böylece büyük gemiler kıtanın içine kadar girebilir.\n\nMississippi-Missouri sistemi 30'dan fazla eyaletin suyunu toplar ve tarım bölgelerini Meksika Körfezi'ne bağlar. Batıda dağları yararak akan Kolorado Nehri, kurak güneybatının en önemli su kaynağıdır.",
      populationAndSettlementTr:
        "İnsanlar suyun ve ticaret yollarının kolay olduğu kıyılarda ve Büyük Göller çevresinde toplanmıştır. Boston'dan Washington D.C.'ye kadar kesintisiz uzanan kentler kuşağına BosWash denir. Burası kıtanın siyaset ve finans merkezidir. Kaliforniya kıyıları ile Meksika'nın yüksek platoları, özellikle Meksiko şehri, diğer kalabalık bölgelerdir.\n\nKurak Büyük Havza, Kayalık Dağlar'ın yüksek kesimleri ve Kanada ile Alaska'nın donmuş kuzeyi ise neredeyse boştur.",
      economyAndResourcesTr:
        "Büyük Ovalar kıtanın tahıl ambarıdır: mısır, soya ve buğday burada yetişir. ABD ve Kanada, kaya gazı ve hidrolik çatlatma yöntemiyle dünyanın en büyük petrol ve doğal gaz üreticileri arasına girmiştir.\n\nKaliforniya'daki Silikon Vadisi yazılım, bilişim ve yapay zekâ şirketlerinin merkezidir. Kanada, ABD ve Meksika arasındaki serbest ticaret anlaşması NAFTA, bugünkü adıyla USMCA, üç ülkenin fabrikalarını tek bir üretim zincirine bağlamıştır.",
      subregionsIntroTr:
        "Kıta üç parçaya ayrılır: ABD ile Kanada'nın oluşturduğu Anglo-Amerika, Orta Amerika kıstağı ve Karayip adaları.",
      disasterAndEnvironmentTr:
        "Batı kıyısı boyunca uzanan San Andreas Fayı, Kaliforniya'da yıkıcı depremler üretebilir. Cascade Sıradağları'ndaki Saint Helens ve Rainier volkanları aktiftir.\n\nMeksika Körfezi ve Karayip kıyıları her sonbahar Atlas Okyanusu'ndan gelen kasırgalarla vurulur. İç ovalarda her bahar yüzlerce hortum görülür ve bunların bir kısmı can alır. Batıda kuraklığa bağlı orman yangınları giderek büyüyor.",
      historicalAndCulturalTr:
        "Kıtanın ilk halkları on binlerce yıl önce Bering Boğazı üzerinden geldi. İnuitler, Mayalar, Aztekler ve daha birçok yerli halk bu topraklarda yaşadı. 1492'den sonra başlayan Avrupa sömürgeciliği yerli nüfusu çok büyük ölçüde azalttı. Ardından köle ticareti ve 19-20. yüzyıllarda dünyanın her yerinden gelen göçmenler, bugünkü çok kültürlü toplumları oluşturdu.",
    },
    subregions: [
      {
        nameTr: "Anglo-Amerika",
        nameEn: "Northern America",
        descriptionTr: "Kanada ve ABD: güçlü sanayi, geniş tarım ovaları ve ileri teknoloji.",
        sampleCountriesTr: ["Amerika Birleşik Devletleri", "Kanada"],
      },
      {
        nameTr: "Orta Amerika",
        nameEn: "Central America",
        descriptionTr:
          "Meksika'dan Panama Kıstağı'na volkanik dağlar ve tropik ormanlar. Maya kentlerinin kalıntıları bu kuşaktadır.",
        sampleCountriesTr: ["Meksika", "Guatemala", "Kosta Rika", "Panama", "Honduras"],
      },
      {
        nameTr: "Karayipler",
        nameEn: "Caribbean",
        descriptionTr:
          "Büyük ve Küçük Antiller'in adaları. Tropik iklim, deniz turizmi ve şeker kamışı tarımı.",
        sampleCountriesTr: [
          "Küba",
          "Dominik Cumhuriyeti",
          "Haiti",
          "Jamaika",
          "Bahamalar",
          "Barbados",
        ],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Meksika Körfezi ve Karayipler'de 4. ve 5. kategori kasırgalar",
        "San Andreas Fayı ve Pasifik levhası boyunca depremler",
        "Büyük Ovalar'daki hortum koridoru",
        "Batı ABD ve Kanada'da büyük orman yangınları",
      ],
      faultLinesOrZones: [
        "San Andreas doğrultu atımlı fayı, Kaliforniya",
        "Cascadia dalma-batma zonu, kuzeybatı Pasifik kıyısı",
        "Karayip levhasının sınırındaki faylar",
      ],
      warningNoteTr:
        "Cascadia dalma-batma zonu, M≥9.0 büyüklüğünde megathrust depremi ve devasa tsunami üretme potansiyeline sahiptir.",
    },
    faqs: [
      {
        question: "Orta Amerika ve Karayipler Kuzey Amerika'ya mı dahildir?",
        answer:
          "Fiziki coğrafyaya göre evet. Kuzey Amerika, Kanada'nın kutup adalarından Panama Kıstağı'na kadar uzanır. Orta Amerika ülkeleri ve Karayip adaları da bu kıtaya girer.",
      },
      {
        question: "Kuzey Amerika'da neden bu kadar çok hortum görülür?",
        answer:
          "Kıtanın ortasında doğu-batı yönünde uzanan bir sıradağ yoktur. Kuzeyden gelen soğuk ve kuru Arktik havası ile Meksika Körfezi'nin sıcak ve nemli havası, Teksas-Kansas hattında hiçbir engele takılmadan çarpışır. Bu çarpışma şiddetli fırtınalar ve hortumlar doğurur.",
      },
      {
        question: "Büyük Göller nasıl oluşmuştur?",
        answer:
          "Son Buzul Çağı'nda kıtayı Laurentide Buzul Kalkanı kaplıyordu. Buzul yumuşak kayaçları oyarak derin çanaklar açtı. Yaklaşık 14.000 yıl önce buzul eriyince bu çanaklar tatlı suyla doldu ve Büyük Göller oluştu.",
      },
      {
        question: "Ölüm Vadisi neden dünyanın en sıcak yerlerinden biridir?",
        answer:
          "Vadi deniz seviyesinin 86 metre altındadır ve etrafı yüksek dağlarla çevrilidir. Aşağı inen kuru hava sıkıştıkça ısınır, vadi duvarlarının arasında sıkışıp kalır.",
      },
    ],
  },

  "guney-amerika": {
    id: "GUNEY_AMERIKA",
    slugTr: "guney-amerika",
    slugEn: "south-america",
    nameTr: "Güney Amerika",
    nameEn: "South America",
    code: "SA",
    taglineTr: "Batıda And Dağları yükselir, doğuya doğru arazi alçalıp Amazon ormanına iner.",
    countryCount: 12,
    countryCountNoteTr: "12 bağımsız devlet. Fransız Guyanası Fransa'ya bağlı, sayıya girmez.",
    population: 435000000,
    populationFormattedTr: "435 Milyon",
    populationSharePercent: 5.4,
    areaKm2: 17840000,
    areaFormattedTr: "17.840.000 km²",
    areaSharePercent: 12.0,
    densityPerKm2: 24,
    highestPoint: {
      name: "Aconcagua Dağı",
      elevationM: 6961,
      locationTr: "Arjantin (Mendoza / And Dağları)",
    },
    lowestPoint: {
      name: "Laguna del Carbón",
      elevationM: -105,
      locationTr: "Arjantin (San Julián Havzası, Patagonya)",
      noteTr: "Güney ve Batı yarımkürenin en alçak noktası.",
    },
    longestRiver: {
      name: "Amazon Nehri",
      lengthKm: 6400,
      noteTr: "Dünyanın en yüksek debili ve en geniş drenaj havzasına sahip nehri.",
    },
    largestLake: {
      name: "Titicaca Gölü",
      areaKm2: 8372,
    },
    dominantClimateTr:
      "Ekvatoral Tropikal Yağmur Ormanı, Savan, Yarı Kurak Pampa, Atacama Çölü ve Dağ İklimi",
    classificationSourceTr: "BM İstatistik Bölümü (UN M49) — Amerika Kıtası Alt Bölgesi",
    keyCharacteristicsTr: [
      "And Dağları, 7.000 km boyunca kesintisiz uzanan en uzun dağ zinciri",
      "Amazon Havzası'nda dünyanın en geniş tropikal yağmur ormanı",
      "Atacama, kutuplar dışında dünyanın en kurak çölü",
    ],
    prose: {
      introTr:
        "Kıtanın batı kıyısı boyunca And Dağları bir duvar gibi yükselir. Doğuya geçince arazi alçalır ve Amazon Havzası'nın ormanla kaplı ovaları başlar. Güney Amerika'nın coğrafyası bu iki parçanın karşıtlığıyla anlaşılır.\n\nAnd Dağları, Nazca levhasının kıtanın altına dalmasıyla yükselmiştir ve 7.000 kilometre boyunca uzanır. Akarsuların hangi yöne aktığını, yağışın nereye düştüğünü, madenlerin ve şehirlerin nerede toplandığını büyük ölçüde bu dağlar belirler.",
      locationAndBordersTr:
        "Kıta kuzeyde Panama Kıstağı ve Darién Boşluğu üzerinden Orta Amerika'ya bağlanır. Doğusunda Atlas Okyanusu, batısında Büyük Okyanus, kuzeyinde Karayip Denizi vardır. Güneyde fırtınalı Drake Boğazı, kıtayı Antarktika'dan yaklaşık 1.000 kilometrelik açık denizle ayırır.",
      landformsAndGeologyTr:
        "Kıtayı batıdan doğuya üç kuşağa ayırabilirsin. En batıda And Dağları uzanır. Pasifik Ateş Çemberi'nin parçası olan bu genç dağlarda depremler sık yaşanır ve dünyanın en yüksek volkanları buradadır. Dağların orta kesiminde, Doğu ve Batı Kordiyera arasında, 3.800 metre yükseklikteki Altiplano Yaylası yer alır.\n\nDoğuda Prekambriyen'den kalma, aşınmış ve sakin Guyana ve Brezilya kalkanları bulunur. Bu iki yüksek alanın arasında akarsuların taşıdığı tortularla dolmuş geniş ovalar yayılır: kuzeyde Amazon Havzası, güneyde Paraná-Paraguay ovaları, yani Gran Chaco ve Pampa.",
      climateAndVegetationTr:
        "Amazon Havzası ekvator üzerindedir. Alize rüzgârlarının Atlas Okyanusu'ndan getirdiği nem And Dağları'na çarpınca yağmura dönüşür. Dünyanın en geniş tropikal yağmur ormanı bu yağışla beslenir. Güneydeki Pampa düzlükleri ise verimli ılıman çayırlarla örtülüdür.\n\nBatıda, Şili'deki Atacama Çölü kutuplar dışında dünyanın en kurak yeridir. Kuraklığın iki nedeni var. And Dağları doğudan gelen Atlantik nemini keser. Batıda kıyı boyunca akan soğuk Humboldt (Peru) Akıntısı da deniz havasını serinletir, havanın yükselip yağmur bırakmasına izin vermez.",
      hydrographyTr:
        "Amazon Nehri, dünya denizlerine dökülen nehir suyunun yaklaşık beşte birini tek başına taşır. Havzası 7 milyon kilometrekareyi bulur ve 1.100'den fazla kolla beslenir. And Dağları'nın batı yamacından doğar, kıtayı doğuya doğru boydan boya geçer. Atlas Okyanusu'na döküldüğü yerde deniz suyunu yüzlerce kilometre açığa kadar tatlılaştırır.\n\nGüneyde Paraná ve Uruguay nehirleri birleşerek Río de la Plata halicini oluşturur; bu, kıtanın ikinci büyük akarsu sistemidir. 3.812 metre yükseklikteki Titicaca Gölü ise ticari gemilerin çalıştığı dünyanın en yüksek gölüdür.",
      populationAndSettlementTr:
        "Güney Amerikalıların çoğu kıyılarda yaşar, iç kesimler boş kalır. Atlas Okyanusu kıyısında São Paulo, Rio de Janeiro ve Buenos Aires, Büyük Okyanus kıyısında Lima ve Santiago gibi büyük şehirler vardır.\n\nİçerideki Amazon Havzası'nda nem, sık orman ve ulaşım zorluğu yerleşmeyi güçleştirir. Güneydeki Patagonya platosunda ise sert rüzgârlar ve soğuk, kurak iklim yüzünden nüfus çok seyrektir.",
      economyAndResourcesTr:
        "And Dağları'nın volkanik yapısı kıtaya zengin maden yatakları kazandırmıştır. Şili ve Peru dünyada en çok bakır üreten ülkelerdendir. Şili, Bolivya ve Arjantin'in sınırlarının buluştuğu yüksek tuz düzlükleri (Salar de Uyuni, Salar de Atacama) 'Lityum Üçgeni' diye anılır; dünyadaki lityum kaynaklarının yarısından fazlası buradadır.\n\nVenezuela, dünyanın kanıtlanmış en büyük ham petrol rezervine sahiptir. Brezilya ve Arjantin, Pampa ve Cerrado ovalarında yetiştirdikleri soya, mısır, kahve ve sığır etiyle dünyanın önde gelen tarım üreticilerindendir.",
      subregionsIntroTr:
        "Güney Amerika üç bölgeye ayrılarak incelenir: And ülkeleri, Brezilya ve kıtanın güney ucundaki Güney Koni.",
      disasterAndEnvironmentTr:
        "Kıtanın batısı Pasifik Ateş Çemberi'nin en tehlikeli kesimlerinden biridir. 1960'taki 9,5 büyüklüğündeki Valdivia Depremi, ölçüm aletleriyle kaydedilmiş en büyük depremdir. And Dağları'ndaki Cotopaxi ve Villarrica gibi tepesi buzulla kaplı volkanlar patladığında eriyen buz, çamur akıntılarına yol açabilir.\n\nEn büyük çevre sorunu, tarla ve sığır otlağı açmak için Amazon ormanlarının kesilmesidir. El Niño ve La Niña dönemleri de kıtada ağır kuraklıklara ya da sellere neden olur.",
      historicalAndCulturalTr:
        "İnka İmparatorluğu, And yaylalarında taş yapılar ve basamaklı teras tarlalarıyla yükseldi. 1494'teki Tordesillas Antlaşması ile İspanya ve Portekiz, keşfedilen yeni toprakları bir meridyen boyunca paylaştı. Bu çizgi bugünkü dil haritasını belirledi: doğuda kalan Brezilya Portekizce, kıtanın geri kalanı İspanyolca konuşur.",
    },
    subregions: [
      {
        nameTr: "And Ülkeleri",
        nameEn: "Andean States",
        descriptionTr:
          "And Dağları boyunca dizilen ülkeler: Altiplano'nun madenleri, İnka mirası ve Büyük Okyanus kıyıları.",
        sampleCountriesTr: ["Peru", "Bolivya", "Kolombiya", "Ekvador", "Şili", "Venezuela"],
      },
      {
        nameTr: "Brezilya Kara Kütlesi",
        nameEn: "Brazil Landmass",
        descriptionTr:
          "Kıtanın neredeyse yarısı. Amazon ormanları, Cerrado'nun tarım alanları ve Portekiz mirası.",
        sampleCountriesTr: ["Brezilya"],
      },
      {
        nameTr: "Güney Koni",
        nameEn: "Southern Cone",
        descriptionTr:
          "Pampa düzlükleri ve Río de la Plata havzası. İklimi ılıman, şehirlerinde Avrupalı göçmenlerin izi belirgin.",
        sampleCountriesTr: ["Arjantin", "Şili", "Uruguay", "Paraguay"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Pasifik kıyısında 8,5 ve üzeri büyüklükte depremler ve tsunamiler",
        "Buzulla kaplı And volkanlarının patlamaları ve çamur akıntıları",
        "Amazon'da orman kaybı ve bununla yok olan türler",
        "El Niño ve La Niña dönemlerinde ağır kuraklık ve seller",
      ],
      faultLinesOrZones: [
        "Peru-Şili Hendeği, Nazca levhasının Güney Amerika levhasının altına daldığı hat",
        "Kuzey And fay sistemi",
        "Magallanes-Fagnano Fayı, Ateş Toprakları",
      ],
      warningNoteTr:
        "Tarihin aletsel olarak ölçülmüş en büyük depremi (M=9.5, 1960 Valdivia) bu kıtanın batı kıyısında gerçekleşmiştir.",
    },
    faqs: [
      {
        question: "Atacama Çölü neden bu kadar kurak?",
        answer:
          "Atacama, kutuplar dışındaki en kurak çöldür. Doğusundaki 6.000 metrelik And Dağları, Atlantik'ten gelen nemli havayı keser. Batısındaki soğuk Humboldt Akıntısı ise kıyıdaki havayı serinletir ve yükselip bulut oluşturmasını önler. Bu iki engel yüzünden bazı kesimlerine neredeyse hiç yağmur düşmez.",
      },
      {
        question: "Lityum Üçgeni nedir, neden önemlidir?",
        answer:
          "Şili, Bolivya ve Arjantin'in yüksek And platolarındaki tuz düzlüklerinin oluşturduğu alandır. Elektrikli araç pillerinde kullanılan lityumun dünyadaki kaynaklarının yarısından fazlası burada bulunur.",
      },
      {
        question: "Brezilya'da neden İspanyolca değil Portekizce konuşulur?",
        answer:
          "1494'te İspanya ile Portekiz arasında imzalanan Tordesillas Antlaşması, yeni keşfedilen toprakları bir meridyen boyunca ikiye böldü. Bu çizginin doğusunda kalan, bugünkü Brezilya'nın bulunduğu kesim Portekiz'e bırakıldı.",
      },
      {
        question: "Amazon Nehri ne kadar su taşır?",
        answer:
          "Amazon saniyede yaklaşık 209.000 metreküp su taşır. Bu, ondan sonra gelen en büyük yedi nehrin toplamından fazladır ve okyanuslara karışan tüm nehir suyunun yaklaşık beşte biri eder.",
      },
    ],
  },

  okyanusya: {
    id: "OKYANUSYA",
    slugTr: "okyanusya",
    slugEn: "oceania",
    nameTr: "Okyanusya",
    nameEn: "Oceania",
    code: "OC",
    taglineTr:
      "Karası 8,5 milyon km², ülkelerinin denizdeki hak alanı ise 40 milyon km²'yi aşıyor.",
    countryCount: 14,
    countryCountNoteTr: "Avustralya dahil 14 bağımsız devlet.",
    population: 45000000,
    populationFormattedTr: "45 Milyon",
    populationSharePercent: 0.6,
    areaKm2: 8530000,
    areaFormattedTr: "8.530.000 km² (Kara)",
    areaSharePercent: 5.7,
    densityPerKm2: 5,
    highestPoint: {
      name: "Wilhelm Dağı",
      elevationM: 4509,
      locationTr:
        "Papua Yeni Gine (Wilhelm Dağı 4.509 m) — Avustralya anakarasında Kosciuszko 2.228 m",
    },
    lowestPoint: {
      name: "Eyre Gölü",
      elevationM: -15,
      locationTr: "Güney Avustralya",
      noteTr: "Kurak mevsimde dev bir tuz tavasına dönüşen kapalı göl yatağı.",
    },
    longestRiver: {
      name: "Murray-Darling",
      lengthKm: 2530,
      noteTr: "Avustralya'nın güneydoğu tarım havzasını drene eder.",
    },
    largestLake: {
      name: "Eyre Gölü",
      areaKm2: 9500,
    },
    dominantClimateTr: "Çöl, Yarı Kurak Step, Tropikal Denizel, Okyanusal ve Ilıman",
    classificationSourceTr: "BM İstatistik Bölümü (UN M49) — 4 Coğrafi Alt Bölge",
    keyCharacteristicsTr: [
      "Ülkelerin denizdeki ekonomik hak alanı, kara alanının neredeyse beş katı",
      "Dünyanın en büyük mercan resifi sistemi olan Büyük Set Resifi",
      "Uzun süre yalıtılmış kalan adalarda gelişmiş keseliler ve kivi kuşu",
    ],
    prose: {
      introTr:
        "Okyanusya'yı haritada ararken önce denizi görürsün. Kara parçası yaklaşık 8,5 milyon km² ve bunun %90'ı tek başına Avustralya. Geri kalanı Büyük Okyanus'a dağılmış on binlerce ada. Ada devletlerinin denizde ekonomik hak sahibi olduğu alan ise 40 milyon km²'yi aşar, yani kara alanının neredeyse beş katıdır.",
      locationAndBordersTr:
        "Kıta, Büyük Okyanus'un güney ve orta kesimlerine yayılır. Batısında Hint Okyanusu, kuzeyinde ve doğusunda Büyük Okyanus vardır.\n\nYeni Gine adası iki kıta arasında bölünmüştür. Doğu yarısı bağımsız Papua Yeni Gine'dir ve Okyanusya'da sayılır. Batı yarısı Endonezya'ya bağlıdır ve Asya'da sayılır. Bir adanın böyle iki kıtaya bölünmesi pek az görülür.",
      landformsAndGeologyTr:
        "Okyanusya'da iki farklı yapı yan yana durur. Avustralya anakarası dünyanın en yaşlı ve en düz kara parçalarından biridir. Uzun süre aşındığı için alçaktır. Doğu kıyısı boyunca uzanan Büyük Su Ayırıcı Sıradağları dışında belirgin bir dağ sırası yoktur.\n\nYeni Zelanda, Papua Yeni Gine ve çevredeki ada yayları ise Pasifik Ateş Çemberi üzerindeki genç levha sınırlarında yükselmiştir. Yeni Zelanda'nın Güney Alpleri'nde buzullar, Kuzey Adası'nda etkin yanardağlar vardır. Melanezya, Mikronezya ve Polinezya adalarının bir kısmı yanardağ tepeleridir. Bir kısmı da denizaltı yanardağlarının üstünde mercanların biriktirdiği alçak atollerdir.",
      climateAndVegetationTr:
        "Avustralya anakarasının üçte ikisi kurak ya da yarı kuraktır. Avustralyalılar iç kesimdeki bu çöl ve çalılık alanlara 'Outback', yani uzak iç bölge der. Güneydoğu ve güneybatı uçlarında Akdeniz iklimi ve ılıman okyanus iklimi görülür. Yeni Zelanda yıl boyu yağış alır ve ılıktır.\n\nPasifik adalarında alize rüzgârlarının getirdiği nemle tropikal deniz iklimi hâkimdir. Kıta, Gondwana parçalanırken diğer karalardan erken ayrıldı. Bu yalıtım sayesinde kanguru ve koala gibi keseliler, ornitorenk gibi yumurtlayan memeliler ve Yeni Zelanda'da kivi kuşu bugüne kadar yaşayabildi.",
      hydrographyTr:
        "Okyanusya'nın en büyük akarsu ağı, Avustralya'nın güneydoğusundaki Murray-Darling Havzası'dır. Kıtanın tarımı büyük ölçüde bu havzaya bağlıdır ve kurak yıllarda sular çok azalır. İç kesimlerdeki derelerin çoğu yalnızca yağışlı mevsimde akar.\n\nAvustralya'nın kuzeydoğu kıyısında Büyük Set Resifi 2.300 kilometre boyunca uzanır. Binlerce ayrı resif ve adadan oluşan bu yapı, dünyanın en büyük mercan resifi sistemidir. Küçük mercan adalarında ise akarsu yoktur. Tatlı su, sarnıçlarda biriktirilen yağmur suyundan ve toprağın altında tuzlu suyun üstünde duran ince bir tatlı su tabakasından sağlanır.",
      populationAndSettlementTr:
        "Nüfus az ve şehirlerde toplanmıştır. Avustralyalıların büyük çoğunluğu kıyıdaki birkaç büyük şehirde yaşar: Sidney, Melbourne, Brisbane, Perth. İç kesimler neredeyse boştur.\n\nPasifik adalarında insanlar küçük köylere ve kıyı kasabalarına dağılmıştır. Tuvalu ve Nauru gibi ada devletlerinin nüfusu yalnızca 10-12 bin kişidir.",
      economyAndResourcesTr:
        "Avustralya dünyanın en büyük maden ihracatçılarındandır. Demir cevheri, kömür, boksit, altın, lityum ve sıvılaştırılmış doğalgaz satar. Yeni Zelanda süt ürünleri, et ve kivi ihracatıyla öne çıkar.\n\nKüçük Pasifik ada devletleri ise geniş deniz alanlarındaki orkinos avı için yabancı filolara verdikleri izinlerden gelir elde eder. Turizm, kopra yani kurutulmuş hindistancevizi ve yurt dışında çalışan vatandaşlarının gönderdiği para da bu ekonomilerin dayanaklarıdır.",
      subregionsIntroTr:
        "BM M49 sınıflandırması Okyanusya'yı 4 alt bölgeye ayırır: Avustralya ve Yeni Zelanda, Melanezya ('Siyah Adalar'), Mikronezya ('Küçük Adalar') ve Polinezya ('Çok Adalar').",
      disasterAndEnvironmentTr:
        "Deniz seviyesinin yükselmesi en çok burada hissedilir. Tuvalu, Kiribati ve Marşal Adaları gibi atol ülkelerinde karanın ortalama yüksekliği deniz seviyesinden yalnızca 1-2 metre fazladır. Yükselen su, kıyı aşınması ve yeraltı sularının tuzlanması bu ülkeleri toprak kaybetme tehlikesiyle karşı karşıya bırakır.\n\nAvustralya'da ise aşırı sıcak dalgaları ve aylarca süren çalılık yangınları yaşanır. Isınan deniz suyu Büyük Set Resifi'ndeki mercanların beyazlamasına yol açar.",
      historicalAndCulturalTr:
        "Avustralya Aborjinlerinin geçmişi 50.000 yılı aşar. Onların kültürü, kesintisiz süren en eski yaşayan kültür olarak kabul edilir.\n\nPolinezyalı denizciler pusula kullanmadan Büyük Okyanus'u geçtiler. Yıldızlara, akıntılara ve kuşların uçuşuna bakarak yön buldular, kano ve katamaranlarla Hawaii'den Yeni Zelanda'ya kadar adalara yerleştiler. Yeni Zelanda'ya yerleşenler Maorilerdir. 18. yüzyıldan itibaren bölge İngiliz sömürgesi olmaya başladı.",
    },
    subregions: [
      {
        nameTr: "Avustralya ve Yeni Zelanda",
        nameEn: "Australia and New Zealand",
        descriptionTr:
          "Bölgenin en zengin iki ülkesi. Büyük maden kaynakları, kıyıdaki büyük şehirler ve ılıman iklim.",
        sampleCountriesTr: ["Avustralya", "Yeni Zelanda"],
      },
      {
        nameTr: "Melanezya",
        nameEn: "Melanesia",
        descriptionTr:
          "Yeni Gine'den Fiji'ye uzanan dağlık, yanardağlı büyük adalar. Çok sayıda dil ve kültür bir arada.",
        sampleCountriesTr: ["Papua Yeni Gine", "Fiji", "Solomon Adaları", "Vanuatu"],
      },
      {
        nameTr: "Mikronezya",
        nameEn: "Micronesia",
        descriptionTr:
          "Ekvatorun kuzeyinde binlerce küçük mercan adası ve atol. Karası küçük, balıkçılık yapılan deniz alanı geniş.",
        sampleCountriesTr: [
          "Kiribati",
          "Marşal Adaları",
          "Mikronezya Federal Devletleri",
          "Nauru",
          "Palau",
        ],
      },
      {
        nameTr: "Polinezya",
        nameEn: "Polynesia",
        descriptionTr:
          "Köşelerinde Yeni Zelanda, Hawaii ve Paskalya Adası'nın durduğu büyük bir üçgenin içindeki adalar.",
        sampleCountriesTr: ["Samoa", "Tonga", "Tuvalu"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Deniz seviyesinin yükselmesi; atol ülkeleri için varlık meselesi",
        "Büyük Okyanus'ta tropikal fırtınalar ve fırtına kabarmaları",
        "Avustralya'da kuraklık, sıcak dalgaları ve çalılık yangınları",
        "Yeni Zelanda ve Melanezya'da depremler ve yanardağ patlamaları",
      ],
      faultLinesOrZones: [
        "Alp Fayı, Yeni Zelanda Güney Adası",
        "Kermadec-Tonga Hendeği dalma-batma kuşağı",
        "Yeni Hebridler Hendeği, Vanuatu",
      ],
      warningNoteTr:
        "Tuvalu ve Kiribati gibi alçak mercan adaları, deniz seviyesinin yükselmesi nedeniyle 21. yüzyıl içinde tamamen sular altında kalma tehlikesiyle karşı karşıyadır.",
    },
    faqs: [
      {
        question: "Avustralya bir kıta mıdır yoksa ada mıdır?",
        answer:
          "Avustralya kendi levhası olan Avustralya Levhası üzerinde duran büyük bir kara parçasıdır. Bu yüzden ada değil, dünyanın en küçük kıtası sayılır. Çevresindeki ada ülkeleriyle birlikte oluşturduğu bölgeye Okyanusya denir.",
      },
      {
        question: "Tuvalu ve Kiribati neden iklim göçü riskiyle karşı karşıya?",
        answer:
          "Bu ülkeler mercan atollerinden oluşur ve en yüksek noktaları deniz seviyesinden yalnızca 2-3 metre yüksektir. Yükselen deniz, kıyı aşınması ve fırtına kabarmaları yerleşim alanlarını küçültür, tarım toprağını ve içme suyunu tuzlandırır.",
      },
      {
        question: "Büyük Set Resifi ne kadar büyüktür?",
        answer:
          "Büyük Set Resifi, Avustralya'nın kuzeydoğu kıyısı boyunca 2.300 kilometre uzanır. Binlerce ayrı resif ve adadan oluşur ve dünyanın en büyük mercan resifi sistemidir.",
      },
      {
        question: "Yeni Gine adası neden iki kıtaya bölünmüştür?",
        answer:
          "Adanın doğu yarısı bağımsız Papua Yeni Gine devletidir ve Okyanusya'da sayılır. Batı yarısı sömürge döneminden kalan sınırlar yüzünden Endonezya'ya bağlıdır ve siyasi coğrafyada Asya'da sayılır.",
      },
    ],
  },

  antarktika: {
    id: "ANTARKTIKA",
    slugTr: "antarktika",
    slugEn: "antarctica",
    nameTr: "Antarktika",
    nameEn: "Antarctica",
    code: "AN",
    taglineTr:
      "Kalın bir buzun altında kalan, kimsenin kalıcı olarak yaşamadığı ve hiçbir devlete ait olmayan kıta.",
    countryCount: 0,
    countryCountNoteTr: "Devlet yok; 1959 Antarktika Antlaşması'yla bilime ayrıldı.",
    population: 0,
    populationFormattedTr: "Kalıcı nüfus yok",
    populationSharePercent: 0.0,
    areaKm2: 14200000,
    areaFormattedTr: "14.200.000 km²",
    areaSharePercent: 9.5,
    densityPerKm2: 0,
    highestPoint: {
      name: "Vinson Masifi",
      elevationM: 4892,
      locationTr: "Ellsworth Dağları (Sentinel Sıradağları)",
    },
    lowestPoint: {
      name: "Bentley Buzul-altı Çukuru",
      elevationM: -2540,
      locationTr: "Batı Antarktika (Buz kalkanının altındaki kaya yatağı)",
      noteTr:
        "Buz örtüsü kaldırıldığında deniz seviyesinin 2.540 metre altında kalacak vadi tabanı.",
    },
    longestRiver: {
      name: "Onyx Nehri",
      lengthKm: 32,
      noteTr: "Yalnızca kutup yazının birkaç haftasında Wright Vadisi'nde akar.",
    },
    largestLake: {
      name: "Vostok Gölü (Buzul-altı)",
      areaKm2: 12500,
    },
    dominantClimateTr: "Ekstrem Kutup İklimi (Soğuk Çöl / Buzul İklimi)",
    classificationSourceTr: "1959 Antarktika Antlaşması — 60° Güney Enlemi Coğrafi Sınırı",
    keyCharacteristicsTr: [
      "Dünyadaki buzun yaklaşık %90'ı, tatlı suyun yaklaşık %70'i bu kıtada",
      "Sahra'dan bile az yağış alır; hem en soğuk hem en kurak kıta",
      "Askeri faaliyet yasak, kıtada yalnızca bilim yapılır",
    ],
    prose: {
      introTr:
        "Kıtanın neredeyse tamamı buzla kaplı. Bu buz örtüsü yer yer 4.800 metreden kalın; dünyadaki buzun yaklaşık %90'ı ve tatlı suyun yaklaşık %70'i burada. Buz yüzünden Antarktika, ortalama yükseltisi en fazla (yaklaşık 2.200 m) olan kıta; aynı zamanda en soğuk, en kurak ve en rüzgârlı olanı. Yerli halkı ve devleti yok. 1959 Antarktika Antlaşması askeri faaliyeti yasakladı ve kıtayı barışçıl bilimsel araştırmaya ayırdı.",
      locationAndBordersTr:
        "Güney Kutbu kıtanın ortasında. Antarktika denince 60° güney enleminin güneyindeki her yer anlaşılır. Kıtanın çevresinde yalnızca Güney Okyanusu'nun fırtınalı suları var. En yakın kara, yaklaşık 1.000 kilometre kuzeyde, Drake Boğazı'nın öbür yakasındaki Ateş Toprakları'dır; Güney Amerika'nın en güney ucu.",
      landformsAndGeologyTr:
        "Transantarktik Dağları kıtayı ikiye böler: Doğu Antarktika ve Batı Antarktika. Doğu Antarktika çok yaşlı (Prekambriyen) ve sağlam bir kayaç temel üzerinde durur. Üstündeki buz ortalama 2.000 metreden, en kalın yerinde 4.800 metreden kalındır.\n\nBatı Antarktika'da And Dağları'nın devamı sayılan dağ sıraları ve etkin yanardağlar var; Ross Adası'ndaki Erebus Dağı bunlardan biri. Kıtanın en yüksek yeri 4.892 metrelik Vinson Masifi. Buzun altında ise derin vadiler saklı: Bentley Buzul-altı Çukuru'nun tabanı deniz seviyesinin 2.540 metre altında.",
      climateAndVegetationTr:
        "Antarktika dünyanın en büyük çölüdür, çünkü çöl olmak için sıcak değil kurak olmak gerekir. İç kesimlere yılda 50 milimetreden az yağış düşer; Sahra'nın birçok yerinden daha az. Yeryüzünde ölçülen en düşük sıcaklık da burada: 21 Temmuz 1983'te Sovyet Vostok İstasyonu'nda -89,2 °C.\n\nİç yaylalarda soğuyan ağır hava yokuş aşağı kıyıya doğru akar. Bu katabatik rüzgârlar saatte 300 kilometreye ulaşabilir. Karada yalnızca yosunlar, likenler ve iki çiçekli bitki türü yaşar; onlar da Antarktika Yarımadası'nda yazın karı eriyen kayalıklarda. Denizler ise kril ve planktonla dolu. Balinalar, foklar ve imparator penguenleri bu besinle yaşar.",
      hydrographyTr:
        "Kıtanın yüzeyinde akarsu neredeyse yok. En uzunu, yazın yalnızca birkaç hafta akan 32 kilometrelik Onyx Nehri. Buzun altında ise 400'den fazla göl bulundu. Bunlar donmaz, çünkü üstlerindeki binlerce metrelik buz basınç yapar, aşağıdan da yerin ısısı gelir.\n\nBu göllerin en büyüğü Vostok Gölü. Kıyılarda ise Ross ve Ronne gibi büyük buz sahanlıkları var: karadaki buzun denize uzanıp su üstünde yüzen kısımları.",
      populationAndSettlementTr:
        "Antarktika'da doğup büyüyen kimse yok. Kıtada yaşayanlar, antlaşmaya taraf ülkelerin işlettiği yaklaşık 70 araştırma istasyonundaki bilim insanları ve teknik personel.\n\nYazın bu sayı 4.000–5.000 kişiye çıkar, karanlık kutup kışında 1.000'in altına iner. Türkiye 2017'den beri her yıl Ulusal Antarktika Bilim Seferi düzenliyor ve Horseshoe Adası'nda geçici bir bilim kampı kuruyor.",
      economyAndResourcesTr:
        "1991 Madrid Çevre Koruma Protokolü, Antarktika'da ticari madenciliği ve petrol aramayı süresiz yasakladı. Kıtada kömür ve demir yatakları olduğu biliniyor, ama bunlara dokunulmuyor.\n\nİzin verilen ticari işler iki tane: yazın Antarktika Yarımadası'na düzenlenen, çevre kurallarına bağlı gemi turları ve Güney Okyanusu'nda denetim altındaki kril ve patagonya dişbalığı avı.",
      subregionsIntroTr:
        "Antarktika üç kesime ayrılır: Doğu Antarktika'nın büyük buz örtüsü, Batı Antarktika ve Güney Amerika'ya doğru uzanan Antarktika Yarımadası.",
      disasterAndEnvironmentTr:
        "Beyaz buz, gelen güneş ışığının çoğunu uzaya geri yansıtır; bu da dünyanın daha fazla ısınmasını frenler. Antarktika'daki buzun tamamı erirse deniz seviyesi yaklaşık 58 metre yükselir.\n\nBatı Antarktika'da Thwaites Buzulu gibi denize uzanan buzullar, altlarına sokulan ılık okyanus suyuyla eriyip parçalanıyor. Bu buzula bu yüzden \"Kıyamet Buzulu\" da deniyor. Kıtanın üzerinde 1980'lerde fark edilen ozon deliği ise uluslararası çevre anlaşmalarından sonra küçülmeye başladı.",
      historicalAndCulturalTr:
        "Kıta ilk kez 1820'lerde görüldü. 20. yüzyılın başı kutup keşiflerinin en yoğun dönemiydi. Roald Amundsen'in ekibi 1911 Aralık'ında Güney Kutbu'na ilk ulaşan oldu; Robert Falcon Scott bir ay sonra, 1912 Ocak'ında vardı.\n\n1 Aralık 1959'da imzalanan Antarktika Antlaşması, yedi ülkenin (İngiltere, Fransa, Şili, Arjantin, Avustralya, Norveç, Yeni Zelanda) toprak iddialarını dondurdu ve kıtayı bilime ve barışa ayırdı.",
    },
    subregions: [
      {
        nameTr: "Doğu Antarktika",
        nameEn: "East Antarctica",
        descriptionTr:
          "En kalın buz burada. Güney Kutbu ve -89 °C'nin ölçüldüğü Vostok İstasyonu da bu kesimde.",
        sampleCountriesTr: ["Uluslararası İstasyonlar (McMurdo, Vostok, Amundsen-Scott)"],
      },
      {
        nameTr: "Batı Antarktika",
        nameEn: "West Antarctica",
        descriptionTr:
          "Buzun altındaki kayalar deniz seviyesinin altında. Kolay kırılan buz sahanlıkları ve etkin yanardağlar var.",
        sampleCountriesTr: ["Uluslararası İstasyonlar"],
      },
      {
        nameTr: "Antarktika Yarımadası",
        nameEn: "Antarctic Peninsula",
        descriptionTr:
          "Güney Amerika'ya uzanan, kıtanın en ılık kesimi. Yazın kıyılarında kar erir; penguen kolonileri ve bilim üsleri burada.",
        sampleCountriesTr: [
          "Uluslararası İstasyonlar (Türkiye Geçici Bilim Kampı - Horseshoe Adası)",
        ],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Isınmayla çöken buz sahanlıkları ve yükselen deniz seviyesi",
        "Erebus Dağı'nın etkinliği ve buzun altta erimesi",
        "Katabatik fırtınalar ve -80 °C'nin altına inen soğuklar",
      ],
      faultLinesOrZones: [
        "Batı Antarktika Rift Sistemi",
        "Scotia Levhası sınırı (Antarktika Yarımadası'nın kuzeyi)",
      ],
      warningNoteTr:
        "Batı Antarktika'daki Thwaites ve Pine Island buzullarının dengesizleşmesi, tek başına küresel deniz seviyesini onlarca santimetre yükseltebilecek potansiyele sahiptir.",
    },
    faqs: [
      {
        question: "Antarktika kime aittir?",
        answer:
          "Hiçbir devlete. 1959'da imzalanan Antarktika Antlaşması daha önceki tüm toprak iddialarını dondurdu. Kıta yalnızca barışçıl ve bilimsel işler için kullanılabilir.",
      },
      {
        question: "Buzla kaplı Antarktika nasıl çöl olabilir?",
        answer:
          "Çöl, az yağış alan yer demektir. Çok soğuk hava neredeyse hiç su buharı taşıyamaz. İç kesimlerdeki yüksek basınç da bulut oluşmasını engeller. Bu yüzden iç yaylalara yılda 50 milimetreden az kar düşer.",
      },
      {
        question: "Antarktika'daki tüm buz erirse ne olur?",
        answer: "Dünya genelinde deniz seviyesi yaklaşık 58 metre yükselir.",
      },
      {
        question: "Türkiye'nin Antarktika'da üssü var mı?",
        answer:
          "Kalıcı bir üssü yok, geçici bir kampı var. TÜBİTAK MAM Kutup Araştırmaları Enstitüsü (KARE) her yıl Ulusal Antarktika Bilim Seferi düzenliyor ve Horseshoe Adası'nda geçici Türk Bilim Kampı'nı kuruyor.",
      },
    ],
  },
};

/**
 * Helper to fetch all continent summary data
 */
export function getAllContinents(): ContinentDetailData[] {
  return Object.values(CONTINENTS_REGISTRY);
}

/**
 * Helper to find a continent by slug (supports TR and EN slugs)
 */
export function getContinentBySlug(slug: string): ContinentDetailData | null {
  const normalized = slug.toLowerCase().trim();
  for (const c of Object.values(CONTINENTS_REGISTRY)) {
    if (c.slugTr === normalized || c.slugEn === normalized) {
      return c;
    }
  }
  return null;
}

/**
 * Mapping between Continent enum key and URL slug.
 *
 * `as const satisfies` rather than a `Record<Continent, string>` annotation, the same shape
 * `lib/game/region-slug.ts` uses and for the same reason: `lib/theme/continent-identity.ts`
 * keys the seven continent colour identities on exactly these values, so a slug added or
 * renamed here stops that module compiling instead of silently handing a component
 * `undefined` for its continent's colour. `satisfies` still fails if the api contract gains
 * or renames a continent.
 */
export const CONTINENT_KEY_TO_SLUG = {
  AFRIKA: "afrika",
  ASYA: "asya",
  AVRUPA: "avrupa",
  KUZEY_AMERIKA: "kuzey-amerika",
  GUNEY_AMERIKA: "guney-amerika",
  OKYANUSYA: "okyanusya",
  ANTARKTIKA: "antarktika",
} as const satisfies Record<Continent, string>;

/** The URL identifier of a continent, as a literal union rather than `string`. */
export type ContinentSlugName = (typeof CONTINENT_KEY_TO_SLUG)[Continent];

export const CONTINENT_SLUG_TO_KEY: Record<string, Continent> = {
  afrika: "AFRIKA",
  africa: "AFRIKA",
  asya: "ASYA",
  asia: "ASYA",
  avrupa: "AVRUPA",
  europe: "AVRUPA",
  "kuzey-amerika": "KUZEY_AMERIKA",
  "north-america": "KUZEY_AMERIKA",
  "guney-amerika": "GUNEY_AMERIKA",
  "south-america": "GUNEY_AMERIKA",
  okyanusya: "OKYANUSYA",
  oceania: "OKYANUSYA",
  antarktika: "ANTARKTIKA",
  antarctica: "ANTARKTIKA",
};

export function continentKeyToSlug(key: Continent, locale: string = "tr"): string {
  const data = Object.values(CONTINENTS_REGISTRY).find((c) => c.id === key);
  if (!data) return "afrika";
  return locale === "en" ? data.slugEn : data.slugTr;
}
