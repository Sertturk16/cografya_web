export interface PreparednessSubSection {
  title: string;
  summary: string;
  content: string;
  actionPoints?: string[];
  callout?: string;
}

export interface PreparednessPhase {
  id: "before" | "during" | "after";
  title: string;
  summary: string;
  subSections: PreparednessSubSection[];
}

export const PREPAREDNESS_DATA: PreparednessPhase[] = [
  {
    id: "before",
    title: "Deprem Öncesi: Evini ve Aileni Hazırla",
    summary:
      "Depremde insanları yaralayan yalnızca yıkılan binalar değildir: yaralanmaların yaklaşık yarısı devrilen dolaplardan, kırılan camlardan ve savrulan eşyalardan kaynaklanır. Bunlara karşı evini deprem gelmeden hazırlayabilirsin.",
    subSections: [
      {
        title: "Ağır Eşyaları Duvara Sabitle",
        summary: "Dolap, kitaplık ve beyaz eşya sarsıntıda devrilmesin.",
        content:
          "Evde ve iş yerinde gardırop, kitaplık, vitrin ve buzdolabı gibi ağır eşyaları mutlaka L-braket ya da çelik açılı vidalarla doğrudan taşıyıcı duvara sabitle. Vida alçıpanda kalmamalı, arkasındaki betona ya da tuğlaya ulaşmalı. Yatağının hemen yanına ya da başucuna ağır çerçeve, ayna ve düşebilecek cam eşya koyma. Dolap kapaklarına, sarsıntıda açılmalarını önleyen çocuk kilidi tak.",
        actionPoints: [
          "Ağır ve kırılabilir eşyaları dolabın en alt raflarına koy.",
          "Tavan lambalarını ve avizeleri sağlam dübellerle tavana sabitle.",
          "Kombiyi, su ısıtıcısını ve gaz tüplerini esnek çelik hortumla bağlayıp duvara sabitle.",
        ],
      },
      {
        title: "Bir Afet Çantası Hazırla",
        summary: "İlk 72 saat sana yetecek su, yiyecek ve malzeme.",
        content:
          "Depremden sonra arama kurtarma ve yardım ekiplerinin bölgenin her yerine ulaşması 72 saati bulabilir. Bu sürede ailenin kimseye muhtaç kalmadan idare edebilmesi için çanta hazır olsun ve çıkış kapısına yakın bir yerde dursun. Çantayı taşıyamayacağın kadar ağırlaştırma; sırtta taşınan, rahat bir çanta seç.",
        actionPoints: [
          "Üç günlük şişe içme suyu: kişi başına günde en az 2,5 litre.",
          "Bozulmayan, enerjisi yüksek yiyecekler: konserve, fındık, ceviz, kuru gıda.",
          "Düdük, pilli el feneri ve yedek pil. Enkaz altında kalırsan düdük, sesini en az güçle duyurmanı sağlar.",
          "Reçeteli ilaçların, ilk yardım çantası, hijyenik ped ve ıslak mendil.",
          "Kimlik, tapu, sigorta poliçesi gibi belgelerin fotokopileri, su geçirmez bir poşette.",
        ],
        callout:
          "Çantadaki yiyecek, su ve ilaçların son kullanma tarihine altı ayda bir mutlaka bak, eskiyenleri yenile. Bunu ailecek yaptığın deprem tatbikatıyla aynı güne koyarsan unutmazsın.",
      },
      {
        title: "Ailenle Bir Buluşma Planı Yap",
        summary: "Telefonlar çalışmazsa ailenle nerede buluşacağını önceden bil.",
        content:
          "Deprem anında cep telefonu şebekeleri aşırı yüklenir ve tıkanır. Ailenle nerede buluşacağını önceden kararlaştırmak paniği ve karmaşayı önler. AFAD her mahalle için bir acil toplanma alanı belirlemiştir. Seninkini e-Devlet'ten öğren, sonra ailenle birlikte gidip yerinde gör. Şehir dışında yaşayan bir akrabanı herkesin haber vereceği ortak kişi olarak seç; şehir içindeki hatlar kesilse bile herkes haberini ona ulaştırabilir.",
      },
      {
        title: "Binanı Kontrol Ettir, Evini Sigortalat",
        summary: "Kolonlar ve kirişler sağlam mı, zorunlu deprem sigortası (DASK) var mı?",
        content:
          "Binanın zemin katında dükkân ya da otopark açmak için kolon kesilip kesilmediğini kontrol et. Bodrumdaki nem ve paslanma izlerine bir inşaat mühendisi baksın. Bina 2000 yılından önce yapıldıysa depreme dayanıklılığını ölçen bir performans analizi yaptır. Evini Doğal Afet Sigortaları Kurumu (DASK) güvencesine al.",
      },
    ],
  },
  {
    id: "during",
    title: "Deprem Anında: Olduğun Yerde Kendini Koru",
    summary:
      "Sarsıntı sürerken kaçmaya çalışmak düşme, merdivenden yuvarlanma ve üstüne moloz düşmesi riskini çok artırır.",
    subSections: [
      {
        title: "Çök, Kapan, Tutun",
        summary: "Yere yakın dur, başını koru, sabit bir şeye tutun.",
        content:
          "Sarsıntıda ayakta durmaya çalışma; güçlü bir sarsıntı insanı kolayca savurabilir. Hemen sağlam bir masa, baza ya da koltuğun yanına geç ve yere ÇÖK. Bir elinle başını ve enseni KAPAN, öbür elinle o sabit eşyaya TUTUN.",
        callout:
          "Eskiden yaygın bir inanıştı ama kapı pervazının altına sığınma. Bugünkü binalarda kapı kasası yük taşımaz; sarsıntıda çabucak eğilip sıkışabilir ya da üstüne yıkılabilir.",
      },
      {
        title: "Sarsıntı Sırasında Asla Yapma",
        summary: "Merdiven, asansör ve balkon binanın en dayanıksız yerleridir.",
        content:
          "Binanın en zayıf yeri merdiven boşluklarıdır; sarsıntıda ilk kırılan ve çöken yerler merdiven sahanlıklarıdır. Asansör, halatı koparsa ya da elektrik kesilirse boşluğa düşebilir veya iki kat arasında kalabilir. Balkondan atlamak ağır yaralanmayla ya da ölümle sonuçlanır. Deprem araştırmaları, yaralanmaların önemli bir bölümünün sarsıntı sürerken yerinden kalkıp hareket eden insanlarda, çoğunlukla düşme ve tökezleme yüzünden olduğunu gösteriyor. Sarsıntı tamamen durana kadar olduğun güvenli yerde kal.",
        actionPoints: [
          "Merdivenlere ve yangın merdivenlerine asla koşma.",
          "Asansörü kesinlikle kullanma. Asansördeysen en yakın katın düğmesine bas ve hemen kabinden çık.",
          "Pencerelerden, cam cephelerden ve asma tavanlardan uzak dur.",
        ],
      },
      {
        title: "Evde Değilsen",
        summary: "Okulda, arabada, açık alanda ya da kalabalık bir yerde yakalanırsan.",
        content: "Ne yapman gerektiği, sarsıntıya nerede yakalandığına göre değişir.",
        actionPoints: [
          "Okulda, sınıftaysan: sıraların arasında, başını çantanla ya da ellerinle koruyarak sıranın yanına çök.",
          "Yol alan bir araçtaysan: sakince sağ şeride yanaş. Köprü, viyadük, alt geçit ve elektrik iletim hatlarından uzakta kontağı kapat ve aracın içinde bekle.",
          "Açık alandaysan: bina cephelerinden, camlardan, falezlerden, heyelan yamaçlarından ve elektrik direklerinden uzaklaş ve çömel.",
          "AVM'de ya da metro istasyonundaysan: panikle çıkış kapılarına koşma. Vitrinlerden uzaklaş, sağlam bir kolonun dibinde çök, kapan, tutun.",
        ],
      },
    ],
  },
  {
    id: "after",
    title: "Deprem Sonrası: Binadan Çıkış ve İlk 72 Saat",
    summary:
      "Sarsıntı durunca tehlike bitmiş sayılmaz. Gaz kaçağından çıkan yangınlar, kırık camlar ve güçlü artçı sarsıntılar hâlâ tehlikelidir.",
    subSections: [
      {
        title: "İlk Dakikalar: Gazı, Elektriği ve Suyu Kapat",
        summary: "Yangın ya da patlama çıkmasın diye vanaları ve şalteri kapat.",
        content:
          "Sarsıntı durur durmaz sakin ol ve yanındakilerin durumuna bak. Gaz kokusu olmasa bile ocakları söndür; ana doğal gaz vanasını, elektrik panosundaki ana şalteri ve su sayacının vanasını kapat. Kibrit, çakmak ya da mum asla yakma; telefonunun fenerini ya da pilli bir el feneri kullan. Gaz kaçağı varsa elektrik düğmelerini kesinlikle açıp kapatma; çıkan kıvılcım patlamaya yol açabilir.",
      },
      {
        title: "Binadan Çık, Toplanma Alanına Yürü",
        summary: "Ayakkabını giy, çantanı al, merdivenleri koşmadan in.",
        content:
          "Kırık camlara ve dökülen sıvalara basmamak için sağlam tabanlı ayakkabılarını giy. Hazırladığın afet çantasını sırtına al; merdivenleri koşmadan, tırabzana tutunarak in. Binadan çıkınca cephelerden hemen uzaklaş ve sokak aralarında bekleme. Daha önce e-Devlet'ten öğrendiğin mahalle toplanma alanına yürüyerek git.",
      },
      {
        title: "Telefonla Değil, Mesajla Haber Ver",
        summary: "Hatları yardım bekleyenlere bırak.",
        content:
          'Afet bölgesinde herkes aynı anda sesli arama yapmaya çalışınca baz istasyonları çöker ve enkaz altında yardım bekleyenler 112\'ye ulaşamaz. Durumunu, önceden seçtiğin şehir dışındaki kişiye ve yakınlarına kısa mesajla ya da bir mesajlaşma uygulamasıyla tek seferde bildir: "İyiyim." Telefon hatlarını hayati acil durumlar için boş bırak.',
      },
      {
        title: "Artçılar Sürerken Hasarlı Binaya Girme",
        summary: "Büyük depremin ardından artçılar haftalarca sürebilir.",
        content:
          'Büyük bir depremden sonra fay üzerindeki gerilim yeniden dengelenene kadar yüzlerce artçı sarsıntı olur. Ana depremde hafif hasar görmüş bir kolon ya da kiriş, küçük bir artçıda bile tamamen çökebilir. Çevre, Şehircilik ve İklim Değişikliği Bakanlığı\'nın denetim ekipleri "hasarsız" raporu vermedikçe, eşya almak ya da dinlenmek için bile hasarlı bir binaya kesinlikle girme.',
      },
    ],
  },
];
