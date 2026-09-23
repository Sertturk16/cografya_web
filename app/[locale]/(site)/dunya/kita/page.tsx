import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { PageContainer } from "@/components/patterns/page-container";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getAllContinents, CONTINENT_HUB_FAQS } from "@/lib/geo/continents";
import { CONTINENT_META } from "@/lib/map/continent-theme";
import { FaqSection } from "@/components/patterns/faq-section";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Mountain, Users, Maximize2, Waves, Home, ChevronRight, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

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

export default async function V2ContinentsHubPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dunya");

  const continents = getAllContinents();

  return (
    <>
      <V2LiveTicker />

      {/* HERO SECTION */}
      <section className="relative isolate border-b border-border bg-gradient-to-b from-primary/10 via-background to-background pt-8 pb-14 overflow-hidden">
        <div className="absolute -z-10 top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -z-10 top-1/2 left-1/4 size-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <PageContainer space="band">
          {/* Breadcrumb */}
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Dünya Atlası", href: "/dunya", path: "/dunya" },
              { label: "Kıtalar Atlası", path: "/dunya/kita" },
            ]}
            locale={locale}
            surface="trOnly"
          />

          {/* Title & Badges */}
          <div className="space-y-3 max-w-3xl">
            <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              Kıtalar Atlası
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Karaların toplamı yaklaşık 149 milyon km². Burada o karayı paylaşan yedi kıtayı yan
              yana görürsün: ne kadar geniş oldukları, kaç kişi barındırdıkları, en yüksek dağları
              ve en uzun nehirleri. Bir kıtanın sayfasında haritası ve ülkeleri de var.
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
                <Mountain className="size-3.5" />
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
                <Waves className="size-3.5" />
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
        </PageContainer>
      </section>

      {/* `w-full min-w-0` is GONE, not just renamed. It fixed a flex-item bug: this div used to
          be a child of `min-h-screen … flex flex-col` (the page's own copy of the root layout's
          shell), so its default `min-width: auto` let it grow to its widest child's MIN-CONTENT
          width — 831 px, set by the comparison table — instead of the viewport's, and the
          table's own `overflow-x-auto` never engaged. That flex wrapper is deleted (it duplicated
          `(site)/layout.tsx`); `<main>` there is a plain block box, so a block child is never
          stretched to a flex sibling's min-content width in the first place — the bug's
          precondition is gone with the wrapper that caused it. Re-verified at 320 px after the
          change: 305 px document width, table still scrolling inside its own box. */}
      <PageContainer space="loose">
        {/* SECTION 1: 7 CONTINENTS RICH CARDS GRID */}
        <section id="kitalar-listesi" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Kıtalar Tek Tek
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Kartın altındaki düğme kıtanın kendi sayfasını açar.
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
                  {/* Header gradient bar — the continent's own fill fading to half strength.
                      Purely graphical, no text sits on it. */}
                  <div className={`h-2.5 w-full bg-gradient-to-r ${theme.identity.headerBar}`} />

                  <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
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
                        <span>{continent.nameTr} haritası ve ülkeleri</span>
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
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Yedi Kıta Aynı Tabloda
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Kıtaların nüfusu ve yüzölçümü yan yana. Yoğunluk sütunu km² başına düşen kişi sayısını
              gösterir.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-foreground font-semibold">
                    <th className="py-3 px-4">Kıta</th>
                    <th className="py-3 px-3">Yüzölçümü (km²)</th>
                    <th className="py-3 px-3">Kara Payı (%)</th>
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

            {/* THE METHODOLOGY NOTE, RE-HOMED. It used to ride into the old sources card as
                `regionalNote`, under a "Bölgesel Metodoloji & Yasal Dayanak" badge, inside a
                block that also named five institutions this page cannot trace a figure to. The
                block is gone; the note is not a citation and never was. It says the figures are
                ours, rounded for teaching, and will not match any one institution — the single
                most useful sentence on this page for a student, and useless three screens away
                from the numbers it describes. It sits under the table it is about, inside the
                same card, so the caption reads with the figures. */}
            <p className="border-t border-border/60 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground sm:px-6">
              {t("continentFiguresNote")}
            </p>
          </div>
        </section>

        {/* SECTION 3: EDUCATIONAL CONTEXT — KITA NEDIR? */}
        <Card as="section" variant="panel" space="6" elevation="xs" id="kavramsal-rehber">
          <div className="space-y-4 max-w-4xl">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Kıta Nedir, Neden Yedi Tane Sayıyoruz?
            </h2>

            <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
              <p>
                <strong>Kıta</strong>, çevresi çoğunlukla okyanus ve denizlerle çevrili, altında
                kalın ve eski bir kıtasal kabuk bulunan büyük kara parçasıdır. Kıtaların çoğunun
                çekirdeğinde, çok eski ve sağlam kayalardan oluşan kalkanlar, yani kratonlar
                bulunur. Yine de kaç kıta olduğu yalnız jeolojiyle belirlenmez. Sayı biraz da
                tarihin, kültürün ve okulda nasıl öğretildiğinin sonucudur.
              </p>

              <p>
                <strong>Neden 7 kıta?</strong> Türkiye&apos;de okullarda, Millî Eğitim
                Bakanlığı&apos;nın programında da, 7 kıta öğretilir: Asya, Avrupa, Afrika, Kuzey
                Amerika, Güney Amerika, Antarktika ve Okyanusya. Birleşmiş Milletler&apos;in
                istatistik sınıflandırması ise iki Amerika&apos;yı tek bir grupta topladığı için 6
                kıtayla çalışır. Olimpiyat halkaları da 5 kıtayı simgeler: Antarktika sayılmaz,
                Amerika tektir.
              </p>

              <p>
                <strong>Kıta sınırları doğada mı çizili?</strong> Bazıları öyle. Afrika ile Asya
                Süveyş Kıstağı&apos;nda, Kuzey ve Güney Amerika Panama Kıstağı&apos;nda birleşir;
                sınır o dar kara parçasından geçer. <strong>Avrupa ile Asya</strong> arasındaki
                sınır ise insanların üzerinde anlaştığı bir çizgidir. İki kıta aynı levhanın,
                Avrasya Levhası&apos;nın üstündedir. 18. yüzyıldan beri Rus ve Avrupalı
                coğrafyacılar Ural Dağları&apos;nı, Ural Nehri&apos;ni ve Kafkasları sınır sayar.
              </p>
            </div>
          </div>
        </Card>

        {/* SECTION 4: SIKÇA SORULAN SORULAR (FAQ). The `<JsonLd>` that used to sit at the very
            bottom of this file, six hundred lines from the markup it described, is now emitted by
            the component that renders the questions — from the same `HUB_FAQS` array, so the two
            cannot drift. `"trOnly"` is this page's own surface constant.

            TR-ONLY UNTIL T-040 (owner, 2026-09-19). These questions are Turkish literals with no
            English counterpart, so the EN twin was rendering Turkish prose under English chrome.
            `structuredData="trOnly"` already withheld the FAQPage schema there — the markup was
            the gap. Gating the whole component keeps both halves moving together: no component,
            no schema. */}
        {locale === "tr" && (
          <FaqSection
            heading="Kıtalar Hakkında Sıkça Sorulan Sorular"
            locale={locale}
            items={CONTINENT_HUB_FAQS}
            structuredData="trOnly"
          />
        )}

        {/* NO SOURCES SECTION. This page reads NO api at all — the figures come from
            `lib/geo/continents.ts`, a hand-written registry — and draws no map, so every one of
            the five institutions the `dunya` list named (Natural Earth, the UN & World Bank, the
            CIA World Factbook, USGS/NASA, IHO GEBCO) was traceable to nothing here. The scope is
            gone, and T-088 deleted the sources card from every other page too.

            What that block DID carry that was worth keeping is `Dunya.continentFiguresNote`, and
            it is not a citation: it is the methodology note that replaced a false "UN M49, Dünya
            Bankası, Encyclopædia Britannica ... ile çapraz doğrulanmıştır" cross-validation
            claim. It now renders as a caption under the comparison table, beside the figures it
            describes. Still read from the catalogue, never written inline, because `/en/` reaches
            this surface and the string it replaced was a Turkish literal. */}
      </PageContainer>
    </>
  );
}
