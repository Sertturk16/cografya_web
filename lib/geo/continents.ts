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
    question: "Dünyada kaç kıta vardır ve hangi model geçerlidir?",
    answer:
      "Türkiye'de MEB müfredatı ve yaygın coğrafya öğretimi 7 kıta modelini (Asya, Afrika, Kuzey Amerika, Güney Amerika, Antarktika, Avrupa, Okyanusya) esas alır. Birleşmiş Milletler istatistik şeması (UN M49) ise Kuzey ve Güney Amerika'yı tek bir 'Americas' üst bölgesinde toplayarak 6'lı kıta sistemini kullanır. Jeolojik açıdan ise Avrupa ve Asya tek parça Avrasya kütlesini oluşturur.",
  },
  {
    question: "Avrupa ile Asya neden iki ayrı kıta kabul edilir?",
    answer:
      "Avrupa ile Asya arasında okyanusal bir levha sınırı yoktur; jeolojik olarak tek bir kıtadır (Avrasya). İki bölgenin ayrı kıtalar sayılması, 18. yüzyıldan itibaren şekillenen tarihsel, kültürel ve siyasi bir uzlaşımın (konvansiyon) sonucudur. Ural Dağları, Ural Nehri, Hazar Denizi ve Türk Boğazları geleneksel sınır kabul edilir.",
  },
  {
    question: "Dünyanın en büyük ve en küçük kıtaları hangileridir?",
    answer:
      "Yaklaşık 44,6 milyon km² yüzölçümü ve 4,75 milyarı aşan nüfusuyla Asya hem alan hem nüfus bakımından dünyanın en büyük kıtasıdır. Kara yüzölçümü bakımından en küçük kıta yaklaşık 8,5 milyon km² ile Okyanusya'dır (Avustralya anakarası dahil).",
  },
  {
    question: "Antarktika neden bir kıtadır ve üzerinde ülke var mıdır?",
    answer:
      "Antarktika, buzulların altında yaklaşık 14,2 milyon km²'lik gerçek bir kıtasal kayaç kalkanına (kraton) sahip olduğu için kıtadır (Kuzey Kutbu gibi sadece donmuş deniz buzu değildir). Üzerinde hiçbir egemen devlet ve kalıcı yerleşim yoktur; 1959 Antarktika Antlaşması ile uluslararası barış ve bilime ayrılmıştır.",
  },
  {
    question: "Okyanusya bir kıta mıdır yoksa bölge midir?",
    answer:
      "Fiziki coğrafyada Avustralya anakarası ile Büyük Okyanus'a dağılmış Polinezya, Mikronezya ve Melanezya ada topluluklarının tamamı 'Okyanusya' kıtası çatısı altında toplanır. Kara yüzölçümü 8,5 milyon km² iken, deniz yetki alanı (EEZ) 40 milyon km²'yi aşarak karalarının neredeyse 5 katına ulaşır.",
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
    taglineTr: "Ekvatoru ortalayan simetrik iklim kuşakları, kadim platolar ve Büyük Rift Vadisi.",
    countryCount: 54,
    countryCountNoteTr: "BM üyesi 54 bağımsız egemen devlet.",
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
      "Büyük Sahra: Dünyanın en geniş sıcak çöl kuşağı",
      "Doğu Afrika Rift Vadisi: Kıtasal levha ayrışması ve volkanizma",
      "Ekvator Simetrisi: Kuzey ve güney yarımkürede aynalanan biyomlar",
    ],
    prose: {
      introTr:
        "Afrika, ekvator çizgisinin neredeyse tam ortasından geçtiği tek kıtadır. Bu coğrafi konum tesadüfi olmayan bir simetri üretir: Ekvatoral Kongo Havzası'nın gür yağmur ormanlarından hem kuzeye hem güneye doğru uzaklaştıkça savanlar, yarı kurak stepler ve nihayet devasa subtropikal çöl kuşakları birbirini aynalar. Kalkan yapılı yaşlı kabuğu, kesintisiz sıradağlar yerine yüksek platolar ve kıtayı boydan boya yaran tektonik kırık hatlarıyla şekillenmiştir.",
      locationAndBordersTr:
        "Kuzeyde Akdeniz, batıda Atlas Okyanusu, doğuda Hint Okyanusu ve Kızıldeniz ile kuşatılan Afrika, Avrasya kara kütlesine yalnızca dar Süveyş Kıstağı üzerinden temas eder. 1869'da açılan Süveyş Kanalı, iki kıta arasındaki bu son fiziki köprüyü yapay bir suyoluna dönüştürmüştür. Cebelitarık Boğazı ise kıtanın kuzeybatı ucunu Avrupa'dan sadece 14 kilometrelik bir deniz eşiğiyle ayırır.",
      landformsAndGeologyTr:
        "Afrika morfolojisi, kıtanın büyük bölümünü kaplayan Prekambriyen yaşlı durağan bir kıtasal kalkana (kraton) dayanır. Güney Amerika'daki Andlar ya da Asya'daki Himalayalar gibi kıtayı baştan başa kat eden tekil genç bir sıradağ zinciri bulunmaz; bunun yerine ortalama yükseltisi 300 ila 1.000 metre arasında değişen geniş basamaklı platolar ve bunların arasına yerleşmiş çanaklar (Kongo, Çad ve Kalahari havzaları) egemendir.\n\nKıtanın jeolojik bakımdan en devingen omurgası, doğuda Ürdün Vadisi'nden Mozambik kıyılarına kadar uzanan Doğu Afrika Rift Sistemi'dir. Nubya ve Somali levhalarının birbirinden uzaklaşmasıyla yaklaşık 30 milyon yıldır genişleyen bu vadi hattı, Kilimanjaro ve Kenya Dağı gibi volkanik zirveleri ve Afrika'nın Büyük Göller kuşağını doğurmuştur. Güney ucunda ise iç yaylayı kıyı şeridinden ayıran dik Büyük Yarkenar (Great Escarpment / Drakensberg) uzanır.",
      climateAndVegetationTr:
        "Afrika'nın iklim rejimini yöneten temel atmosferik mekanizma Hadley hücresidir. Ekvator çevresinde aşırı ısınıp yükselen hava kütleleri bol konvektif yağış bırakarak Kongo Havzası yağmur ormanlarını besler. Yükselen bu havanın 20°-30° kuzey ve güney enlemlerinde dinamik yüksek basınçla alçalması ise atmosferin nem tutma kapasitesini düşürür; böylece kuzeyde uçsuz bucaksız Büyük Sahra, güneyde ise Kalahari ve Namib çölleri ortaya çıkar.\n\nNamib Çölü'nün aşırı kuraklığı ise yalnızca enlem etkisiyle açıklanamaz; kıyı boyunca kuzeye doğru akan soğuk Benguela Akıntısı denizel havanın alt katmanlarını soğutarak yoğun kıyı sisleri üretir ancak yağış oluşumunu kesin biçimde engeller. Kıtanın en kuzey (Mağrip kıyıları) ve en güney (Kap bölgesi) uçlarında Akdeniz makroiklimi ve zengin maki toplulukları yer alır.",
      hydrographyTr:
        "Afrika hidrografyası, plato morfolojisinin bir sonucu olarak basamaklı nehir profilleriyle karakterizedir. 6.650 kilometre uzunluğundaki Nil Nehri, Ekvatoral Göller bölgesinden aldığı Beyaz Nil ve Etiyopya Yaylaları'ndan muson yağmurlarıyla beslenen Mavi Nil'in Hartum'da birleşmesiyle çöl kuşağını aşarak Akdeniz'e hayat taşır.\n\nKongo Nehri ise Amazon'dan sonra dünyanın debisi en yüksek ikinci akarsuyudur; ekvatoru iki kez keserek daimi yağış rejimine sahip dev bir havzayı drene eder. Ancak Kongo, Nijer ve Zambezi nehirlerinin denize dökülmeden önce kıta kenarındaki yarkenarları çağlayanlar (Livingstone ve Viktorya Çağlayanları) eşliğinde aşması, iç kesimler ile okyanus arasındaki kesintisiz gemi ulaşımını tarihsel olarak sınırlandırmıştır.",
      populationAndSettlementTr:
        "Kıtada nüfus son derece dengesiz bir dağılım sergiler. Su kaynaklarının ve tarımsal verimin elverişli olduğu Nil deltası ve vadisi, Gine Körfezi kıyı şeridi (Nijerya metropolleri) ve Doğu Afrika'nın volkanik topraklarla örtülü serin yaylaları (Etiyopya, Ruanda, Burundi) kilometrekareye yüzlerce kişinin düştüğü yoğun yerleşim merkezleridir.\n\nBuna karşılık suyun mutlak yokluğu nedeniyle Sahra'nın devasa kumul ve kaya çölleri ile aşırı nem, sık orman örtüsü ve tropikal hastalık baskısı altındaki iç Kongo Havzası dünyanın en seyrek nüfuslu alanları arasında kalmayı sürdürür.",
      economyAndResourcesTr:
        "Afrika ekonomisi zengin maden ve enerji yataklarının jeolojik mirasına dayanır. Güney Afrika'daki Witwatersrand havzası dünya altın ve platin rezervlerinin önemli bölümünü barındırırken, Kongo Demokratik Cumhuriyeti ve Zambiya'yı kapsayan 'Bakır Kuşağı' çağdaş yeşil enerji teknolojilerinin vazgeçilmezi olan kobalt ve lityum açısından küresel bir merkezdir. Gine Körfezi (Nijerya ve Angola) zengin açık deniz petrol yataklarına sahiptir.\n\nTarımsal üretimde Fildişi Sahili ve Gana'nın küresel lider olduğu kakao, Etiyopya ve Kenya'nın yüksek yaylalarında üretilen kahve monokültür ihracat kalemleridir. Ancak hammadde ihracatına dayalı sömürge dönemi demiryolu ağları iç pazar entegrasyonunu geciktirmiştir.",
      subregionsIntroTr:
        "Birleşmiş Milletler M49 coğrafi şemasına göre Afrika 5 kurumsal alt bölgeye ayrılır. Bu bölgelerin her biri kendine has iklim mekanizmaları, kültürel havzaları ve ekonomik dinamikleri barındırır.",
      disasterAndEnvironmentTr:
        "Afrika'nın en yakıcı çevre sorunu, Sahra'nın güney sınırındaki Sahel kuşağında yaşanan kronik kuraklık ve çölleşmedir. İklim dalgalanmaları ve aşırı otlatma, kırılgan savan ekosistemlerini hızla kumullara teslim etmektedir.\n\nTektonik açıdan ise Doğu Afrika Kırık Hattı aktif deprem üretme potansiyeline sahiptir; Virunga Dağları'ndaki Nyiragongo ve Nyamuragira gibi aktif stratovolkanlar çevre yerleşimler ve Kivu Gölü gaz katmanları için sürekli tehdit oluşturur.",
      historicalAndCulturalTr:
        "Afrika'nın siyasi coğrafyası, 1884-1885 Berlin Konferansı'nda Avrupalı sömürgeci güçler tarafından cetvelle çizilen sınırlardan derinden etkilenmiştir. Doğal nehir havzalarını ve etnik yerleşim coğrafyalarını hiçe sayarak çizilen bu yapay sınırlar, tek bir halkı birkaç farklı devlet sınırına bölerken, çatışan toplulukları aynı idari çatı altında toplamış ve bağımsızlık sonrası sınır sorunlarının ana kaynağı olmuştur.",
    },
    subregions: [
      {
        nameTr: "Kuzey Afrika",
        nameEn: "Northern Africa",
        descriptionTr:
          "Büyük Sahra Çölü ve Akdeniz kıyı kuşağı; Arap-Berberi kültür sahası ve hidrokarbon zenginliği.",
        sampleCountriesTr: ["Mısır", "Cezayir", "Fas", "Tunus", "Libya", "Sudan"],
      },
      {
        nameTr: "Batı Afrika",
        nameEn: "Western Africa",
        descriptionTr:
          "Gine Körfezi kıyılarından Sahel'e uzanan yoğun nüfus, zengin tarım ve petrol havzası.",
        sampleCountriesTr: ["Nijerya", "Gana", "Senegal", "Fildişi Sahili", "Mali", "Nijer"],
      },
      {
        nameTr: "Orta Afrika",
        nameEn: "Middle Africa",
        descriptionTr:
          "Kongo Havzası yağmur ormanları, zengin nehir ağları ve yüksek maden potansiyeli.",
        sampleCountriesTr: ["Kongo DC", "Kamerun", "Angola", "Gabon", "Çad"],
      },
      {
        nameTr: "Doğu Afrika",
        nameEn: "Eastern Africa",
        descriptionTr:
          "Büyük Rift Vadisi, yüksek volkanik yaylalar, Büyük Göller ve zengin yaban hayatı.",
        sampleCountriesTr: ["Etiyopya", "Kenya", "Tanzanya", "Uganda", "Ruanda", "Madagaskar"],
      },
      {
        nameTr: "Güney Afrika",
        nameEn: "Southern Africa",
        descriptionTr: "Kalahari Çölü, zengin elmas ve platin madenleri, ılıman kıyı iklimleri.",
        sampleCountriesTr: ["Güney Afrika", "Namibya", "Botsvana", "Zimbabve", "Zambiya"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Sahel Kuşağı ve Doğu Afrika'da Şiddetli Kuraklık / Çölleşme",
        "Doğu Afrika Rift Zonu Sismik ve Volkanik Tehlikesi",
        "Madagaskar ve Güneydoğu Kıyılarında Hint Okyanusu Siklonları",
        "Büyük Nehir Havzalarında Ani Taşkınlar",
      ],
      faultLinesOrZones: [
        "Doğu Afrika Rift Sistemi (Afar Üçlü Ekleminden Mozambik'e)",
        "Kızıldeniz ve Aden Körfezi Okyanusal Yayılma Merkezleri",
        "Kuzey Afrika Atlas Dağları Kıvrım Kuşağı",
      ],
      warningNoteTr:
        "Doğu Afrika Rift Sistemi boyunca devam eden levha açılması, yüzeye yakın sığ odaklı depremler ve lav göllerine sahip tehlikeli volkanizma üretmektedir.",
    },
    faqs: [
      {
        question: "Afrika kıtasında kaç bağımsız devlet vardır?",
        answer:
          "Afrika kıtasında Birleşmiş Milletler üyesi 54 egemen devlet bulunmaktadır. Ayrıca Afrika Birliği üyesi olan ancak BM statüsü tartışmalı Sahra Arap Demokratik Cumhuriyeti (Batı Sahra) ve fiilen bağımsız Somaliland gibi özel statülü topraklar da mevcuttur.",
      },
      {
        question: "Büyük Rift Vadisi kıtayı ikiye mi bölecek?",
        answer:
          "Evet; Doğu Afrika Rift Sistemi boyunca Nubya ve Somali levhaları yılda birkaç milimetre hızla birbirinden uzaklaşmaktadır. Jeolojik olarak on milyonlarca yıl içinde Doğu Afrika'nın ana kütleden ayrılarak yeni bir okyanus havzası oluşturacağı hesaplanmaktadır.",
      },
      {
        question: "Afrika'nın en büyük gölü ve en uzun nehri hangileridir?",
        answer:
          "Kıtanın en büyük tatlı su gölü 68.800 km² yüzölçümüyle Victoria Gölü'dür. En uzun akarsuyu ise 6.650 kilometre uzunluğuyla Akdeniz'e dökülen Nil Nehri'dir.",
      },
      {
        question: "Afrika'nın sınırları neden cetvelle çizilmiş gibi düzdür?",
        answer:
          "1884-1885 Berlin Konferansı'nda Avrupalı sömürgeci güçler, kıtanın fiziki coğrafyasını, nehir havzalarını ve etnik yapısını dikkate almadan enlem ve boylam çizgilerini esas alarak yapay sınırlar belirlemiştir.",
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
    taglineTr: "Dünyanın en yüksek zirveleri, devasa muson havzaları ve kadim nehir medeniyetleri.",
    countryCount: 44,
    countryCountNoteTr:
      "BM M49 Asya coğrafi sınıflandırmasında yer alan 44 bağımsız ülke (Türkiye dahil).",
    population: 4750000000,
    populationFormattedTr: "4,75 Milyar",
    populationSharePercent: 59.3,
    areaKm2: 44579000,
    areaFormattedTr: "44.579.000 km²",
    areaSharePercent: 29.8,
    densityPerKm2: 107,
    highestPoint: {
      name: "Everest Dağı (Sagarmatha / Qomolangma)",
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
      name: "Yangtze Nehri (Chang Jiang)",
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
      "Himalaya & Tibet Platosu: Dünyanın çatısı ve Asya'nın su kulesi",
      "Demografik Ağırlık: Dünya nüfusunun neredeyse %60'ına ev sahipliği",
      "Aşırı Kontrastlar: En yüksek zirve (Everest) ve en alçak çukur (Lut Gölü)",
    ],
    prose: {
      introTr:
        "Asya, hem yüzölçümü hem de nüfus bakımından gezegenin açık ara en büyük kıtasıdır. Dünya kara alanının yaklaşık üçte birini kaplarken, dünya nüfusunun neredeyse beşte üçüne ev sahipliği yapar. Hindistan Levhası'nın Avrasya'ya çarpmasıyla yükselen Himalaya sıradağları ve 'Dünyanın Çatısı' sayılan Tibet Platosu, kıtanın ikliminden nehir ağlarına kadar tüm fiziki dengelerini organize eden ana motordur.",
      locationAndBordersTr:
        "Kuzeyde Arktik Okyanusu, doğuda Büyük Okyanus, güneyde Hint Okyanusu ile çevrelenen Asya'nın batı sınırı fiziki bir su kütlesi değil, tarihsel bir uzlaşımdır (konvansiyon). 18. yüzyıldan bu yana Ural Dağları, Ural Nehri, Hazar Denizi, Kafkasya ve Türk Boğazları iki kıta arasındaki geleneksel sınır kabul edilir. Ancak bu hatta aktif bir levha sınırı yoktur; Asya ve Avrupa jeolojik olarak Avrasya adlı tek bir devasa tektonik kalkanın parçasıdır.",
      landformsAndGeologyTr:
        "Asya fiziki coğrafyasının kalbinde Hindistan ile Avrasya levhalarının yaklaşık 50 milyon yıldır devam eden devasa çarpışması yer alır. Bu süreç yeryüzünün en yüksek dağ sistemi olan Himalayaları ve ortalama 4.500 metre irtifadaki uçsuz bucaksız Tibet Platosu'nu yükseltmiştir. Buradan çevreye yayılan Pamir, Tanrı Dağları ve Karakurum silsileleri dev bir dağ düğümü meydana getirir.\n\nKuzeyde ise Sibirya Kalkanı gibi kadim, durağan ve aşınmış düzlükler uzanırken; doğu ve güneydoğuda Pasifik Ateş Çemberi'nin genç volkanik yayları (Japonya, Filipinler ve Endonezya ada zincirleri) yer alır. Batıda ise Arap Levhası'nın sıkıştırmasıyla oluşan Zagros Kıvrım Kuşağı uzanır.",
      climateAndVegetationTr:
        "Tibet Platosu, Asya'nın hem en yağışlı hem en kurak yerlerini aynı anda üreten iklim motorudur. Yaz aylarında devasa platonun hızla ısınıp termik alçak basınç merkezi oluşturması, Hint Okyanusu'ndan nem yüklü devasa hava kütlelerini çeker. Bu durum Güney ve Güneydoğu Asya'yı etkisi altına alan Asya Musonunu tetikler; dünyanın en çok yağış alan yeri (Çerapunçi / Meghalaya) Himalayaların güney eteklerinde oluşur.\n\nAncak aynı Himalaya duvarı bulutların kuzeye geçişini engellediği için dağların arkasında kalan Orta Asya ve Tibet dünyanın en büyük yağmur gölgesi çöl kuşağına dönüşür (Gobi ve Taklamakan çölleri). Kuzeyde tayga ormanları ve tundra biyomları, güneyde ise nemli tropikal yağmur ormanları egemendir.",
      hydrographyTr:
        "Tibet Platosu ve çevreleyen buzullar 'Asya'nın Su Kulesi' olarak adlandırılır. Sarı Nehir (Huang He), Yangtze, Mekong, Salween, Brahmaputra, Ganj ve İndus nehirlerinin tamamı bu dağlık çekirdekten doğar ve aşağı havzalarda 1,5 milyardan fazla insanın içme, sulama ve enerji ihtiyacını karşılar.\n\nKıtanın iç kesimleri ise okyanusa çıkışı olmayan devasa kapalı havzalarla (Hazar Denizi, Baykal Gölü, Aral Gölü havzası ve dünyanın en derin çöküntüsü Lut Gölü) kaplıdır. Baykal Gölü tek başına yeryüzündeki donmamış tatlı suyun yaklaşık beşte birini barındırır.",
      populationAndSettlementTr:
        "Nüfus, muson yağmurlarının ve nehir alüvyonlarının tarıma olanak tanıdığı nehir deltalarında olağanüstü yoğunlaşmıştır. Kuzey Çin Ovası, Yangtze Deltası, Hint-Gang Ovası ve Endonezya'nın Java Adası kilometrekareye binlerce insanın düştüğü küresel demografik merkezlerdir.\n\nBuna karşılık şiddetli karasallık ve yükselti nedeniyle Tibet Platosu, Gobi Çölü, Moğolistan bozkırları ve Sibirya'nın donmuş arazileri kilometrekareye 2 kişinin bile düşmediği geniş boşluklar barındırır.",
      economyAndResourcesTr:
        "Asya dünya sanayi üretiminin, teknolojisinin ve enerji rezervlerinin ağırlık merkezidir. Basra Körfezi tortul havzası küresel petrol rezervlerinin yarısından fazlasını ve doğalgaz yataklarının %40'ını barındırır.\n\nDoğu Asya (Çin, Japonya, Güney Kore, Tayvan) yüksek teknoloji, yarı iletken, otomotiv ve ağır sanayide dünyanın imalat atölyesidir. Pirinç tarımı milyarlarca insanın temel gıda kaynağını oluştururken, Malakka Boğazı dünya deniz ticaretinin en stratejik boğum noktasıdır.",
      subregionsIntroTr:
        "BM M49 sınıflandırmasına göre Asya beş ana alt bölgeye ayrılır. Her alt bölge belirgin bir iklim, jeoloji ve kültürel medeniyet havzasını temsil eder.",
      disasterAndEnvironmentTr:
        "Asya doğal afet sıklığı ve yıkıcılığı bakımından dünyanın en kırılgan kıtasıdır. Pasifik Ateş Çemberi üzerindeki ada yayları (Japonya, Endonezya, Filipinler) yıkıcı depremler, tsunamiler ve volkanik patlamalarla karşı karşıyadır. Himalaya sismik kuşağı kıta içi levha çarpışmasına bağlı büyük büyüklükte (M≥7.5) sarsıntılar üretir.\n\nMuson mevsiminde Bangladeş ve Hindistan'da yaşanan nehir taşkınları ile Aral Gölü'nün aşırı sulama projeleri yüzünden kuruması kıtanın önde gelen ekolojik krizleridir.",
      historicalAndCulturalTr:
        "Asya, yeryüzünün en eski nehir boyu medeniyetlerine (Mezopotamya, İndus Vadisi, Sarı Nehir) ve evrensel dinlerin (İslam, Hristiyanlık, Musevilik, Budizm, Hinduizm) doğuşuna beşiklik etmiştir. Kıta-boyu kervan ticareti ağı olan İpek Yolu, vahalar ve dağ geçitleri üzerinden Çin'den Akdeniz'e dek sadece mal değil, inanç, alfabe ve bilim aktarımını sağlayarak bugünün Asya kültür haritasını örmüştür.",
    },
    subregions: [
      {
        nameTr: "Doğu Asya",
        nameEn: "Eastern Asia",
        descriptionTr:
          "Sarı Nehir ve Yangtze havzaları, kadim medeniyetler, dünyanın en büyük üretim ve teknoloji merkezi.",
        sampleCountriesTr: ["Çin", "Japonya", "Güney Kore", "Moğolistan", "Kuzey Kore"],
      },
      {
        nameTr: "Güneydoğu Asya",
        nameEn: "South-eastern Asia",
        descriptionTr:
          "Tropikal ada ve yarımadalar kuşağı, Pasifik Ateş Çemberi, deniz ticaret rotaları.",
        sampleCountriesTr: ["Endonezya", "Malezya", "Filipinler", "Vietnam", "Tayland", "Singapur"],
      },
      {
        nameTr: "Güney Asya",
        nameEn: "Southern Asia",
        descriptionTr: "Himalayalar güneyi, Hint-Gang Ovası, yoğun nüfus ve muson tarımı.",
        sampleCountriesTr: ["Hindistan", "Pakistan", "Bangladeş", "Nepal", "Sri Lanka"],
      },
      {
        nameTr: "Orta Asya",
        nameEn: "Central Asia",
        descriptionTr:
          "Denizden en uzak karasal kalbi, İpek Yolu bozkırları ve hidrokarbon/maden zenginliği.",
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
          "Bereketli Hilal, Basra Körfezi petrol sahaları, Akdeniz ve Kafkaslar köprüsü.",
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
        "Pasifik Ateş Çemberi Sismik Hatları & Tsunami (Japonya, Endonezya, Filipinler)",
        "Himalaya-Alp Levha Çarpışma Kuşağı Yıkıcı Depremleri",
        "Güney ve Güneydoğu Asya Muson Taşkınları ve Tropikal Siklonlar",
        "Orta ve Batı Asya Kuraklık ve Toz Fırtınaları",
      ],
      faultLinesOrZones: [
        "Himalaya Ana Bindirme Fayı (MHT)",
        "Kuzey Anadolu ve Doğu Anadolu Fay Sistemleri (Türkiye)",
        "Zagros Kıvrım-Bindirme Kuşağı (İran)",
        "Sunda Hendeği Dalma-Batma Zonu (Endonezya)",
      ],
      warningNoteTr:
        "Dünyadaki volkanik patlamaların ve tsunamilerin %70'inden fazlası Asya'nın doğu ve güneydoğu kıyılarında gerçekleşmektedir.",
    },
    faqs: [
      {
        question: "Avrupa ile Asya arasındaki sınır nereden geçer?",
        answer:
          "Jeolojik bir levha sınırı bulunmamakla birlikte, coğrafi gelenek Ural Dağları, Ural Nehri, Hazar Denizi, Kafkas Dağları'nın su bölümü çizgisi, Karadeniz, İstanbul ve Çanakkale boğazlarını kıtalararası sınır kabul eder.",
      },
      {
        question: "Türkiye Asya kıtasında mı yer alır?",
        answer:
          "Türkiye topraklarının %97'si (Anadolu) Asya kıtasında, %3'ü (Doğu Trakya) Avrupa kıtasındadır. BM M49 şeması Türkiye'yi bir bütün olarak Batı Asya bölgesinde sınıflandırır.",
      },
      {
        question: "Asya neden dünyanın en kalabalık kıtasıdır?",
        answer:
          "Muson rejiminin sağladığı bol su ve nehir deltalarının biriktirdiği verimli alüvyon topraklar, binlerce yıldır yılda birden çok ürün alınmasına (özellikle pirinç) imkân vermiş ve devasa nüfusları besleyebilmiştir.",
      },
      {
        question: "Lut Gölü neden dünyanın en alçak noktasıdır?",
        answer:
          "Ölü Deniz (Lut Gölü), Afrika levhası ile Arap levhasının birbirinden yanal olarak kaydığı Ölü Deniz Kırık Hattı üzerinde yer alan derin bir tektonik çöküntüdür; su yüzeyi deniz seviyesinin yaklaşık 430 metre altındadır.",
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
    taglineTr: "Yarımadalar yarımadası, Gulf Stream ılımanlığı ve Sanayi Devrimi'nin beşiği.",
    countryCount: 43,
    countryCountNoteTr:
      "BM M49 Avrupa sınıflandırmasındaki 43 bağımsız ülke (Rusya Federasyonu dahil).",
    population: 745000000,
    populationFormattedTr: "745 Milyon",
    populationSharePercent: 9.3,
    areaKm2: 10180000,
    areaFormattedTr: "10.180.000 km²",
    areaSharePercent: 6.8,
    densityPerKm2: 73,
    highestPoint: {
      name: "Elbrus Dağı (Kafkaslar) / Mont Blanc (Alpler)",
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
      "Girintili Kıyılar: Deniz etkisinin iç kesimlere dek sokulduğu yarımadalar yapısı",
      "Kuzey Atlantik Akıntısı: Enlemine göre olağanüstü ılıman kışlar",
      "Yüksek Kentleşme: Yoğun sanayi koridoru ve gelişmiş altyapı ağı",
    ],
    prose: {
      introTr:
        "Avrupa, Avrasya kara kütlesinin batıya uzanmış devasa bir yarımadası, coğrafyacıların ifadesiyle bir 'yarımadalar yarımadası'dır. İber, İtalya, Balkan ve İskandinav yarımadalarıyla çevrili bu girintili çıkıntılı kıyı yapısı, kıtanın neredeyse hiçbir noktasının denizden çok uzak kalmamasını sağlar. Kuzey Atlantik Akıntısı'nın getirdiği ılımanlaştırıcı etki sayesinde aynı enlemdeki Sibirya ya da Kanada tundralarına kıyasla çok daha elverişli yaşam koşulları sunar.",
      locationAndBordersTr:
        "Batıda Atlas Okyanusu, kuzeyde Arktik Denizi, güneyde Akdeniz ve Karadeniz ile sınırlandırılmıştır. Doğu sınırı ise Ural Dağları, Ural Nehri ve Hazar Denizi hattı boyunca uzanır. Cebelitarık Boğazı güneybatıda Afrika'ya, Çanakkale ve İstanbul boğazları ise güneydoğuda Anadolu'ya komşudur.\n\nSiyasi coğrafyada Rusya Federasyonu'nun topraklarının yaklaşık %77'si Ural'ın doğusunda (Sibirya'da) kalmasına rağmen, başkenti ve nüfusunun %75'i batıda yer aldığından BM M49 şeması Rusya'yı bir bütün olarak Doğu Avrupa içinde kabul eder.",
      landformsAndGeologyTr:
        "Avrupa topografyası güneydeki genç kıvrım dağları ile kuzeydeki geniş ovaların tezatlığı üzerine kuruludur. Güney kuşağında Afrika ve Avrasya levhalarının çarpışmasıyla yükselen Alpler, Pireneler, Apeninler ve Karpatlar yer alır. Alp Orojenezinin bu genç zirveleri dik yamaçlar ve derin vadilerle belirgindir.\n\nKıtanın kuzeyinde ise Fransa'dan Ural Dağları'na kadar kesintisiz uzanan Kuzey Avrupa Ovası uzanır. Bu düzlük tarih boyunca göçler, ticaret ve askeri hareketler için doğal bir koridor işlevi görmüştür. İskandinavya ve İskoçya'da ise buzul çağlarının mirası olan fiyortlar ve Baltık Kalkanı'nın yaşlı kristalin kayaları egemendir.",
      climateAndVegetationTr:
        "Avrupa'nın iklimini belirleyen en kritik unsur, Meksika Körfezi'nden doğup Atlas Okyanusu'nu aşan sıcak su akıntısı Gulf Stream (Kuzey Atlantik Akıntısı) ve batı rüzgarlarıdır. Bu akıntı, 50°-60° kuzey enlemlerinde yer alan Londra, Paris ve Hamburg gibi metropollerin kışları donma noktasının üzerinde, ılıman ve bol yağışlı (okyanusal iklim) geçirmesini sağlar.\n\nGüneyde Akdeniz havzası yazları sıcak ve kurak, kışları ılık ve yağışlı bir rejim sunar. Doğuya doğru gidildikçe deniz etkisi azalır ve yerini sıcak yazlar ile sert karlı kışların yaşandığı nemli karasal iklime bırakır. Doğal bitki örtüsü güneyde maki, orta kesimlerde geniş yapraklı karma ormanlar, kuzeyde ise iğne yapraklı tayga kuşağıdır.",
      hydrographyTr:
        "Avrupa nehirleri, kıtanın iktisadi omurgasını oluşturan düzenli rejimleri ve birbirine kanallarla bağlı oluşlarıyla öne çıkar. Ren Nehri, İsviçre Alpleri'nden doğup Almanya ve Hollanda'nın sanayi kalbini katederek Rotterdam limanından Kuzey Denizi'ne dökülür ve dünyanın en işlek iç suyoludur.\n\nTuna Nehri ise Kara Ormanlar'dan doğup 10 ülkeyi geride bırakarak Karadeniz'e ulaşır. Volga, 3.530 km ile Avrupa'nın en uzun nehridir. Ladoga ve Onega gölleri kuzeyde buzullaşma sonucu oluşmuş dev tatlı su kütleleridir.",
      populationAndSettlementTr:
        "Avrupa dünya ortalamasının çok üzerinde (%75+) bir kentleşme oranına sahiptir. İngiltere'nin merkezinden başlayıp Benelüks ülkeleri, Ren Vadisi ve Kuzey İtalya'ya kadar uzanan 'Mavi Muz' (Blue Banana) kuşağı, kıtanın en yoğun nüfuslu, sermaye ve sanayinin en çok kümelendiği koridorudur.\n\nDemografik olarak yaşlanan bir nüfus yapısına sahip olan kıtada, kırsal alanlardan şehirlere ve Doğu Avrupa'dan Batı Avrupa metropollerine doğru sürekli bir iç göç hareketi gözlenmektedir.",
      economyAndResourcesTr:
        "Avrupa, Sanayi Devrimi'nin doğduğu yerdir. 19. yüzyılda Ruhr (Almanya) ve Midlands (İngiltere) kömür havzalarında başlayan sanayileşme, bugün ileri mühendislik, kimya, otomotiv, havacılık ve finans sektörlerine evrilmiştir.\n\nAvrupa Birliği ortak pazarı, kıta içi gümrüksüz ticaret ve sermaye serbestisi sağlayarak küresel ekonomik bir güç merkezi kurmuştur. Tarımda yüksek verimli mekanizasyon uygulanırken, Kuzey Denizi açıklarında zengin petrol ve doğalgaz üretilmektedir.",
      subregionsIntroTr:
        "BM M49 standardı Avrupa'yı 4 kurumsal alt bölgeye ayırır: Batı, Kuzey, Güney ve Doğu Avrupa. Bu ayrım coğrafi, ekonomik ve tarihsel temellere dayanır.",
      disasterAndEnvironmentTr:
        "Kıtanın sismik tehlikesi esas olarak Afrika-Avrasya temas bölgesinde yer alan Akdeniz kuşağında (İtalya, Yunanistan, Balkanlar) yoğunlaşır. Etna, Vezüv ve Stromboli aktif volkanlardır. İzlanda ise Orta Atlantik Sırtı üzerindeki çatlak volkanizmasıyla bilinir.\n\nSon yıllarda iklim krizine bağlı olarak Güney Avrupa'da şiddetli yaz sıcak dalgaları, orman yangınları ve Ren/Tuna havzalarında ani yıkıcı sel felaketleri en büyük çevresel tehdit haline gelmiştir.",
      historicalAndCulturalTr:
        "Antik Yunan demokrasisi ve Roma hukukunun temelleri üzerinde yükselen Avrupa, Orta Çağ feodalizminin ardından Rönesans, Reform, Aydınlanma Çağı ve 1789 Fransız İhtilali ile çağdaş ulus devlet ve insan hakları kavramlarını üretmiştir. 15. yüzyıldan itibaren başlayan Coğrafi Keşifler ve sömürgecilik dalgası, Avrupa dillerinin ve kurumlarının tüm dünyaya yayılmasına yol açmıştır.",
    },
    subregions: [
      {
        nameTr: "Batı Avrupa",
        nameEn: "Western Europe",
        descriptionTr:
          "Ren Havzası, yüksek sanayileşme, okyanusal iklim ve küresel finans merkezleri.",
        sampleCountriesTr: ["Almanya", "Fransa", "Hollanda", "Belçika", "İsviçre", "Avusturya"],
      },
      {
        nameTr: "Güney Avrupa",
        nameEn: "Southern Europe",
        descriptionTr:
          "Akdeniz kıyı kuşağı, İber, İtalya ve Balkan yarımadaları, zengin tarihi miras.",
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
          "İskandinav ve Baltık ülkeleri, Britanya Adaları, fiyortlar ve yüksek refah düzeyi.",
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
          "Kuzey Avrupa Ovası uzantısı, Volga ve Tuna havzaları, karasal iklim egemenliği.",
        sampleCountriesTr: ["Rusya", "Polonya", "Ukrayna", "Romanya", "Çekya", "Macaristan"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Güney Avrupa & Akdeniz Havzası Sismik Tehlikesi (İtalya, Yunanistan)",
        "İzlanda ve İtalya Aktif Volkanizması",
        "Kıta Genelinde Sıcak Dalgaları, Kuraklık ve Orman Yangınları",
        "Orta ve Batı Avrupa Büyük Nehir Taşkınları (Ren, Elbe, Tuna)",
      ],
      faultLinesOrZones: [
        "Afrika-Avrasya Dalma-Batma Zonu (Kuzey Akdeniz Yayı)",
        "Apenin Fay Sistemi (İtalya)",
        "Orta Atlantik Yayılma Sırtı (İzlanda)",
      ],
      warningNoteTr:
        "İtalya ve Balkanlar boyunca uzanan fay hatları, sığ odaklı yıkıcı depremler üretme potansiyeline sahiptir.",
    },
    faqs: [
      {
        question: "Avrupa'nın en yüksek zirvesi Mont Blanc mı Elbrus mu?",
        answer:
          "Eğer Kafkas Dağları'nın su bölümü çizgisi Avrupa-Asya sınırı kabul edilirse, Rusya sınırları içindeki 5.642 metrelik Elbrus Dağı Avrupa'nın en yüksek zirvesidir. Kafkaslar sınır dışı tutulduğunda ise Fransa-İtalya sınırındaki 4.808 metrelik Mont Blanc en yüksek dağ sayılır.",
      },
      {
        question: "Avrupa neden aynı enlemdeki Kanada ve Sibirya'dan daha sıcaktır?",
        answer:
          "Meksika Körfezi'nden kuzeydoğuya doğru akan Gulf Stream (Kuzey Atlantik Sıcak Su Akıntısı) ve batı rüzgarları, okyanus üzerindeki devasa ısı enerjisini Batı ve Kuzey Avrupa kıyılarına taşıyarak kış sıcaklıklarını 10-15°C yükseltir.",
      },
      {
        question: "Mavi Muz (Blue Banana) ne anlama gelir?",
        answer:
          "Londra'dan başlayıp Benelüks, Batı Almanya ve İsviçre üzerinden Milano ve Cenova'ya kadar kavisli bir hat çizen, yaklaşık 110 milyon insanın yaşadığı, Avrupa'nın en yoğun sanayi, ticaret ve nüfus koridorudur.",
      },
      {
        question: "Fiyort nedir ve nerede görülür?",
        answer:
          "Buzul çağlarında derinleşen U şekilli buzul vadilerinin deniz suyu altında kalmasıyla oluşan dik, derin ve uzun körfezlere fiyort denir. Avrupa'da en muazzam örnekleri Norveç kıyılarında ve İskoçya'da görülür.",
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
      "Boylamsal dağ kalkanları, Büyük Göller ve engelsiz hava kütlelerinin çarpışma alanı.",
    countryCount: 23,
    countryCountNoteTr: "Kanada, ABD, Meksika, 7 Orta Amerika ve 13 Karayip ada ülkesi.",
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
      name: "Ölüm Vadisi (Badwater Basin)",
      elevationM: -86,
      locationTr: "ABD (Kaliforniya)",
      noteTr: "Kuzey Amerika'nın en derin ve en sıcak çöl çukuru.",
    },
    longestRiver: {
      name: "Mississippi - Missouri Nehir Sistemi",
      lengthKm: 5970,
      noteTr: "Meksika Körfezi'ne dökülen dünyanın en büyük drenaj havzalarından biri.",
    },
    largestLake: {
      name: "Superior Gölü (Büyük Göller)",
      areaKm2: 82100,
    },
    dominantClimateTr: "Kutup Tundrası, Karasal, Ilıman, Step, Çöl ve Karayip Tropikali",
    classificationSourceTr: "National Geographic & BM M49 — 23 Egemen Devlet Kapsamı",
    keyCharacteristicsTr: [
      "Tornado Alley: Kuzey-güney açık ovalarında kutup ve tropikal hava çarpışması",
      "Büyük Göller: Dünyanın en büyük tatlı su yüzeyi havzası",
      "Kordiyera Sistemi: Pasifik boyunca uzanan genç Kayalık Dağlar silsilesi",
    ],
    prose: {
      introTr:
        "Kuzey Amerika, Arktik dondurucu kutup tundralarından Karayipler'in tropikal mercan adalarına kadar uzanan devasa bir ekolojik yelpazeye sahiptir. Kıtanın morfolojik omurgasını, batıda Pasifik boyunca uzanan genç ve sarp Kayalık Dağlar (Rocky Mountains) ile doğuda aşınmış yaşlı Appalaş Dağları belirler. İki dağ kütlesi arasında doğu-batı yönlü hiçbir doğal engel olmaksızın uzanan devasa Büyük Ovalar (Great Plains), Arktik soğukları ile Meksika Körfezi'nin sıcak-nemli havasının doğrudan çarpışmasına yol açar.",
      locationAndBordersTr:
        "Kuzeyde Arktik Okyanusu, batıda Büyük Okyanus, doğuda Atlas Okyanusu ve güneydoğuda Karayip Denizi ile çevrilidir. Güneyde Panama Kıstağı ve Darién Boşluğu bataklıkları üzerinden Güney Amerika'ya bağlanır.\n\nKıtanın kapsamı konusunda iki yaklaşım vardır: BM M49 şeması dar 'Kuzey Amerika'yı yalnızca ABD ve Kanada çekirdeği olarak tanımlarken, National Geographic ve fiziki coğrafya literatürü Orta Amerika ve Karayip ada devletlerini Panama Kıstağı'na kadar tek bir kıta kabul eder. Projemiz bu kapsamlı fiziki coğrafya yaklaşımını benimser.",
      landformsAndGeologyTr:
        "Kıta üç ana jeolojik kuşağa ayrılır. Doğuda yaklaşık 480 milyon yıl önceki kaledoniyen orojenezle yükselmiş, zamanla erozyonla yuvarlak tepelere dönüşmüş Appalaş Dağları yer alır. Merkezde ve kuzeyde ise yeryüzünün en yaşlı kayaçlarını barındıran, buzul aşındırmasıyla binlerce göl çanağı kazanmış sert kristalin Kanada Kalkanı uzanır.\n\nBatı kuşağında ise Pasifik levhası ile Kuzey Amerika levhasının sürtünmesi ve bindirmesiyle yükselen Kuzey Amerika Kordiyerası (Kayalık Dağlar, Cascade ve Sierra Nevada sıraları) yer alır. Bu genç dağ zincirleri aktif faylar, volkanlar ve derin kanyonlarla (Büyük Kanyon) şekillenmiştir.",
      climateAndVegetationTr:
        "Kuzey Amerika iklimini en çok etkileyen fiziki unsur, sıradağların enlemesine (doğu-batı) değil boylamasına (kuzey-güney) uzanmasıdır. Bu durum, kutup kökenli dondurucu hava kütlelerinin (blizzard) hiçbir engele çarpmadan Teksas ve Meksika Körfezi'ne kadar inebilmesine, güneyin sıcak nemli havasının ise iç kesimlere sokulabilmesine neden olur.\n\nBu iki zıt hava kütlesinin Büyük Ovalar üzerinde temas ettiği hat, dünyanın en şiddetli hortumlarının üretildiği 'Hortum Vadisi'ni (Tornado Alley) oluşturur. Batı kıyısında Akdeniz ve okyanusal iklimler, güneybatıda kurak Sonora ve Mojave çölleri, kuzeyde ise tayga ve tundra kuşağı yer alır.",
      hydrographyTr:
        "Kıtanın kalbinde yer alan Büyük Göller (Superior, Michigan, Huron, Erie, Ontario), buzul gerilemesiyle oluşmuş, dünya yüzey tatlı su rezervlerinin yaklaşık beşte birini tutan devasa bir hidrolojik sistemdir. Saint Lawrence Nehri vasıtasıyla Atlas Okyanusu'na bağlanan bu sistem kıta içi ağır gemi taşımacılığına imkân tanır.\n\nMississippi-Missouri nehir sistemi ise 30'dan fazla eyaleti drene ederek kıtanın tarımsal kalbini Meksika Körfezi'ne bağlar. Batıda ise dağları yararak ilerleyen Kolorado Nehri kurak güneybatının can damarıdır.",
      populationAndSettlementTr:
        "Nüfus, su ve ticaret yollarının en elverişli olduğu kıyılarda ve Büyük Göller çevresinde toplanmıştır. Boston'dan Washington D.C.'ye uzanan BosWash megalopolü, kıtanın siyasi ve finansal ağırlık merkezidir. Kaliforniya kıyıları ve Meksika'nın yüksek platoları (Meksiko metropolü) diğer yoğun alanlardır.\n\nBuna karşılık kurak Büyük Havza (Great Basin), Kayalık Dağların yüksek kesimleri ve Kanada ile Alaska'nın donmuş kuzey toprakları son derece seyrek bir nüfus yoğunluğu sergiler.",
      economyAndResourcesTr:
        "Kuzey Amerika dünyanın en büyük gayrisafi hasılasını üreten küresel ekonomik bir devdir. Büyük Ovalar dünyanın tahıl ambarı olup mısır, soya ve buğday üretiminde küresel liderdir. Kayaç gazı ve hidrolik çatlatma teknolojileriyle ABD ve Kanada dünyanın en büyük hidrokarbon üreticileri arasındadır.\n\nKaliforniya'daki Silikon Vadisi küresel bilişim, yapay zekâ ve yazılım endüstrisinin merkezidir. NAFTA (yeni adıyla USMCA) serbest ticaret anlaşması Kanada, ABD ve Meksika üretim zincirlerini entegre etmiştir.",
      subregionsIntroTr:
        "Kuzey Amerika kıtası üç ana jeopolitik ve coğrafi kuşağa ayrılır: Anglo-Amerika (ABD ve Kanada), Orta Amerika kıstağı ve Karayip Ada Devletleri.",
      disasterAndEnvironmentTr:
        "Batı kıyısı boyunca uzanan San Andreas Fay Hattı, Kaliforniya'da yıkıcı deprem potansiyeli taşır. Cascade Sıradağları'nda yer alan Saint Helens ve Rainier gibi volkanlar aktiftir.\n\nMeksika Körfezi ve Karayip kıyıları her sonbaharda Atlas Okyanusu üzerinden gelen yıkıcı kasırgaların (hurricanes) hedefi olurken, iç ovalar her bahar yüzlerce ölümcül hortumla sarsılır. Batıda ise kuraklık kaynaklı kontrol edilemeyen orman yangınları büyümektedir.",
      historicalAndCulturalTr:
        "Kıta, on binlerce yıl önce Bering Boğazı üzerinden geçen yerli halkların (İnuitler, Kızılderililer, Mayalar, Aztekler) kadim yurdudur. 1492 sonrasında başlayan yoğun Avrupalı kolonizasyonu yerli nüfusu dramatik biçimde azaltmış; ardından köle ticareti ve 19-20. yüzyıllarda dünyanın her köşesinden gelen göç dalgalarıyla çok kültürlü çağdaş toplumlar inşa edilmiştir.",
    },
    subregions: [
      {
        nameTr: "Kuzey Amerika Çekirdeği (Anglo-Amerika)",
        nameEn: "Northern America",
        descriptionTr:
          "Kanada ve Amerika Birleşik Devletleri; yüksek sanayi, geniş tarım ovaları ve ileri teknoloji.",
        sampleCountriesTr: ["Amerika Birleşik Devletleri", "Kanada"],
      },
      {
        nameTr: "Orta Amerika",
        nameEn: "Central America",
        descriptionTr:
          "Meksika'dan Panama Kıstağı'na uzanan volkanik dağlar, tropikal ormanlar ve Maya mirası.",
        sampleCountriesTr: ["Meksika", "Guatemala", "Kosta Rika", "Panama", "Honduras"],
      },
      {
        nameTr: "Karayipler",
        nameEn: "Caribbean",
        descriptionTr:
          "Büyük ve Küçük Antiller adalar kuşağı, tropikal iklim, deniz turizmi ve şeker kamışı tarımı.",
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
        "Meksika Körfezi ve Karayiplerde Kategori 4-5 Yıkıcı Kasırgalar (Hurricanes)",
        "San Andreas Fayı ve Pasifik Levhası Sismik Tehlikesi",
        "Büyük Ovalar Hortum Kuşağı (Tornado Alley)",
        "Batı ABD ve Kanada'da Şiddetli Orman Yangınları",
      ],
      faultLinesOrZones: [
        "San Andreas Doğrultu Atımlı Fay Sistemi (Kaliforniya)",
        "Cascadia Dalma-Batma Zonu (Kuzeybatı Pasifik)",
        "Karayip Levha Sınırı Fay Zonu",
      ],
      warningNoteTr:
        "Cascadia dalma-batma zonu, M≥9.0 büyüklüğünde megathrust depremi ve devasa tsunami üretme potansiyeline sahiptir.",
    },
    faqs: [
      {
        question: "Orta Amerika ve Karayipler Kuzey Amerika'ya mı dahildir?",
        answer:
          "Evet; fiziki coğrafya açısından Kuzey Amerika kıtası Kanada'nın kuzey kutup adalarından Panama Kıstağı'na kadar uzanır ve tüm Orta Amerika ile Karayip ada ülkelerini kapsar.",
      },
      {
        question: "Tornado Alley (Hortum Vadisi) neden Kuzey Amerika'dadır?",
        answer:
          "Kıtanın ortasında doğu-batı yönlü bir sıradağ olmaması, kuzeyin soğuk-kuru Arktik havası ile Meksika Körfezi'nin sıcak-nemli tropikal havasının Teksas-Kansas hattında engelsizce çarpışmasına ve süperhücre fırtınalarına yol açar.",
      },
      {
        question: "Büyük Göller nasıl oluşmuştur?",
        answer:
          "Büyük Göller, Son Buzul Çağı'nda (yaklaşık 14.000 yıl önce) kıtayı kaplayan dev Laurentide Buzul Kalkanı'nın yumuşak kayaçları oyması ve buzulun erimesiyle oluşan çanakların tatlı suyla dolması sonucu meydana gelmiştir.",
      },
      {
        question: "Ölüm Vadisi neden dünyanın en sıcak yerlerinden biridir?",
        answer:
          "Deniz seviyesinin 86 metre altında yer alan derin çöküntü havzası, yüksek sıradağlarla çevrilidir; alçalan kuru hava sıkışarak aşırı ısınır ve vadi duvarları arasında hapsolur.",
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
    taglineTr: "And Dağları'nın tek eksenli omurgası, Amazon Yağmur Ormanları ve Lityum Üçgeni.",
    countryCount: 12,
    countryCountNoteTr: "12 bağımsız devlet (Fransız Guyanası denizaşırı bölgesi hariç).",
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
      "Ekvatoral Tropikal Yağmur Ormanı, Savan, Yarı Kurak Pampa, Atakama Çölü ve Dağ İklimi",
    classificationSourceTr: "BM İstatistik Bölümü (UN M49) — Amerika Kıtası Alt Bölgesi",
    keyCharacteristicsTr: [
      "And Dağları: 7.000 km uzunluğuyla dünyanın en uzun kesintisiz dağ zinciri",
      "Amazon Biyomu: Yeryüzündeki türlerin %10'undan fazlasını barındıran biyolojik çeşitlilik",
      "Atakama Çölü: Çifte yağmur gölgesi ve soğuk Humboldt akıntısıyla dünyanın en kurak yeri",
    ],
    prose: {
      introTr:
        "Güney Amerika'nın fiziki coğrafyası, Afrika'nın çoklu havza-plato yapısının aksine tek bir baskın eksen üzerinde organize olmuştur: Batı kıyısı boyunca baştan sona uzanan And Dağları. Nazca levhasının kıtasal levhanın altına dalmasıyla yükselen bu 7.000 kilometrelik devasa bariyer, kıtanın akarsu yönelimlerinden iklim kuşaklarına, maden dağılımından yerleşim desenine kadar tüm sistemlerini tek başına belirler.",
      locationAndBordersTr:
        "Kuzeyde Panama Kıstağı ve Darién Boşluğu üzerinden Orta Amerika'ya bağlanır. Doğuda Atlas Okyanusu, batıda Büyük Okyanus, kuzeyde Karayip Denizi ve güneyde fırtınalı Drake Boğazı ile çevrilidir. Drake Boğazı, kıtayı Antarktika'dan yaklaşık 1.000 kilometrelik açık deniz mesafesiyle ayırır.",
      landformsAndGeologyTr:
        "Kıtanın morfolojisi üç ana kuşaktan oluşur. Batıda Pasifik Ateş Çemberi'nin parçası olan genç, sismik açıdan son derece aktif ve dünyanın en yüksek volkanlarını barındıran And Dağları sıralanır. Andların orta kesiminde, Doğu ve Batı Kordiyera arasında sıkışmış 3.800 metre irtifadaki Altiplano Yaylası uzanır.\n\nKıtanın doğusunda ise Prekambriyen döneminden kalma aşınmış, durağan Guyana ve Brezilya Kalkanları yer alır. Bu iki yükselti kütlesinin arasında ise yeryüzünün en geniş alüvyal çöküntü ovaları olan Amazon Havzası ve güneydeki Paraná-Paraguay (Gran Chaco ve Pampa) ovaları uzanır.",
      climateAndVegetationTr:
        "Amazon Havzası, ekvatoral konumu ve Atlas Okyanusu'ndan gelen alize rüzgarlarının taşıdığı nemin And Dağları'na çarpıp yoğuşması sayesinde dünyanın en geniş tropikal yağmur ormanını barındırır. Kıtanın güney kesiminde yer alan Pampa düzlükleri verimli ılıman çayırlarla örtülüdür.\n\nBuna karşın kıtanın batısında, Şili'de yer alan Atakama Çölü kutuplar haricinde dünyanın en kurak yeridir. Atakama'nın aşırı kuraklığı çifte mekanizmanın sonucudur: And Dağları doğudan gelen tüm Atlantik nemini keserken (yağmur gölgesi), batıda Büyük Okyanus kıyısından akan soğuk Humboldt (Peru) Akıntısı denizel havanın yükselip yağış bırakmasını kesinlikle önler.",
      hydrographyTr:
        "Amazon Nehri tek başına dünya denizlerine dökülen nehir suyunun yaklaşık beşte birini taşır. Havza genişliği 7 milyon kilometrekareyi bulur ve 1.100'den fazla kol ile beslenir. And Dağları'nın batı yamacından doğup kıtayı doğuya doğru boydan boya kat eden Amazon, Atlas Okyanusu'na boşalırken tuzlu suyu yüzlerce kilometre açığa kadar seyreltir.\n\nGüneyde Paraná ve Uruguay nehirlerinin birleşerek oluşturduğu Río de la Plata halici, kıtanın ikinci büyük drenaj sistemidir. 3.812 metre irtifadaki Titicaca Gölü ise dünyanın ticari gemi işletilen en yüksek gölüdür.",
      populationAndSettlementTr:
        "Güney Amerika nüfusu kıtanın kıyı kenarlarında kümelenmiştir ('içi boş kıta' modeli). Atlas Okyanusu kıyısında São Paulo, Rio de Janeiro ve Buenos Aires; Pasifik kıyısında ise Lima ve Santiago gibi dev metropoller yer alır.\n\nİç kısımlarda yer alan devasa Amazon Havzası aşırı nem, sık bitki örtüsü ve ulaşım güçlüğü nedeniyle; güneydeki Patagonya platosu ise şiddetli rüzgarlar ve soğuk çöl iklimi nedeniyle son derece seyrek nüfusludur.",
      economyAndResourcesTr:
        "And Dağları'nın volkanik ve hidrotermal zenginliği, kıtayı küresel bir madencilik devine dönüştürmüştür. Şili ve Peru dünya bakır üretiminin liderleridir. Şili, Bolivya ve Arjantin sınırlarının kesiştiği yüksek tuz düzlükleri (Salar de Uyuni, Salar de Atacama), küresel lityum rezervlerinin yarısından fazlasını barındıran 'Lityum Üçgeni'ni oluşturur.\n\nVenezuela dünyanın en büyük kanıtlanmış ham petrol rezervlerine sahiptir. Brezilya ve Arjantin ise Pampa ve Cerrado ovalarında soya, mısır, sığır eti ve kahve üretiminde küresel tarım devleridir.",
      subregionsIntroTr:
        "Güney Amerika, coğrafi ve iktisadi açıdan And Ülkeleri, Brezilya kara kütlesi ve Güney Koni (Southern Cone) olmak üzere üç temel bölgeye ayrılır.",
      disasterAndEnvironmentTr:
        "Kıtanın batısı Pasifik Ateş Çemberi'nin en tehlikeli segmentlerinden biridir. 1960 yılında kaydedilen 9.5 büyüklüğündeki Valdivia Depremi aletsel dönemin en büyük depremidir. And Dağları'ndaki Cotopaxi ve Villarrica gibi buzullarla kaplı volkanlar lav ve çamur akıntıları (lahar) riski taşır.\n\nEn büyük çevre krizi ise tarım ve sığır otlakları açmak için Amazon yağmur ormanlarında sürdürülen ormansızlaşmadır. Ayrıca El Niño ve La Niña iklim salınımları kıtada yıkıcı kuraklıklara veya fırtınalı sellere yol açar.",
      historicalAndCulturalTr:
        "Kıta, And Yaylaları'nda taş mimarisi ve teras tarımıyla yükselen İnka İmparatorluğu'nun beşiğidir. 1494 Tordesillas Antlaşması ile Papalık, keşfedilen yeni toprakları İspanya ve Portekiz arasında paylaştırmıştır. Bu meridyen çizgisi bugünün dil haritasını belirlemiştir: Doğuda kalan Brezilya Portekizceyi benimserken, kıtanın geri kalanı İspanyolca konuşan bir dünyaya dönüşmüştür.",
    },
    subregions: [
      {
        nameTr: "And Ülkeleri",
        nameEn: "Andean States",
        descriptionTr:
          "And Dağları omurgası, Altiplano maden havzaları, kadim İnka kültürü ve Pasifik kıyıları.",
        sampleCountriesTr: ["Peru", "Bolivya", "Kolombiya", "Ekvador", "Şili", "Venezuela"],
      },
      {
        nameTr: "Brezilya Kara Kütlesi",
        nameEn: "Brazil Landmass",
        descriptionTr:
          "Kıtanın neredeyse yarısını kaplayan Amazon ormanları, Cerrado tarımı ve Portekiz mirası.",
        sampleCountriesTr: ["Brezilya"],
      },
      {
        nameTr: "Güney Koni (Southern Cone)",
        nameEn: "Southern Cone",
        descriptionTr:
          "Pampa düzlükleri, Río de la Plata havzası, ılıman iklim ve Avrupa kökenli kentsel kültür.",
        sampleCountriesTr: ["Arjantin", "Şili", "Uruguay", "Paraguay"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Pasifik Ateş Çemberi Megathrust Depremleri (M≥8.5) ve Tsunami",
        "Buzul Kaplı And Volkanlarının Patlamaları ve Çamur Akıntıları (Lahar)",
        "Amazon Havzasında Geniş Çaplı Ormansızlaşma ve Biyoçeşitlilik Kaybı",
        "El Niño / La Niña Kaynaklı Şiddetli Kuraklık ve Sel Dalgaları",
      ],
      faultLinesOrZones: [
        "Peru-Şili Hendeği (Nazca - Güney Amerika Levha Dalma Zonu)",
        "Kuzey And Fay Sistemi",
        "Magallanes-Fagnano Fayı (Tierra del Fuego)",
      ],
      warningNoteTr:
        "Tarihin aletsel olarak ölçülmüş en büyük depremi (M=9.5, 1960 Valdivia) bu kıtanın batı kıyısında gerçekleşmiştir.",
    },
    faqs: [
      {
        question: "Atakama Çölü neden dünyanın en kurak yeridir?",
        answer:
          "Doğudaki 6.000 metrelik And Dağları Atlantik'ten gelen tüm nemli hava kütlelerini keserek devasa bir yağmur gölgesi yaratır; batıdaki soğuk Humboldt Akıntısı ise kıyı havasını soğutup konveksiyonu engeller. Bu çifte bariyer Atakama'yı neredeyse sıfır yağışlı bir çöle dönüştürür.",
      },
      {
        question: "Lityum Üçgeni nedir ve neden stratejiktir?",
        answer:
          "Şili, Bolivya ve Arjantin'in yüksek And platolarındaki tuz düzlüklerinin (salar) oluşturduğu üçgendir. Elektrikli araç bataryalarının hammaddesi olan küresel lityum rezervlerinin %50'den fazlası bu havzada bulunur.",
      },
      {
        question: "Brezilya neden İspanyolca değil Portekizce konuşur?",
        answer:
          "1494 yılında İspanya ve Portekiz arasında imzalanan Tordesillas Antlaşması ile dünya ikiye bölünmüş; bu meridyenin doğusunda kalan Güney Amerika burnu (bugünkü Brezilya) Portekiz egemenliğine bırakılmıştır.",
      },
      {
        question: "Amazon Nehri'nin debisi ne kadardır?",
        answer:
          "Amazon Nehri saniyede yaklaşık 209.000 metreküp su taşır. Bu miktar, kendisinden sonra gelen en büyük yedi nehrin toplam debisinden daha fazladır ve dünya okyanuslarına karışan toplam nehir suyunun yaklaşık beşte biridir.",
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
    taglineTr: "Ada dünyası, 40 milyon km² deniz yetki alanı ve iklim krizinin ön cephesi.",
    countryCount: 14,
    countryCountNoteTr: "14 bağımsız egemen ada devleti (Avustralya anakarası dahil).",
    population: 45000000,
    populationFormattedTr: "45 Milyon",
    populationSharePercent: 0.6,
    areaKm2: 8530000,
    areaFormattedTr: "8.530.000 km² (Kara)",
    areaSharePercent: 5.7,
    densityPerKm2: 5,
    highestPoint: {
      name: "Puncak Jaya (Carstensz) / Wilhelm Dağı",
      elevationM: 4509,
      locationTr:
        "Papua Yeni Gine (Wilhelm Dağı 4.509 m) — Avustralya anakarasında Kosciuszko 2.228 m",
    },
    lowestPoint: {
      name: "Eyre Gölü (Kati Thanda)",
      elevationM: -15,
      locationTr: "Güney Avustralya",
      noteTr: "Kurak mevsimde dev bir tuz tavasına dönüşen kapalı göl yatağı.",
    },
    longestRiver: {
      name: "Murray - Darling Nehir Sistemi",
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
      "Deniz Egemenliği: ~8,5M km² kara alanına karşılık ~40M km² Münhasır Ekonomik Bölge (EEZ)",
      "Büyük Set Resifi: Uzaydan görülebilen dünyanın en büyük yaşayan mercan ekosistemi",
      "Endemik Canlılar: Milyonlarca yıllık ada izolasyonunun mirası olan keseli fauna",
    ],
    prose: {
      introTr:
        "Okyanusya, diğer altı kıtadan niteliksel olarak ayrılır: Karaların sınırları belirlediği bir dünya değil, devasa Büyük Okyanus sularına saçılmış on binlerce adanın oluşturduğu bir 'su kıtası'dır. Kıtanın yaklaşık 8,5 milyon kilometrekarelik kara alanının %90'ını tek başına Avustralya anakarası oluştururken, ada devletlerinin sahip olduğu Münhasır Ekonomik Bölge (EEZ) deniz alanı 40 milyon kilometrekareyi —kara alanının neredeyse beş katını— aşar.",
      locationAndBordersTr:
        "Kıta, Büyük Okyanus'un güney ve orta kesimlerinde binlerce kilometrelik bir alana yayılmıştır. Batıda Hint Okyanusu, kuzeyde ve doğuda Büyük Okyanus ile kuşatılmıştır. En batıdaki Papua Yeni Gine adası ilginç bir coğrafi bölünmeye sahiptir: Adanın doğu yarısı bağımsız Papua Yeni Gine olarak Okyanusya'dayken, batı yarısı (Batı Papua) Endonezya toprağı olarak Asya kıtasında değerlendirilir. Bu durum, tek bir adanın iki ayrı kıtaya bölünmüş ender örneklerindendir.",
      landformsAndGeologyTr:
        "Okyanusya iki zıt jeolojik karakter barındırır. Avustralya anakarası, yeryüzünün en yaşlı, en düz ve aşınmış kıtasal kalkanlarından biridir; ortalama yükseltisi düşüktür ve doğusundaki Büyük Su Ayırıcı Sıradağlar (Great Dividing Range) haricinde belirgin bir genç dağa sahip değildir.\n\nBuna karşılık Yeni Zelanda, Papua Yeni Gine ve çevre ada yayları Pasifik Ateş Çemberi üzerindeki genç levha sınırlarında yükselmiştir. Yeni Zelanda'daki Güney Alpleri buzulları ve aktif volkanları barındırırken; Melanezya, Mikronezya ve Polinezya adaları ya volkanik dağ zirveleri ya da denizaltı yanardağlarının üzerinde mercan poliplerinin inşa ettiği alçak atollerden oluşur.",
      climateAndVegetationTr:
        "Avustralya anakarasının üçte ikisi kurak ve yarı kuraktır; iç kesimlerdeki uçsuz bucaksız çöl ve çalılık alanlar 'Outback' olarak adlandırılır. Kıtanın güneydoğu ve güneybatı uçları ılıman Akdeniz ve okyanusal iklime sahiptir. Yeni Zelanda yıl boyu yağışlı, ılıman denizel bir iklim sunar.\n\nPasifik adaları ise yıl boyu alizelerin getirdiği nemle beslenen tropikal denizel iklime sahiptir. Kıtanın diğer kıtalardan erken jeolojik dönemde (Gondwana'nın parçalanması) ayrılıp izole olması, kanguru, koala, ornitorenk ve kivi kuşu gibi plasentasız keseli ve tek delikli canlıların evrilip bugüne ulaşmasını sağlamıştır.",
      hydrographyTr:
        "Okyanusya'nın en büyük akarsu ağı, Avustralya'nın güneydoğusundaki Murray-Darling Havzası'dır. Kıtanın tarımsal üretiminin can damarı olan bu sistem, kurak dönemlerde ciddi su çekilmesi yaşar. İç kesimlerdeki akarsuların çoğu kurak mevsimde kuruyan mevsimlik derelerdir (creek).\n\nKıtanın en görkemli su yapısı, Avustralya'nın kuzeydoğu kıyısında 2.300 kilometre boyunca uzanan Büyük Set Resifi'dir (Great Barrier Reef). Binlerce ayrı resif ve adadan oluşan bu yapı, canlı organizmaların inşa ettiği dünyanın en büyük ekosistemidir. Küçük mercan ada devletlerinde ise akarsu bulunmaz; tatlı su tamamen yağmur suyu sarnıçları ve kırılgan yeraltı tatlı su lenslerinden (Ghyben-Herzberg) elde edilir.",
      populationAndSettlementTr:
        "Nüfus olağanüstü derecede dengesiz ve kentsel odaklıdır. Avustralya nüfusunun %85'inden fazlası anakaranın doğu ve güneydoğu kıyılarındaki birkaç büyükşehirde (Sidney, Melbourne, Brisbane, Perth) yaşar; iç kesimler neredeyse boştur.\n\nPasifik adalarında ise yerleşimler küçük ada köylerinde ve sahil kasabalarında dağınık topluluklar halinde varlığını sürdürür. Tuvalu ve Nauru gibi ada devletlerinin toplam nüfusu yalnızca 10-12 bin kişidir.",
      economyAndResourcesTr:
        "Avustralya dünyanın en büyük maden ihracatçılarındandır; demir cevheri, kömür, boksit, altın, lityum ve sıvılaştırılmış doğalgaz (LNG) sevkiyatında küresel pazarları yönetir. Yeni Zelanda mandıracılık, et ve kivi ihracatında uzmanlaşmıştır.\n\nKüçük Pasifik ada devletlerinin ekonomisi ise devasa Münhasır Ekonomik Bölgelerindeki orkinos balıkçılığı lisanslarına, turizme, hindistancevizi (kopra) üretimine ve yurtdışında yaşayan diasporanın gönderdiği işçi dövizlerine bağımlıdır.",
      subregionsIntroTr:
        "BM M49 standardı Okyanusya'yı 4 alt bölgeye ayırır: Avustralya ve Yeni Zelanda, Melanezya ('Siyah Adalar'), Mikronezya ('Küçük Adalar') ve Polinezya ('Çok Adalar').",
      disasterAndEnvironmentTr:
        "Okyanusya, küresel iklim krizinin ve deniz seviyesi yükselmesinin en acil tehdit oluşturduğu ön cephedir. Tuvalu, Kiribati ve Marşal Adaları gibi ortalama rakımı deniz seviyesinden sadece 1-2 metre yüksek olan atol ülkeleri, yükselen dalgalar, kıyı erozyonu ve yeraltı tatlı sularının tuzlanması nedeniyle topraklarını kaybetme ve haritadan silinme riskiyle yüz yüzedir.\n\nAvustralya'da ise aşırı sıcak dalgaları ve aylarca süren yıkıcı çalı yangınları (bushfires) ile okyanus suyunun ısınmasına bağlı Büyük Set Resifi mercan beyazlaması en büyük ekolojik felaketlerdir.",
      historicalAndCulturalTr:
        "Avustralya Aborjinleri yaklaşık 50.000 yılı aşan geçmişleriyle yeryüzünün yaşayan en eski kesintisiz kültürünü temsil eder. Polinezyalı denizciler ise pusula olmaksızın sadece yıldızları, okyanus akıntılarını ve kuş uçuşlarını okuyarak kano ve katamaranlarla devasa Pasifik'i aşmış ve Hawaii'den Yeni Zelanda'ya (Maoriler) kadar adaları iskân etmiştir. 18. yüzyıldan itibaren İngiliz kolonizasyonu başlamıştır.",
    },
    subregions: [
      {
        nameTr: "Avustralya ve Yeni Zelanda",
        nameEn: "Australia and New Zealand",
        descriptionTr:
          "Gelişmiş piyasa ekonomileri, devasa maden kaynakları, modern metropoller ve ılıman iklim.",
        sampleCountriesTr: ["Avustralya", "Yeni Zelanda"],
      },
      {
        nameTr: "Melanezya",
        nameEn: "Melanesia",
        descriptionTr:
          "Yeni Gine'den Fiji'ye uzanan büyük dağlık ve volkanik adalar; zengin kültürel ve dilsel çeşitlilik.",
        sampleCountriesTr: ["Papua Yeni Gine", "Fiji", "Solomon Adaları", "Vanuatu"],
      },
      {
        nameTr: "Mikronezya",
        nameEn: "Micronesia",
        descriptionTr:
          "Ekvatorun kuzeyinde binlerce küçük mercan adası ve atol; geniş balıkçılık yetki alanları.",
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
          "Yeni Zelanda, Hawaii ve Paskalya Adası üçgeninde yer alan açık deniz ada dünyası.",
        sampleCountriesTr: ["Samoa", "Tonga", "Tuvalu"],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Küresel Isınma ve Deniz Seviyesi Yükselmesi (Atol Ülkeleri İçin Varoluşsal Tehdit)",
        "Büyük Okyanus Tropikal Siklonları ve Fırtına Kabarmaları",
        "Avustralya Kuraklığı, Aşırı Sıcak Dalgaları ve Çalı Yangınları",
        "Yeni Zelanda ve Melanezya Sismik ve Volkanik Etkinliği",
      ],
      faultLinesOrZones: [
        "Alp Fayı (Yeni Zelanda Güney Adası)",
        "Kermadec-Tonga Hendeği Dalma-Batma Zonu",
        "Yeni Hebridler Hendeği (Vanuatu)",
      ],
      warningNoteTr:
        "Tuvalu ve Kiribati gibi alçak mercan adaları, deniz seviyesinin yükselmesi nedeniyle 21. yüzyıl içinde tamamen sular altında kalma tehlikesiyle karşı karşıyadır.",
    },
    faqs: [
      {
        question: "Avustralya bir kıta mıdır yoksa ada mıdır?",
        answer:
          "Avustralya kendi tektonik levhasına (Avustralya Levhası) sahip devasa bir kara kütlesi olduğu için ada değil, dünyanın en küçük kıtası olarak kabul edilir. Çevreleyen ada ülkeleriyle birlikte oluşturduğu bölgesel yapıya Okyanusya denir.",
      },
      {
        question: "Tuvalu ve Kiribati neden iklim mültecisi riskiyle karşı karşıyadır?",
        answer:
          "Bu ülkeler mercan atollerinden oluşur ve en yüksek noktaları deniz seviyesinden sadece 2-3 metre yüksektedir. Deniz seviyesinin yükselmesi, kıyı erozyonu ve fırtına kabarmaları yerleşim alanlarını yok etmekte, tarım arazilerini ve içme suyunu tuzlandırmaktadır.",
      },
      {
        question: "Büyük Set Resifi uzaydan görülebilir mi?",
        answer:
          "Evet; 2.300 kilometre uzunluğundaki Büyük Set Resifi, canlı organizmaların oluşturduğu yeryüzündeki en büyük tekil yapıdır ve uzaydan çıplak gözle seçilebilir.",
      },
      {
        question: "Papua Yeni Gine neden iki kıtaya bölünmüştür?",
        answer:
          "Yeni Gine adasının doğu yarısı bağımsız Papua Yeni Gine devleti olarak Okyanusya kıtasına dahildir; batı yarısı ise sömürge dönemi sınırları gereği Endonezya'ya bağlıdır ve siyasi coğrafyada Asya'da sayılır.",
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
    taglineTr: "Kutup çölü, yeryüzünün en büyük tatlı su buz kalkanı ve barışa adanmış kıta.",
    countryCount: 0,
    countryCountNoteTr:
      "Egemen devlet yoktur; 1959 Antarktika Antlaşması ile uluslararası barış ve bilime ayrılmıştır.",
    population: 0,
    populationFormattedTr: "Kalıcı Nüfus Yok (1.000–5.000 Bilim İnsanı)",
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
      name: "Onyx Nehri (Mevsimlik Erime Deresi)",
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
      "Buz Kalkanı: Dünyadaki buzun %90'ını ve tatlı suyun %70'ini barındırır",
      "Kutup Çölü: Yıllık yağışın Sahra'dan bile az olduğu yeryüzünün en kurak ve soğuk kıtası",
      "Uluslararası Yönetişim: Askeri faaliyetlerin yasaklandığı tarafsız bilim bölgesi",
    ],
    prose: {
      introTr:
        "Antarktika, yeryüzünün en soğuk, en kuru, en rüzgarlı ve ortalama yükseltisi en yüksek (yaklaşık 2.200 m) kıtasıdır. Üzerini kaplayan devasa buz kalkanı, yeryüzündeki tüm buz kütlesinin yaklaşık %90'ını ve mevcut tatlı su rezervlerinin %70'ini bünyesinde barındırır. Hiçbir yerli halka ve egemen devlete sahip olmayan kıta, 1959 Antarktika Antlaşması ile askeri faaliyetlerden arındırılmış, yalnızca barışçıl bilimsel araştırmalara adanmış uluslararası tek kara kütlesidir.",
      locationAndBordersTr:
        "Güney Kutup Noktası'nı merkezine alan Antarktika, 60° güney enlem paralelinin güneyindeki tüm alanı kapsar. Çevresi bütünüyle Güney Okyanusu'nun fırtınalı sularıyla kuşatılmıştır. En yakın kara kütlesi, yaklaşık 1.000 kilometre kuzeyde Drake Boğazı'nın ötesinde uzanan Güney Amerika'nın Ateş Toprakları'dır (Tierra del Fuego).",
      landformsAndGeologyTr:
        "Kıta, Transantarktik Dağları ile iki ana jeolojik bölgeye ayrılır: Doğu Antarktika ve Batı Antarktika. Doğu Antarktika, Prekambriyen yaşlı son derece kalın ve durağan bir kıtasal kalkandır. Üzerindeki buz örtüsünün ortalama kalınlığı 2.000 metreyi, en kalın yerinde ise 4.800 metreyi aşar.\n\nBatı Antarktika ise And Dağları'nın bir uzantısı niteliğindeki dağ sıralarını ve aktif volkanları (örneğin Ross Adası'ndaki Erebus Dağı) barındırır. Vinson Masifi (4.892 m) kıtanın en yüksek zirvesidir. Buz kalkanının altında ise Bentley Buzul-altı Çukuru (-2.540 m) gibi derin kara vadileri gizlidir.",
      climateAndVegetationTr:
        "Antarktika teknik olarak dünyanın en büyük çölüdür. İç kesimlere düşen yıllık yağış miktarı 50 milimetrenin altındadır; bu oran Sahra Çölü'nün pek çok yerinden daha düşüktür. 21 Temmuz 1983'te Sovyet Vostok İstasyonu'nda ölçülen -89,2°C, yeryüzünde ölçülmüş en düşük doğal sıcaklık rekorudur.\n\nİç platolardan kıyılara doğru yerçekimi etkisiyle esen katabatik fırtına rüzgarları saatte 300 kilometre hıza ulaşabilir. Kara bitki örtüsü yalnızca Antarktika Yarımadası'nın yazın kardan arınan kayalıklarında tutunabilen iki çiçekli bitki türü, yosunlar ve likenlerle sınırlıdır. Buna karşılık kıyıyı çevreleyen denizler kril ve plankton zenginliği sayesinde balinalar, foklar ve imparator penguenleri için eşsiz bir besin alanıdır.",
      hydrographyTr:
        "Sıvı yüzey akarsuyu neredeyse hiç yoktur; en uzunu yaz aylarında birkaç hafta akan 32 kilometrelik Onyx Deresi'dir. Ancak kıtanın derinliklerinde, binlerce metre kalınlığındaki buzun basıncı ve alttan gelen jeotermal ısı sayesinde sıvı halde kalan 400'den fazla buzul-altı göl keşfedilmiştir.\n\nBunların en büyüğü olan Vostok Gölü, yaklaşık 15 milyon yıldır dış atmosferle teması kesilmiş izole bir tatlı su kütlesidir. Kıyı şeridinde ise deniz üzerinde yüzen Ross ve Ronne gibi devasa buz sahanlıkları (ice shelf) yer alır.",
      populationAndSettlementTr:
        "Kıtada kalıcı yerli nüfus bulunmamaktadır. İnsan varlığı yalnızca Antarktika Antlaşması'na taraf ülkelerin işlettiği yaklaşık 70 aktif bilimsel araştırma istasyonundaki araştırmacılar ve teknik personelden oluşur.\n\nYaz aylarında nüfus 4.000–5.000 kişiye ulaşırken, karanlık kutup kışında bu sayı 1.000 kişinin altına düşer. Türkiye de 2017'den bu yana her yıl düzenlenen Ulusal Antarktika Bilim Seferleri ile Horseshoe Adası'nda geçici bilim kampı işletmektedir.",
      economyAndResourcesTr:
        "Antarktika'da ticari madencilik, petrol arama veya askeri amaçlı iktisadi faaliyet yürütülmesi 1991 Madrid Çevre Koruma Protokolü ile süresiz olarak yasaklanmıştır. Buz kalkanının altında zengin kömür, demir ve hidrokarbon rezervlerinin bulunduğu bilinmektedir ancak bunlar insanlığın ortak mirası olarak korunmaktadır.\n\nYegane ticari faaliyet, çevre kuralları çerçevesinde yaz aylarında Antarktika Yarımadası'na düzenlenen kruvaziyer kutup turizmi ve Güney Okyanusu'ndaki denetimli kril/patagonya dişbalığı avcılığıdır.",
      subregionsIntroTr:
        "Antarktika üç ana coğrafi kesime ayrılır: Doğu Antarktika Buz Kalkanı, Batı Antarktika ve Güney Amerika'ya doğru uzanan Antarktika Yarımadası.",
      disasterAndEnvironmentTr:
        "Antarktika küresel iklim sisteminin termostatıdır. Devasa beyaz buz örtüsü gelen güneş ışınlarını yansıtarak (albedo etkisi) gezegenin aşırı ısınmasını engeller. Eğer Antarktika buz kalkanı bütünüyle erirse, küresel deniz seviyesi yaklaşık 58 metre yükselecektir.\n\nÖzellikle Batı Antarktika'daki Thwaites Buzulu ('Kıyamet Buzulu') gibi denizle temas eden buzul sahanlıklarının dipten ısınan okyanus akıntılarıyla erimesi ve parçalanması, 21. yüzyılın en kritik küresel deniz seviyesi tehdididir. Ayrıca 1980'lerde kutup üzerinde keşfedilen ozon deliği, çevre protokolleri sayesinde toparlanma sürecindedir.",
      historicalAndCulturalTr:
        "1820'lerde ilk kez gözlemlenen kıta, 20. yüzyılın başlarında 'Kutup Kahramanlık Çağı'na sahne olmuştur. 1911'de Roald Amundsen ve Robert Falcon Scott Güney Kutbu'na ilk ulaşan kâşifler olmuştur. 1 Aralık 1959'da imzalanan Antarktika Antlaşması, yedi ülkenin (İngiltere, Fransa, Şili, Arjantin, Avustralya, Norveç, Yeni Zelanda) toprak iddialarını dondurmuş ve kıtayı sadece bilime ve barışa vakfetmiştir.",
    },
    subregions: [
      {
        nameTr: "Doğu Antarktika",
        nameEn: "East Antarctica",
        descriptionTr:
          "Prekambriyen kalkanı, dünyanın en kalın buz tabakası (-89°C Vostok istasyonu) ve Güney Kutup Noktası.",
        sampleCountriesTr: ["Uluslararası İstasyonlar (McMurdo, Vostok, Amundsen-Scott)"],
      },
      {
        nameTr: "Batı Antarktika",
        nameEn: "West Antarctica",
        descriptionTr:
          "Deniz seviyesinin altındaki kayaç yatakları, kırılgan buz sahanlıkları ve aktif volkanizma.",
        sampleCountriesTr: ["Uluslararası İstasyonlar"],
      },
      {
        nameTr: "Antarktika Yarımadası",
        nameEn: "Antarctic Peninsula",
        descriptionTr:
          "Güney Amerika'ya uzanan en ılıman kesim; yazın kardan arınan kıyılar, penguen kolonileri ve bilim üsleri.",
        sampleCountriesTr: [
          "Uluslararası İstasyonlar (Türkiye Geçici Bilim Kampı - Horseshoe Adası)",
        ],
      },
    ],
    disasterProfile: {
      primaryRisks: [
        "Küresel Isınma Kaynaklı Buz Sahanlığı Çöküşleri ve Deniz Seviyesi Yükselmesi",
        "Erebus Dağı Aktif Volkanizması ve Buzul Altı Erime Riskleri",
        "Katabatik Fırtınalar ve Ekstrem Kutup Soğukları (-80°C Altı)",
      ],
      faultLinesOrZones: [
        "Batı Antarktika Rift Sistemi",
        "Scotia Plakası Sınırı (Antarktika Yarımadası Kuzeyi)",
      ],
      warningNoteTr:
        "Batı Antarktika'daki Thwaites ve Pine Island buzullarının dengesizleşmesi, tek başına küresel deniz seviyesini onlarca santimetre yükseltebilecek potansiyele sahiptir.",
    },
    faqs: [
      {
        question: "Antarktika kime aittir?",
        answer:
          "Antarktika hiçbir devlete ait değildir. 1959 yılında imzalanan Antarktika Antlaşması, geçmişteki tüm egemenlik iddialarını dondurmuş ve kıtayı tüm insanlığın yararına, yalnızca barışçıl ve bilimsel amaçlara tahsis etmiştir.",
      },
      {
        question: "Antarktika neden dünyanın en kurak çölüdür?",
        answer:
          "Havanın aşırı soğuk olması, atmosferin su buharı tutma kapasitesini neredeyse sıfıra indirir. İç kesimlerdeki yüksek basınç alanı bulut oluşumunu engeller; bu nedenle iç platolara yılda 50 mm'den daha az kar yağar.",
      },
      {
        question: "Antarktika'daki tüm buzlar erirse ne olur?",
        answer:
          "Antarktika buz kalkanının tamamen erimesi durumunda, dünya okyanuslarının su seviyesi yaklaşık 58 metre (190 fit) yükselecek ve dünyadaki tüm kıyı metropolleri tamamen sular altında kalacaktır.",
      },
      {
        question: "Türkiye'nin Antarktika'da üssü var mı?",
        answer:
          "Türkiye, Cumhurbaşkanlığı himayelerinde ve Sanayi ve Teknoloji Bakanlığı uhdesinde, TÜBİTAK MAM Kutup Araştırmaları Enstitüsü (KARE) koordinasyonunda her yıl Ulusal Antarktika Bilim Seferleri düzenlemekte ve Horseshoe Adası'nda geçici Türk Bilim Kampı işletmektedir.",
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
