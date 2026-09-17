import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getEarthquakeListResilient, getEarthquakeMetaSafe } from "@/lib/api/earthquakes";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { EarthquakeEvent, EarthquakeMeta } from "@/lib/api/types";
import { EarthquakeAttribution } from "@/components/earthquake/earthquake-attribution";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2EarthquakeExplorer, type ProvinceMeta } from "@/components/v2/v2-earthquake-explorer";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { cn } from "@/lib/utils";
import { Flame, Home, Layers, ShieldCheck, ArrowRight } from "lucide-react";

export const revalidate = 120;

interface V2DepremPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2DepremPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    hrefForLocale: () => "/deprem",
    // `trOnly`, declared rather than defaulted. Without it `buildMetadata` falls to
    // `"localized"`, which puts `/en/earthquakes` in the hreflang set and in `app/sitemap.ts`
    // as an English page. It is not one: this file makes ZERO `getTranslations` calls and has
    // no `locale` branch anywhere, so the English URL served forty-three lines of Turkish under
    // an English `<html lang>`. `lib/seo/indexing.ts` exists to keep exactly that out of the
    // index, and the surface was the one thing never set.
    //
    // This is a statement of fact, not a decision to de-scope EN. `messages/en.json` already
    // carries an `Earthquake` namespace; wiring this page to it and moving the surface back to
    // `"localized"` is the real fix, and it is a content task rather than a metadata one.
    surface: "trOnly",
    title: "Canlı Deprem Takip & Sismik Monitör — AFAD TDVMS Verileri",
    description:
      "Türkiye ve çevre coğrafyadaki son depremler, merkez üsleri ve odak derinlikleri canlı harita üzerinde.",
  });
}

export default async function V2DepremPage({ params }: V2DepremPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  let initialEvents: EarthquakeEvent[] = [];
  const provinceMap = new Map<string, ProvinceMeta>();
  // The provider's own required notice and the mandatory early-warning disclaimer. `…Safe`
  // returns null rather than throwing, so a degraded meta fetch cannot take the event list down
  // with it; a null meta renders no attribution block AND no events worth the claim, which is
  // the same "no notice, no values" pairing the province section is gated on.
  let earthquakeMeta: EarthquakeMeta | null = null;

  try {
    const [list, rawProvinces, meta] = await Promise.all([
      getEarthquakeListResilient(),
      getProvincesResilient(),
      getEarthquakeMetaSafe(),
    ]);
    initialEvents = list?.items || [];
    earthquakeMeta = meta;
    for (const p of rawProvinces) {
      provinceMap.set(p.plateCode, {
        name: p.nameTr,
        slug: locale === "en" ? p.slugEn : p.slugTr,
      });
    }
  } catch (err) {
    console.warn("[v2/deprem] Live fetch degraded gracefully:", err);
  }

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Canlı Deprem Takip & Sismik Monitör",
            description:
              "Türkiye ve yakın çevresinde gerçekleşen son depremleri interaktif vektör harita üzerinde merkez üssü ve odak derinliğiyle anlık takip edin.",
            path: "/deprem",
            locale,
          }),
        ]}
      />

      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Canlı Deprem Monitörü", path: "/deprem" },
            ]}
            locale={locale}
            surface="trOnly"
          />

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" size="sm" icon={<Flame className="size-3.5" />} dot>
                  Canlı Sismik Telemetri
                </Badge>
                <Badge variant="outline" size="sm">
                  T.C. İçişleri Bakanlığı AFAD (TDVMS)
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
                Canlı Deprem Takip &amp; Sismik Monitör
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Türkiye ve yakın çevresinde gerçekleşen son depremleri interaktif vektör harita
                üzerinde merkez üssü, odak derinliği ve büyüklük kademesiyle anlık inceleyin.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-destructive block">
                  120 sn
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Veri Yenileme Aralığı
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  Canlı AFAD
                </span>
                <span className="text-xs text-muted-foreground font-medium">TDVMS Veri Tabanı</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  M 1.0 - 7.0+
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Hassas Büyüklük Skalası
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  81 İl
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  İl Bazlı Yakınlık Analizi
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE REAL-TIME EARTHQUAKE MAP & DATA TABLE */}
        <V2EarthquakeExplorer
          initialEvents={initialEvents}
          provinceMap={provinceMap}
          defaultMinMagnitude={2.5}
          defaultWindowDays={7}
        />

        {/* SECTION 2: FAULT LINES NAVIGATION CARD */}
        <section
          aria-labelledby="v2-fault-lines-nav-heading"
          className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-lg space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" size="sm" icon={<Layers className="size-3.5" />}>
                  Sismotektonik Yapı
                </Badge>
                {/* NO "MTA Diri Fay Ağı" EYEBROW. It labelled this section as MTA's published
                    active-fault network, which is a stronger claim than the bibliography card it
                    matched — and the card went for lack of anything to back it. `/deprem/fay-hatlari`
                    renders `lib/earthquake/fault-lines-data.ts`: names, prose and province lists,
                    no MTA geometry. The heading below says what the section is. */}
              </div>
              <h2
                id="v2-fault-lines-nav-heading"
                className="font-heading text-xl sm:text-2xl font-bold text-foreground"
              >
                Türkiye&apos;nin Ana Fay Hatları: KAF, DAF ve BAFS
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                Kuzey Anadolu Fayı, Doğu Anadolu Fayı ve Batı Anadolu Fay Sistemi&apos;nin tektonik
                arka planı, geçtiği iller, segment kırılmaları ve tarihsel büyük deprem ilişkileri.
              </p>
            </div>
            <Link
              href="/deprem/fay-hatlari"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0 group gap-1.5 font-bold",
              )}
            >
              <span>Fay Hatları Atlasına Git</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-700 dark:text-red-300">KAF</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-300">
                  Sağ Yanal Atımlı
                </span>
              </div>
              <p className="text-muted-foreground">
                Saros Körfezi&apos;nden Marmara Denizi tabanına ve Karlıova&apos;ya uzanan 1.200
                km&apos;lik ana kırık hattı.
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-700 dark:text-blue-300">DAF</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  Sol Yanal Atımlı
                </span>
              </div>
              <p className="text-muted-foreground">
                Hatay grabeninden Kahramanmaraş, Malatya ve Elazığ üzerinden Karlıova birleşimine
                ulaşan hat.
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">BAFS</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  Graben Açılması
                </span>
              </div>
              <p className="text-muted-foreground">
                Gediz, Menderes ve Bakırçay graben çöküntülerini oluşturan çok parçalı normal fay
                sistemi.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: QUICK PREPAREDNESS SUMMARY BOX */}
        <section
          aria-labelledby="v2-preparedness-summary-heading"
          className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8 shadow-md space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h2
                  id="v2-preparedness-summary-heading"
                  className="font-heading text-lg sm:text-xl font-bold text-foreground"
                >
                  Deprem Anında Ne Yapmalısınız?
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sarsıntı esnasında doğru refleksler hayat kurtarır.
                </p>
              </div>
            </div>
            <Link
              href="/deprem/hazirlik"
              className={cn(
                buttonVariants({ variant: "primary", size: "sm" }),
                "shrink-0 group gap-1.5 font-bold",
              )}
            >
              <span>Kapsamlı Hazırlık Rehberi</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-1">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                1. Çök - Kapan - Tutun
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sağlam bir eşyanın yanında hayat üçgeni oluşturun. Baş ve ensenizi koruyarak
                sarsıntı geçene kadar bekleyin.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-1">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive" />
                2. Merdiven &amp; Asansöre Koşmayın
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Binaların en zayıf yerleri merdiven boşluklarıdır. Asla merdivenlere hücum etmeyin,
                asansörleri kullanmayın.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-1">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" />
                3. Tesisatları Kapatıp Tahliye Edin
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sarsıntı bitince doğal gaz vanası ve şarteli kapatın. Afet çantanızı alarak açık
                toplanma alanına yürüyün.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA)
            Two blocks, two different jobs, and they are not interchangeable.

            `EarthquakeAttribution` renders the PROVIDER'S OWN wording out of the payload —
            `attributions[].requiredNoticeTr` with its `regulationReference`, plus the mandatory
            early-warning disclaimer. It is required, it is verbatim, and it is not ours to
            re-author. The V2 rewrite dropped it from this page entirely and kept only the
            hand-written card grid below, which is how a required notice went missing without a
            single test turning red (T-032 PR3 found it by re-pointing V1's guards at V2).

            `V2SourcesSection` is the bibliography: what this page is built on, in our words. It
            does not discharge an attribution obligation and must never be trimmed to look like
            it does. */}
        {earthquakeMeta !== null && (
          <EarthquakeAttribution
            attributions={earthquakeMeta.attributions}
            disclaimerTr={earthquakeMeta.disclaimerTr}
          />
        )}
        {/* `omit` the preparedness card: "afet çantası", "Çök-Kapan-Tutun" and the 72-hour
            protocol are `/deprem/hazirlik`'s content, and AKUT supplied nothing to this page. */}
        <V2SourcesSection scope="deprem" omit={["afad-hazirlik"]} />
      </PageContainer>
    </>
  );
}
