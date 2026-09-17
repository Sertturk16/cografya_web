import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getAllContinents } from "@/lib/geo/continents";
import { CONTINENT_META } from "@/lib/map/continent-theme";
import { breadcrumbJsonLd, faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  Globe2,
  Mountain,
  Users,
  Maximize2,
  Waves,
  Home,
  ChevronRight,
  Boxes,
  Table,
  HelpCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => ({
      pathname: "/dunya/kita",
    }),
    title:
      locale === "tr"
        ? "Dünyanın 7 Kıtası: Coğrafi Özellikleri, Haritaları ve Ülkeleri | Coğrafya Gurmesi"
        : "The 7 Continents of the World: Geography, Maps and Countries",
    description:
      locale === "tr"
        ? "Asya, Afrika, Kuzey Amerika, Güney Amerika, Antarktika, Avrupa ve Okyanusya. Yüzölçümü, nüfus dağılımı, iklim kuşakları, dağ zirveleri ve analitik karşılaştırma rehberi."
        : "Asia, Africa, North America, South America, Antarctica, Europe and Oceania. Analytical comparison guide for area, population, climate and highest peaks.",
  });
}

const HUB_FAQS = [
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

export default async function V2ContinentsHubPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const continents = getAllContinents();

  const breadcrumbs = [
    { name: "Dünya Atlası", path: "/dunya" },
    { name: "Kıtalar Atlası", path: "/dunya/kita" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <V2LiveTicker />

      {/* HERO SECTION */}
      <section className="relative border-b border-border bg-gradient-to-b from-primary/10 via-background to-background pt-8 pb-14 overflow-hidden">
        <div className="absolute top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 size-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative z-10">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap"
          >
            <Link
              href="/"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3 opacity-60" />
            <Link href="/dunya" className="hover:text-foreground transition-colors">
              Dünya Atlası
            </Link>
            <ChevronRight className="size-3 opacity-60" />
            <span className="font-semibold text-foreground">Kıtalar Atlası</span>
          </nav>

          {/* Title & Badges */}
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold py-0.5 px-2.5"
              >
                <Globe2 className="size-3.5 mr-1" />7 Kıta & Coğrafi Karakteristikleri
              </Badge>
              <Badge variant="outline" className="text-xs font-mono py-0.5 px-2">
                199 Ülke
              </Badge>
              <Badge variant="outline" className="text-xs font-mono py-0.5 px-2">
                BM M49 Sınıflandırması
              </Badge>
            </div>

            <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              Dünyanın 7 Kıtası: Fiziki Yapısı, İklimi ve Ülkeleri
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Yeryüzünün 149 milyon kilometrekarelik kara parçasını şekillendiren 7 ana kıtanın
              tektonik oluşumu, makroklima kuşakları, büyük nehir havzaları ve demografik yapıları.
              İstatistiklerin ardındaki coğrafi mekanizmaları keşfedin.
            </p>
          </div>

          {/* Quick Aggregated Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Maximize2 className="size-3.5 text-primary" />
                <span>Toplam Kara Alanı</span>
              </div>
              <div className="font-heading font-black text-lg sm:text-xl text-foreground">
                ~149.000.000 km²
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                Yeryüzünün %29,2&apos;si
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="size-3.5 text-secondary" />
                <span>Dünya Nüfusu</span>
              </div>
              <div className="font-heading font-black text-lg sm:text-xl text-foreground">
                ~8,05 Milyar
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                %59&apos;u Asya kıtasında
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Mountain className="size-3.5 text-amber-600" />
                <span>En Yüksek Zirve</span>
              </div>
              <div className="font-heading font-black text-lg sm:text-xl text-foreground">
                Everest (8.848 m)
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                Himalayalar / Asya
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Waves className="size-3.5 text-sky-600" />
                <span>En Uzun Akarsu</span>
              </div>
              <div className="font-heading font-black text-lg sm:text-xl text-foreground">
                Nil (6.650 km)
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                Afrika / Akdeniz Havzası
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-16">
        {/* SECTION 1: 7 CONTINENTS RICH CARDS GRID */}
        <section id="kitalar-listesi" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Boxes className="size-4" />
                <span>Kıtalar Envanteri</span>
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
                7 Kıtanın Coğrafi Karakteristikleri
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Detaylı harita ve derinlemesine rehber için kıta kartlarına tıklayın
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {continents.map((continent) => {
              const theme = CONTINENT_META[continent.id] ?? CONTINENT_META.AVRUPA!;
              return (
                <div
                  key={continent.id}
                  className="group relative rounded-3xl border border-border/80 bg-card hover:border-primary/50 transition-all duration-200 hover:shadow-lg flex flex-col justify-between overflow-hidden"
                >
                  {/* Header gradient bar */}
                  <div className={`h-2.5 w-full bg-gradient-to-r ${theme.headerClass}`} />

                  <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={theme.badgeClass}>
                          {continent.nameTr}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {continent.code}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-heading font-black text-2xl text-foreground group-hover:text-primary transition-colors">
                          {continent.nameTr} Kıtası
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {continent.taglineTr}
                        </p>
                      </div>

                      {/* Metric Highlights */}
                      <div className="grid grid-cols-2 gap-2.5 py-2 border-y border-border/60 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            Yüzölçümü
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {continent.areaFormattedTr}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            (%{continent.areaSharePercent})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            Nüfus
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {continent.populationFormattedTr}
                          </span>
                          {continent.populationSharePercent > 0 && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              (%{continent.populationSharePercent})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            En Yüksek Zirve
                          </span>
                          <span className="font-medium text-foreground truncate block">
                            {continent.highestPoint.name} ({continent.highestPoint.elevationM} m)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            En Uzun Akarsu
                          </span>
                          <span className="font-medium text-foreground truncate block">
                            {continent.longestRiver.name} ({continent.longestRiver.lengthKm} km)
                          </span>
                        </div>
                      </div>

                      {/* Key Characteristics list */}
                      <div className="space-y-1.5 pt-1">
                        {continent.keyCharacteristicsTr.map((item, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <span className="text-primary font-black leading-none mt-0.5">•</span>
                            <span className="leading-snug">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="pt-4 mt-auto">
                      <Link
                        href={{
                          pathname: "/dunya/kita/[slug]",
                          params: { slug: continent.slugTr },
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-muted hover:bg-primary hover:text-primary-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground shadow-2xs"
                      >
                        <span>{continent.nameTr} Coğrafyasını İncele</span>
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: COMPREHENSIVE ANALYTICAL COMPARISON TABLE */}
        <section id="karsilastirma" className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Table className="size-4" />
              <span>Analitik Karşılaştırma</span>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              7 Kıtanın Karşılaştırmalı Göstergeleri
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Yüzölçümü, dünya payı, nüfus yoğunluğu, en yüksek ve en alçak noktalar.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-foreground font-semibold">
                    <th className="py-3 px-4">Kıta</th>
                    <th className="py-3 px-3">Yüzölçümü (km²)</th>
                    <th className="py-3 px-3">Dünya Payı (%)</th>
                    <th className="py-3 px-3">Nüfus</th>
                    <th className="py-3 px-3">Nüfus Payı (%)</th>
                    <th className="py-3 px-3">Yoğunluk (kişi/km²)</th>
                    <th className="py-3 px-3">Ülke Sayısı</th>
                    <th className="py-3 px-4">En Yüksek Zirve</th>
                    <th className="py-3 px-4">En Alçak Nokta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {continents.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground flex items-center gap-2">
                        <Link
                          href={{
                            pathname: "/dunya/kita/[slug]",
                            params: { slug: c.slugTr },
                          }}
                          className="hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <span>{c.nameTr}</span>
                          <ChevronRight className="size-3 opacity-50" />
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {new Intl.NumberFormat("tr-TR").format(c.areaKm2)}
                      </td>
                      <td className="py-3 px-3 font-mono text-foreground font-medium">
                        %{c.areaSharePercent}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {c.population > 0
                          ? new Intl.NumberFormat("tr-TR").format(c.population)
                          : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-foreground font-medium">
                        {c.populationSharePercent > 0 ? `%${c.populationSharePercent}` : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {c.densityPerKm2 > 0 ? c.densityPerKm2 : "0"}
                      </td>
                      <td className="py-3 px-3 font-mono text-foreground font-bold">
                        {c.countryCount}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <span className="font-medium text-foreground">{c.highestPoint.name}</span>{" "}
                        <span className="text-[11px] font-mono">
                          ({c.highestPoint.elevationM} m)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <span className="font-medium text-foreground">{c.lowestPoint.name}</span>{" "}
                        <span className="text-[11px] font-mono">
                          ({c.lowestPoint.elevationM} m)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/60 font-bold text-foreground">
                    <td className="py-3 px-4">Dünya Toplamı</td>
                    <td className="py-3 px-3 font-mono">~149.000.000</td>
                    <td className="py-3 px-3 font-mono">%100</td>
                    <td className="py-3 px-3 font-mono">~8.050.000.000</td>
                    <td className="py-3 px-3 font-mono">%100</td>
                    <td className="py-3 px-3 font-mono">~54</td>
                    <td className="py-3 px-3 font-mono">199</td>
                    <td className="py-3 px-4">Everest (8.848 m)</td>
                    <td className="py-3 px-4">Lut Gölü (-430 m)</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 3: EDUCATIONAL CONTEXT — KITA NEDIR? */}
        <section
          id="kavramsal-rehber"
          className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs"
        >
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <BookOpen className="size-4" />
            <span>Coğrafi Bilgi Rehberi</span>
          </div>

          <div className="space-y-4 max-w-4xl">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Kıta Nedir? 7 Kıta Modeli ve Sınırların Tarihsel Evrimi
            </h2>

            <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
              <p>
                Coğrafyada <strong>kıta</strong>; etrafı genellikle okyanus ve denizlerle çevrili,
                kendine ait kıtasal kabuğu ve jeolojik kalkanı (kraton) bulunan devasa kara
                parçalarına verilen addır. Ancak kıtaların tanımı ve sayısı salt jeolojik bir olgu
                değil, aynı zamanda tarihsel, kültürel ve pedagojik bir uzlaşımdır (konvansiyon).
              </p>

              <p>
                <strong>Neden 7 Kıta?</strong> Türkiye&apos;de Millî Eğitim Bakanlığı (MEB)
                müfredatı ve geleneksel coğrafya eğitimi <strong>7 kıta modelini</strong> (Asya,
                Avrupa, Afrika, Kuzey Amerika, Güney Amerika, Antarktika, Okyanusya) temel alır.
                Buna karşılık Birleşmiş Milletler M49 istatistik şeması Kuzey ve Güney
                Amerika&apos;yı tek bir &quot;Americas&quot; olarak sınıflandırarak 6 kıtalı
                yaklaşımı kullanır. Olimpiyat halkaları ise insanın kalıcı olarak yaşadığı 5 kıtayı
                (Antarktika hariç, Amerika tek) simgeler.
              </p>

              <p>
                <strong>Sınırlar Birer Doğal Eşik midir, Yoksa Sözleşme mi?</strong> Afrika ile Asya
                arasında Süveyş Kıstağı, Kuzey ve Güney Amerika arasında Panama Kıstağı fiziki boğaz
                ve kıstak sınırları oluşturur. Ancak <strong>Avrupa ile Asya</strong> arasındaki
                sınır bütünüyle tarihsel bir konvansiyondur: İki kıta tektonik olarak tek parça olan
                Avrasya levhasında oturur. 18. yüzyıldan itibaren Rus ve Avrupalı coğrafyacıların
                uzlaşısıyla Ural Dağları, Ural Nehri ve Kafkaslar sınır kabul edilmiştir.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: SIKÇA SORULAN SORULAR (FAQ) */}
        <section id="sss" className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <HelpCircle className="size-4" />
              <span>Merak Edilenler</span>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Kıtalar Hakkında Sıkça Sorulan Sorular
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HUB_FAQS.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-border bg-card p-5 space-y-2 hover:border-primary/40 transition-colors"
              >
                <h3 className="font-heading font-bold text-sm text-foreground flex items-start gap-2">
                  <span className="text-primary font-mono text-xs mt-0.5">{idx + 1}.</span>
                  <span>{faq.question}</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed pl-4">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: KAYNAKLAR & METODOLOJİ */}
        <V2SourcesSection
          scope="dunya"
          regionalNote="Kıta yüzölçümleri ve nüfus istatistikleri Birleşmiş Milletler İstatistik Bölümü (UN M49), Dünya Bankası (World Bank) ve Encyclopædia Britannica coğrafya korpusu ile çapraz doğrulanmıştır. En yüksek zirveler ve nehir uzunlukları uluslararası jeodezik ölçüm verilerine dayanır."
        />
      </div>

      {/* Structured Data JSON-LD */}
      <JsonLd schema={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd schema={faqPageJsonLd(HUB_FAQS)} />
    </div>
  );
}
