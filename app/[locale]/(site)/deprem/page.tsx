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
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { cn } from "@/lib/utils";
import { FAULT_IDENTITY } from "@/lib/theme/fault-identity";
import { Home, ShieldCheck, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

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
              { label: "Son Depremler", path: "/deprem" },
            ]}
            locale={locale}
            surface="trOnly"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Türkiye'de Son Depremler"
              lede={
                <>
                  Türkiye ve yakın çevresinde son günlerde olan depremler haritada. Bir depreme
                  tıkla; nerede, ne zaman, kaç büyüklüğünde ve ne kadar derinde olduğunu gör.
                </>
              }
            />

            {/* Metric Strip */}
            <StatGrid gutter="hero">
              <StatTile label="Yenilenme aralığı" fact="120 sn" tone="destructive" />
              <StatTile label="Verinin kaynağı" fact="AFAD" tone="primary" />
              <StatTile label="En küçük büyüklük filtresi" fact="M 1.0" tone="secondary" />
              <StatTile label="Geriye doğru en fazla" fact="30 gün" tone="primary" />
            </StatGrid>
          </Card>
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
              {/* NO "MTA Diri Fay Ağı" EYEBROW. It labelled this section as MTA's published
                  active-fault network, which is a stronger claim than the bibliography card it
                  matched — and the card went for lack of anything to back it. `/deprem/fay-hatlari`
                  renders `lib/earthquake/fault-lines-data.ts`: names, prose and province lists,
                  no MTA geometry. The heading below says what the section is. */}
              <h2
                id="v2-fault-lines-nav-heading"
                className="font-heading text-xl sm:text-2xl font-bold text-foreground"
              >
                Türkiye&apos;nin Üç Büyük Fay Hattı
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                Kuzey Anadolu Fayı, Doğu Anadolu Fayı ve Batı Anadolu Fay Sistemi: nasıl
                oluştukları, hangi illerden geçtikleri ve yol açtıkları büyük depremler.
              </p>
            </div>
            <Link
              href="/deprem/fay-hatlari"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0 group gap-1.5 font-bold",
              )}
            >
              <span>Fay Hatları Sayfası</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className={`p-4 rounded-2xl border ${FAULT_IDENTITY.kaf.card} space-y-1.5`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${FAULT_IDENTITY.kaf.label}`}>KAF</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${FAULT_IDENTITY.kaf.chip}`}
                >
                  Sağ Yanal Atımlı
                </span>
              </div>
              <p className="text-muted-foreground">
                Karlıova&apos;dan başlar, Marmara Denizi&apos;nin altından geçip Saros
                Körfezi&apos;ne ulaşır. Boyu 1.200 km kadar.
              </p>
            </div>
            <div className={`p-4 rounded-2xl border ${FAULT_IDENTITY.daf.card} space-y-1.5`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${FAULT_IDENTITY.daf.label}`}>DAF</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${FAULT_IDENTITY.daf.chip}`}
                >
                  Sol Yanal Atımlı
                </span>
              </div>
              <p className="text-muted-foreground">
                Hatay&apos;dan kuzeydoğuya, Kahramanmaraş, Malatya ve Elazığ üzerinden
                Karlıova&apos;ya uzanır. Orada KAF ile buluşur.
              </p>
            </div>
            <div className={`p-4 rounded-2xl border ${FAULT_IDENTITY.bafs.card} space-y-1.5`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${FAULT_IDENTITY.bafs.label}`}>BAFS</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${FAULT_IDENTITY.bafs.chip}`}
                >
                  Normal Faylar
                </span>
              </div>
              <p className="text-muted-foreground">
                Tek bir hat değil, birbirine paralel birçok fay. Gediz, Menderes ve Bakırçay ovaları
                bu fayların arasında çöken grabenlerdir.
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
                  Deprem Anında Ne Yapmalısın?
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ne yapacağını önceden bilirsen o an düşünmek zorunda kalmazsın.
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
              <span>Hazırlık Rehberinin Tamamı</span>
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
                Sağlam bir eşyanın yanında yere çök, başını ve enseni kapat, eşyaya tutun. Sarsıntı
                geçene kadar böyle bekle.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-1">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive" />
                2. Merdivene ve Asansöre Koşma
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Merdiven boşlukları binanın en zayıf yeridir. Asla merdivene koşma, asansörü
                kullanma.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-1">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" />
                3. Gazı ve Elektriği Kapat, Binadan Çık
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sarsıntı bitince doğal gaz vanasını ve elektrik şalterini kapat. Afet çantanı al,
                yürüyerek açık toplanma alanına git.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: ATTRIBUTION.
            `EarthquakeAttribution` renders the PROVIDER'S OWN wording out of the payload —
            `attributions[].requiredNoticeTr` with its `regulationReference`, plus the mandatory
            early-warning disclaimer. It is required, it is verbatim, and it is not ours to
            re-author. The V2 rewrite once dropped it from this page entirely and kept only a
            hand-written sources card, which is how a required notice went missing without a
            single test turning red (T-032 PR3 found it by re-pointing V1's guards at V2). */}
        {earthquakeMeta !== null && (
          <EarthquakeAttribution
            attributions={earthquakeMeta.attributions}
            disclaimerTr={earthquakeMeta.disclaimerTr}
          />
        )}
      </PageContainer>
    </>
  );
}
