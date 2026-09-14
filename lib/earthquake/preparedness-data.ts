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
  badge: string;
  badgeVariant: "primary" | "secondary" | "info" | "warning";
  summary: string;
  subSections: PreparednessSubSection[];
}

export const PREPAREDNESS_DATA: PreparednessPhase[] = [
  {
    id: "before",
    title: "Deprem Öncesi: Yaşam Alanlarında Yapısal Olmayan Önlemler ve Hazırlık",
    badge: "Önleyici Tedbirler",
    badgeVariant: "primary",
    summary:
      "Depremlerdeki yaralanmaların ve ölümlerin yaklaşık yüzde ellisi binanın tamamen çökmesinden değil, devrilen ağır mobilyalardan, kırılan camlardan ve kontrolsüzce savrulan eşyalardan kaynaklanır. Yaşam alanını güvenli kılmak, sarsıntı anında hayat kurtaran ilk ve en etkili adımdır.",
    subSections: [
      {
        title: "Yaşam Alanının İncelenmesi ve Ağır Eşyaların Sabitlenmesi",
        summary: "Dolap, kitaplık ve beyaz eşyaların duvara doğru teknikle kilitlenmesi.",
        content:
          "Ev ve iş yerlerinde gardırop, kitaplık, vitrin ve buzdolabı gibi kütleli eşyaların mutlaka L-braketler veya çelik açılı vidalar ile doğrudan taşıyıcı duvara sabitlenmesi gerekir. Sabitleme yapılırken alçıpan yüzeylere değil, arkasındaki beton veya tuğla donatıya ulaşılmalıdır. Yatakların hemen yanında veya başucunda ağır çerçeveler, aynalar ve düşebilecek cam eşyalar bulundurulmamalı; dolap kapaklarına sarsıntıda açılmayı önleyen çocuk kilitleri takılmalıdır.",
        actionPoints: [
          "Ağır ve kırılabilir eşyaları dolapların en alt raflarına yerleştirin.",
          "Tavan aydınlatmalarını ve avizeleri sağlam dübellerle tavana sabitleyin.",
          "Kombi, su ısıtıcısı ve gaz tüplerini esnek çelik hortumlarla duvara monte edin.",
        ],
      },
      {
        title: "Afet ve Acil Durum Çantasının Bilimsel Standartlara Göre Hazırlanması",
        summary: "İlk 72 saatlik hayatta kalma ihtiyaçlarını karşılayan acil durum kiti.",
        content:
          "Deprem sonrasında profesyonel arama kurtarma ve insani yardım ekiplerinin bölgeye tam erişimi ilk 72 saati ('altın saatler') bulabilir. Bu sürede ailenin dışa bağımlı olmadan hayatta kalabilmesi için afet çantası hazır ve çıkış kapısına yakın bir noktada bulunmalıdır. Çanta hazırlanırken en kritik hata çok ağır eşyalarla taşınamaz hale getirilmesidir; ergonomik ve sırt tipi bir çanta tercih edilmelidir.",
        actionPoints: [
          "Kişi başına günlük en az 2.5 litre olmak üzere 3 günlük ambalajlı içme suyu.",
          "Yüksek kalorili, bozulmayan konserve, fındık/ceviz ve kuru gıdalar.",
          "Düdük, pilli el feneri ve yedek piller (enkaz altında en az enerjiyle ses duyurmak için düdük hayati öneme sahiptir).",
          "Kişisel reçeteli ilaçlar, ilk yardım kiti, hijyenik ped ve ıslak mendil.",
          "Nüfus cüzdanı, tapu, sigorta poliçesi gibi evrakların su geçirmez poşetteki fotokopileri.",
        ],
        callout:
          "Çantadaki gıda ve suların son kullanma tarihlerini yılda iki kez (yaz-kış saat geçişlerinde veya afet tatbikatlarında) mutlaka güncelleyin.",
      },
      {
        title: "Aile Afet ve Tahliye Planı: e-Devlet Toplanma Alanları",
        summary: "Sarsıntı anında paniklememek ve aile bireyleriyle buluşabilmek için ortak plan.",
        content:
          "Deprem anında cep telefonu şebekeleri aşırı yüklenme nedeniyle kilitlenir. Aile bireylerinin afet anında nerede buluşacağını önceden belirlemesi panik ve kargaşayı önler. T.C. İçişleri Bakanlığı AFAD tarafından her mahalle için belirlenen 'Acil Toplanma Alanı' e-Devlet üzerinden sorgulanmalı ve tüm aile fertleri tarafından yerinde görülerek öğrenilmelidir. Şehir dışından bir akrabanın 'ortak irtibat kişisi' olarak seçilmesi, şehir içi hatlar koptuğunda haberleşmeyi mümkün kılar.",
      },
      {
        title: "Bina Güvenliği ve Zorunlu Deprem Sigortası (DASK)",
        summary: "Taşıyıcı kolon-kiriş bütünlüğü ve yasal finansal güvence.",
        content:
          "Binaların zemin katlarında dükkân veya otopark açmak amacıyla kolon kesilip kesilmediği kontrol edilmeli, bodrum katlardaki nem ve korozyon izleri uzman inşaat mühendislerince denetlenmelidir. 2000 yılı öncesi yapılarda deprem performans analizi yaptırılmalı; tüm konutlar Doğal Afet Sigortaları Kurumu (DASK) güvencesine alınmalıdır.",
      },
    ],
  },
  {
    id: "during",
    title: "Deprem Anında: Mekâna Göre Doğru Davranış Kalıpları",
    badge: "Sarsıntı Esnası",
    badgeVariant: "secondary",
    summary:
      "Sarsıntı başladığında ilk 5-10 saniye hayatta kalma refleksinin en kritik evresidir. Deprem anında kaçmaya çalışmak düşme, merdivenden yuvarlanma ve üzerinize moloz düşme riskini katbekat artırır.",
    subSections: [
      {
        title: "'Çök - Kapan - Tutun' Tekniğinin Biyomekanik ve Fiziksel Mantığı",
        summary: "Ağırlık merkezini düşürerek hayati organları ve başı koruma pozisyonu.",
        content:
          "Sarsıntı anında ayakta durmaya çalışmak ölümcül bir yanılgıdır. Şiddetli yer ivmesi insanı kolaylıkla fırlatabilir. Bu nedenle derhal yere ÇÖKÜLMELİ, sağlam bir masa, baza veya koltuğun yanına geçilmeli; bir el ile baş ve ense KAPANARAK korunurken diğer el ile sabit eşyaya TUTUNULMALIDIR. Eşyayla birlikte hareket etmek, eşyanın üzerinize devrilmesini önler ve oluşturduğu koruma boşluğunda ('hayat üçgeni') güvenli kalmanızı sağlar.",
        callout:
          "Eski inanışın aksine kapı pervazları altına sığınmayın; modern binalarda kapı kasaları taşıyıcı değildir ve sarsıntıda hızla deforme olarak sıkışabilir ya da üzerinize yıkılabilir.",
      },
      {
        title: "Sarsıntı Sırasında Asla Yapılmaması Gereken Ölümcül Hatalar",
        summary: "Merdivenler, asansörler ve balkonlar en dayanıksız noktalardır.",
        content:
          "Deprem kayıtları, yaralanmaların önemli bir bölümünün binadan panikle kaçmaya çalışırken gerçekleştiğini belgeler. Binanın en zayıf yapısal elemanları merdiven boşluklarıdır; sarsıntıda ilk kırılan ve çöken yerler merdiven sahanlıklarıdır. Asansörler halat kopması veya elektrik kesintisiyle kuyuya düşebilir veya kat arasında kilitlenebilir. Balkonlardan atlamak ise felaketle sonuçlanır. Sarsıntı tamamen durana kadar bulunulan güvenli noktada kalınmalıdır.",
        actionPoints: [
          "Asla merdivenlere ve yangın merdivenlerine koşmayın.",
          "Asansörleri kesinlikle kullanmayın; asansördeyseniz en yakın kat butonlarına basıp derhal kabini terk edin.",
          "Pencerelerden, cam cephelerden ve asma tavanlardan uzak durun.",
        ],
      },
      {
        title: "Farklı Mekân Senaryolarında Doğru Reaksiyon",
        summary: "Okulda, otomobilde, toplu taşımada veya açık arazide sarsıntıya yakalanma.",
        content:
          "Mekâna göre alınacak önlemler farklılaşır:\n- **Okulda ve sınıftaysanız:** Sıra aralarında başınızı çantayla veya ellerinizle koruyarak sıranın yanına çökün.\n- **Seyir halindeki araçtaysanız:** Sakin bir biçimde sağ şeride yanaşın, köprü, viyadük, alt geçit ve enerji nakil hatlarından uzakta kontağı kapatıp araç içinde bekleyin.\n- **Açık alandaysanız:** Binaların dış cephelerinden, camlardan, falezlerden, heyelan yamaçlarından ve elektrik direklerinden uzaklaşıp çömelin.\n- **AVM veya metro istasyonundaysanız:** Panikle çıkış kapılarına hücum etmeyin; vitrinlerden uzaklaşarak sağlam kolon diplerinde Çök-Kapan-Tutun pozisyonu alın.",
      },
    ],
  },
  {
    id: "after",
    title: "Deprem Sonrası: İlk 72 Saat, İletişim ve Güvenli Tahliye",
    badge: "Sarsıntı Sonrası",
    badgeVariant: "info",
    summary:
      "Sarsıntı sona erdiğinde tehlike bitmiş sayılmaz. Gaz kaçaklarına bağlı yangınlar, kırılan camlar ve yıkıcı artçı sarsıntılar afetin ikinci dalgasını oluşturur.",
    subSections: [
      {
        title: "İlk Dakikalar: Tesisat Güvenliği ve İkincil Afetleri Önleme",
        summary: "Yangın ve patlama riskine karşı vana ve şartellerin kapatılması.",
        content:
          "Sarsıntı durur durmaz sakin kalarak çevrenizdekilerin durumunu kontrol edin. Gaz kokusu olmasa dahi ocakları söndürün, ana doğal gaz vanasını, elektrik panosundaki ana şarteli ve su sayacı vanasını kapatın. Asla kibrit, çakmak veya mum yakmayın; cep telefonu feneri veya pilli el feneri kullanın. Gaz kaçağı varsa elektrik düğmelerini kesinlikle açıp kapatmayın; statik kıvılcım patlamaya yol açabilir.",
      },
      {
        title: "Bina Tahliyesi ve Güvenli Toplanma Alanına İntikal",
        summary: "Ayakkabı giyerek, afet çantasını alıp merdivenleri kontrollü inmek.",
        content:
          "Kırılan camlara ve sıvalara basmamak için sağlam tabanlı ayakkabılarınızı giyin. Hazır bekleyen afet çantasını sırtınıza alarak merdivenleri koşmadan, trabzanlara tutunarak inin. Binadan çıktıktan sonra bina cephelerinden derhal uzaklaşarak sokak aralarında beklemeyin; önceden e-Devlet üzerinden öğrendiğiniz mahalle afet toplanma alanına yürüyerek gidin.",
      },
      {
        title: "İletişim Disiplini: Şebeke Kilitlenmesini Önleme",
        summary: "Sesli arama yapmamak, SMS ve veri tabanlı mesajlaşmayı tercih etmek.",
        content:
          "Afet bölgelerinde tüm nüfusun aynı saniyede sesli telefon görüşmesi yapmaya çalışması baz istasyonlarını çökerterek enkaz altında yardım bekleyenlerin 112'ye ulaşmasını engeller. Durumunuzu önceden belirlediğiniz şehir dışı irtibat kişisine ve yakınlarınıza SMS veya internet tabanlı mesajlaşma uygulamalarıyla ('İyiyim' mesajı) tek seferde bildirin. Telefon hatlarını sadece hayati acil durumlar için serbest bırakın.",
      },
      {
        title: "Artçı Sarsıntılar ve Hasarlı Binalara Girmeme Kuralı",
        summary: "Ana şokun ardından haftalarca sürebilecek ikincil sarsıntılara karşı teyakkuz.",
        content:
          "Büyük bir depremin ardından ana fay üzerindeki gerilim yeniden dengelenene kadar yüzlerce artçı sarsıntı meydana gelir. Ana depremde hafif hasar görmüş bir kolon veya kiriş, küçük bir artçı şokta dahi tamamen göçebilir. Yetkili Çevre, Şehircilik ve İklim Değişikliği Bakanlığı denetim ekipleri 'hasarsız' raporu vermedikçe eşya almak veya dinlenmek amacıyla hasarlı binalara kesinlikle adım atılmamalıdır.",
      },
    ],
  },
];
