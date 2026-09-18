import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getMarinePointsSafe, getMarineOverviewSafe, getMarineLayersSafe } from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarineOverviewPoint } from "@/lib/api/types";
import { collectionPageJsonLd, learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2MarineMapExplorer, type MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { V2MarineBasinCards } from "@/components/v2/v2-marine-basin-cards";
import { V2MarineOceanographyGuide } from "@/components/v2/v2-marine-oceanography-guide";
import { V2MarineLayerCatalogue } from "@/components/v2/v2-marine-layer-catalogue";
import { FaqSection } from "@/components/patterns/faq-section";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { MarineDataNotice } from "@/components/marine/marine-data-notice";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { cn } from "@/lib/utils";
import { Waves, Home, Layers, ArrowRight } from "lucide-react";
import { marineBlockValues, oldestValidAt, maxGridDistanceKm } from "@/lib/marine/vintage";
import { marineShowsValues } from "@/lib/marine/overview";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";
import { Card } from "@/components/ui/card";

export const revalidate = 900;

interface V2DenizPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2DenizPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    surface: "trNarrative",
    hrefForLocale: () => "/deniz",
    title: "Denizler & Kıyılar Atlası — Deniz Telemetrisi ve Su Sıcaklıkları",
    description:
      "Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktası: su sıcaklığı, dalga boyu, rüzgâr vektörleri ve oşinografi modelleri.",
  });
}

export default async function V2DenizPage({ params }: V2DenizPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const format = await getFormatter();
  const t = await getTranslations("Deniz");

  /**
   * The eight FAQ pairs, READ FROM THE CATALOGUE rather than written here.
   *
   * `V2MarineFaqAccordion` held seven of these as Turkish string literals in a `FAQ_ITEMS`
   * constant — the only FAQ block in the tree that was not message-driven, and the thing
   * `docs/architecture.md` forbids in a file that has a translator to hand. `Deniz.q1..q8` /
   * `Deniz.a1..a8` are those seven questions, edited, plus an eighth ("geçerlilik anı"), and they
   * were already in `messages/tr.json` before this change: nothing here was copied into a new
   * key, and no English was invented.
   *
   * The keys are built with a template literal on purpose. `lib/i18n/key-existence.test.ts`
   * resolves LITERAL keys only and states that a computed one is invisible to it by design, so
   * this loop is not asking that scanner to certify a `q7` it cannot see — what guarantees the
   * eight pairs exist is `lib/marine/deniz-faq.test.ts`, which reads the catalogue itself.
   */
  const marineFaqs = Array.from({ length: 8 }, (_, i) => ({
    question: t(`q${i + 1}`),
    answer: t(`a${i + 1}`),
  }));

  // Fetch points, live overview, layers and provinces
  const [rawPoints, rawOverview, rawLayers, rawProvinces] = await Promise.all([
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
    getMarineLayersSafe(),
    getProvincesResilient(),
  ]);

  // The one signal that decides whether this render may make a value/"live" claim in prose —
  // false whenever MARINE_ENABLED is off (prod today) or the overview payload is otherwise
  // empty. Copy above the fold must not promise hourly telemetry the value band cannot back
  // up (mirrors the reasoning already recorded in `app/[locale]/(site)/deniz/page.tsx`, the V1 hub).
  const showValues = marineShowsValues(rawOverview);

  // Province lookup map by plateCode
  const provinceByPlate = new Map<string, { name: string; slug: string }>();
  for (const prov of rawProvinces) {
    provinceByPlate.set(prov.plateCode, {
      name: prov.nameTr,
      slug: locale === "en" ? prov.slugEn : prov.slugTr,
    });
  }

  // Live overview value map
  const overviewMap = new Map<string, MarineOverviewPoint>();
  if (rawOverview?.points) {
    for (const item of rawOverview.points) {
      overviewMap.set(item.point.slugTr, item);
    }
  }

  // Combine into rich MarinePointData
  const marinePoints: MarinePointData[] = rawPoints.map((pt) => {
    const live = overviewMap.get(pt.slugTr);
    const prov = provinceByPlate.get(pt.plateCode);

    let validAtFormatted: string | null = null;
    let gridDist: number | null = null;
    if (live) {
      const rowValues = marineBlockValues(live);
      const oldest = oldestValidAt(rowValues);
      if (oldest) {
        validAtFormatted =
          format.dateTime(oldest, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          }) + " UTC";
      }
      gridDist = maxGridDistanceKm(rowValues);
    }

    const windSpeed = live?.windSpeed10m?.value ?? null;
    const isStraits = pt.plateCode === "34" || pt.plateCode === "17";

    return {
      slugTr: pt.slugTr,
      slugEn: pt.slugEn,
      nameTr: pt.nameTr,
      nameEn: pt.nameEn,
      coastLabelTr: pt.coastLabelTr,
      coastLabelEn: pt.coastLabelEn,
      plateCode: pt.plateCode,
      latitude: pt.latitude,
      longitude: pt.longitude,
      seaBasin: pt.seaBasin,
      displayOrder: pt.displayOrder,
      sst: live?.seaSurfaceTemperature?.value ?? null,
      waveHeight: live?.waveHeight?.value ?? null,
      waveDirection: live?.waveDirection?.value ?? null,
      windSpeed10m: windSpeed,
      windDirection10m: live?.windDirection10m?.value ?? null,
      windSpeedKmh: windSpeed !== null ? windSpeed * 3.6 : null,
      validAt: validAtFormatted,
      gridDistanceKm: gridDist,
      isStraits,
      provinceName: prov?.name ?? `İl ${pt.plateCode}`,
      provinceSlug: prov?.slug ?? "",
    };
  });

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Denizler & Kıyılar Atlası",
            description:
              "Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktası: su sıcaklığı, dalga yüksekliği ve oşinografi verileri.",
            path: "/deniz",
            locale,
          }),
          learningResourceJsonLd({
            name: "Denizler & Kıyılar Atlası",
            description:
              "Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktası: su sıcaklığı, dalga yüksekliği ve oşinografi verileri.",
            path: "/deniz",
            locale,
            learningResourceType: "Article",
            teaches: "Türkiye denizlerinin oşinografik yapısı, su sıcaklığı ve dalga rejimleri",
          }),
        ]}
      />

      <V2LiveTicker />

      <PageContainer space="loose">
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Denizler & Kıyılar Atlası", path: "/deniz" },
            ]}
            locale={locale}
            surface="trNarrative"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Denizler & Kıyılar Atlası"
              badges={
                <>
                  <Badge variant="primary" size="sm" icon={<Waves className="size-3.5" />}>
                    Mavi Vatan Oşinografi Portalı
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    {showValues ? "30 Canlı Telemetri İstasyonu" : "30 Referans Noktası"}
                  </Badge>
                </>
              }
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={
                showValues ? (
                  <>
                    Karadeniz, Marmara, Ege ve Akdeniz havzalarının saatlik deniz suyu sıcaklıkları,
                    dalga boyları, tuzluluk oranları, akıntı rejimleri ve 28 kıyı ilinin oşinografik
                    yapısı.
                  </>
                ) : (
                  <>
                    Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktasının kapsadığı
                    deniz suyu sıcaklığı, dalga boyu, rüzgâr ve akıntı büyüklükleri; 28 kıyı ilinin
                    oşinografik yapısıyla birlikte. Güncel ölçüm değerleri şu an yayında değil.
                  </>
                )
              }
            />

            {/* Metric Strip */}
            {/* `tone="secondary"` was `text-cyan-600` — frozen at #0092b8 in both themes,
                3.62:1 on the light card, the weakest reading in the whole strip family. (Large
                bold text, 3:1 floor, so it passed AA; the defect was the freeze, not the ratio.)

                CONVERTED BECAUSE OF THE ENTITY, NOT THE PAGE. Cyan is NOT a free hue site-wide —
                it is Karadeniz (`components/v2/v2-marine-basin-cards.tsx:31`, and this page's own
                sea cards). What decides it is that nothing anywhere encodes MONITORING POINTS by
                colour, which is what this tile names. The page-scoped question ("is this hue used
                on this page") answers yes here and would have blocked a correct conversion; on
                `deprem/fay-hatlari` it answered no and waved through a wrong one. See
                `docs/design.md` — the test is the entity. */}
            <StatGrid gutter="hero">
              <StatTile label="Farklı Havza & Akıntı" fact="4 Deniz" tone="primary" />
              <StatTile
                label={showValues ? "Saatlik Telemetri İstasyonu" : "Referans İzleme Noktası"}
                fact="30 Nokta"
                tone="secondary"
              />
              <StatTile label="Denize Kıyısı Olan Şehir" fact="28 İl" tone="accent" />
              <StatTile label="Toplam Kıyı Uzunluğu (HGM)" fact="8.333 km" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: INTERACTIVE REALISTIC TURKEY & SEA MAP EXPLORER */}
        <V2MarineMapExplorer marinePoints={marinePoints} locale={locale} />

        {/* SECTION 2: 4 SEA BASINS COMPREHENSIVE GUIDE */}
        <V2MarineBasinCards />

        {/* SECTION 3: COASTAL TYPES & OCEANOGRAPHY GUIDE */}
        <V2MarineOceanographyGuide />

        {/* SUBMARINE FAULTS CALLOUT BANNER */}
        <div className="p-5 rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-500/5 via-card to-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
              <Layers className="size-5" />
            </div>
            <div>
              <span className="font-heading text-base font-bold text-foreground block">
                Denizaltı Sismotektoniği &amp; Aktif Fay Hatları
              </span>
              <span className="text-xs text-muted-foreground block">
                Kuzey Anadolu Fayı&apos;nın Marmara Denizi derin çukurlarındaki geçişi ve Ege açılma
                tektoniği.
              </span>
            </div>
          </div>
          <Link
            href="/deprem/fay-hatlari"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0 font-bold text-xs group gap-1.5",
            )}
          >
            <span>Fay Hatları Atlasına Git</span>
            <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* SECTION 4: MEASUREMENT LAYERS CATALOGUE */}
        <V2MarineLayerCatalogue layers={rawLayers} />

        {/* SECTION 5: PEDAGOGICAL FAQ ACCORDION.

            GATED TO `tr`, AND THAT IS THE HONEST STATE RATHER THAN A PREFERENCE. The eight pairs
            below are read from `Deniz.q1..q8` / `Deniz.a1..a8`, which exist in `messages/tr.json`
            and NOT in `messages/en.json`. Until the English copy is written, rendering this block
            on `/en/sea` would print eight `Deniz.q1`-shaped key strings as visible page text
            (next-intl does not throw on a missing key). The previous `V2MarineFaqAccordion`
            hardcoded the same seven questions as Turkish literals and rendered them UNGATED, so
            `/en/sea` shipped Turkish prose; the gate is what that defect becomes once the strings
            are message-driven, not a new restriction. The EN gap is boarded beside T-040.

            `structuredData={false}` IS DELIBERATE, NOT AN OMISSION. This block has never emitted
            `FAQPage` and nothing here asks it to start: `/deniz` is a `trNarrative` surface, and
            a schema is a claim about a page, not a decoration. `FaqSection`'s own docblock names
            this block as the reason its `structuredData` defaults to `false`. */}
        {locale === "tr" && (
          <FaqSection
            id="sss"
            heading={t("faqHeading")}
            locale={locale}
            items={marineFaqs}
            mechanism="accordion"
            structuredData={false}
          />
        )}

        {/* SECTION 6: SAFETY DISCLAIMER, AND THE LINK TO THE LICENCE TEXT
            The ECMWF and Copernicus Marine wording is the LICENCE, not copy. It is published
            verbatim, in English, in both locales — once, on `/hakkimizda`, reached from the link
            in this block: CC BY 4.0 §3(a)(2) lets the required information be carried by a
            hyperlink, and ECMWF Open Data is CC BY 4.0.
            What stays HERE is the sentence that is not a licence notice at all — "eğitim
            amaçlıdır; denizcilik, seyir veya can güvenliği kararlarında kullanılamaz". This hub
            publishes values and catalogues the derived material on every render, so that
            sentence is owed on every render, beside them. Ungated for the same reason.  */}
        <MarineDataNotice />

        {/* SECTION 7: SOURCES (KAYNAKÇA) — the bibliography, in our words. It sits alongside the
            notice above and never in place of it. */}
        <V2SourcesSection scope="deniz" />
      </PageContainer>
    </>
  );
}
