import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { BASIN_IDENTITY } from "@/lib/theme/basin-identity";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { cn } from "@/lib/utils";
import { COASTAL_TYPES_DATA, NON_EXISTENT_COASTAL_TYPES } from "@/lib/marine/coastal-types-detail";
import { Home, ArrowRight, Waves, Sparkles, MapPin, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => "/deniz/kiyi-tipleri",
    title: "Türkiye'nin Kıyı Tipleri Atlası: Boyuna, Enine, Ria, Dalmaçya & Lagün Kıyıları",
    description:
      "Türkiye'de görülen 6 temel kıyı tipi (boyuna, enine, ria, dalmaçya, lagün, kalanklı) ve Türkiye'de görülmeyen kıyı tipleri (fiyort, haliç) jeomorfoloji rehberi.",
  });
}

export default async function V2CoastalTypesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          learningResourceJsonLd({
            name: "Türkiye'nin Kıyı Tipleri ve Kıyı Jeomorfolojisi Atlası",
            description:
              "Dağların uzanış doğrultusu ve deniz seviyesi değişimlerine göre şekillenen kıyı tipleri analizi.",
            path: "/deniz/kiyi-tipleri",
            locale,
            learningResourceType: "Article",
            teaches: "Kıyı tipleri, falezler, kıta sahanlığı, tombolo, lagün ve jeomorfoloji",
          }),
        ]}
      />

      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Denizler ve Kıyılar", href: "/deniz", path: "/deniz" },
              { label: "Kıyı Tipleri", path: "/deniz/kiyi-tipleri" },
            ]}
            locale={locale}
            surface="trOnly"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Türkiye'nin Kıyı Tipleri"
              lede={
                <>
                  Türkiye&apos;nin kıyılarını üç şey şekillendirdi: dağların kıyıya paralel mi dik
                  mi uzandığı, yer kabuğunun nerede çöktüğü ve Dördüncü Zaman&apos;da yükselen
                  denizin hangi vadileri doldurduğu. Türkiye&apos;de görülen altı kıyı tipi aşağıda;
                  enlem ya da kapalı deniz yüzünden burada hiç görülmeyenler de en sonda.
                </>
              }
            >
              <Link
                href="/deniz"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center gap-2 text-xs",
                )}
              >
                <Waves className="size-3.5" />
                <span>Denizler Sayfasına Dön</span>
              </Link>
            </PageHero>

            {/* Metric Strip */}
            {/* `tone="secondary"` was a raw teal-600 text class, which is FROZEN: measured
                #009689 in both themes, 3.67:1 on the light card and 4.64:1 on the dark one,
                while its three siblings move with the theme and hold ~5-6:1 in each. (Large
                bold text, 3:1 floor, so it passed AA; the defect was the freeze, not the
                ratio.) `secondary` is the tone the sibling strips write in this slot.

                CONVERTED BECAUSE OF THE ENTITY, NOT THE PAGE — and this page is the proof that
                the page-scoped question is the wrong one. The Aegean encoding IS on this page:
                the Ege Denizi link card ~180 lines below wears `--basin-ege`, because a basin
                has one colour site-wide. What decides it is that COASTAL TYPES carry no colour
                anywhere — `lib/marine/coastal-types-detail.ts` has no colour field and the six
                type articles render a plain bordered card — so a teal tile here meant nothing,
                and sitting it above the Ege card was a false signal the conversion removes.

                T-031c NOTE: `--basin-ege` is no longer the same value as the teal this tile
                used to carry. The shipped basin set failed the categorical floor under
                tritanopia on cyan/teal, so Ege moved one step down its own family; see the
                `--basin-*` block in `app/globals.css`. The argument above is unaffected — it
                was never about which teal, only about whether this tile encodes anything. */}
            <StatGrid gutter="hero">
              <StatTile label="Toplam Kıyı Uzunluğu (HGM)" fact="8.333 km" tone="primary" />
              <StatTile label="Türkiye'de Görülen" fact="6 Kıyı Tipi" tone="secondary" />
              <StatTile label="Denize Kıyısı Olan İl" fact="28 İl" tone="accent" />
              <StatTile label="Fiyort, Skyer, Haliç ve Watt" fact="Görülmez" tone="destructive" />
            </StatGrid>
          </Card>
        </div>

        {/* 6 COASTAL TYPES DETAILED SECTIONS */}
        <section aria-labelledby="existing-coastal-types-heading" className="space-y-8">
          <div className="border-b border-border pb-3">
            <h2
              id="existing-coastal-types-heading"
              className="font-heading text-2xl sm:text-3xl font-bold text-foreground"
            >
              Türkiye&apos;de Görülen Altı Kıyı Tipi
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Her birinin nasıl oluştuğu, nasıl tanınacağı ve Türkiye&apos;de nerede görüleceği.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {COASTAL_TYPES_DATA.map((ct) => (
              <article
                key={ct.id}
                id={ct.id}
                className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground font-mono">{ct.regions}</span>
                    </div>
                    <h3 className="font-heading text-2xl font-bold text-foreground">{ct.name}</h3>
                  </div>

                  {/* Sea Links */}
                  <div className="flex flex-wrap gap-2">
                    {ct.seaLinks.map((link, j) => (
                      <Link
                        key={j}
                        href={link.href as unknown as React.ComponentProps<typeof Link>["href"]}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "inline-flex items-center gap-1 text-xs font-semibold",
                        )}
                      >
                        <span>{link.label}</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Formation Mechanism */}
                <div className="space-y-2">
                  <h4 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span>Nasıl Oluşur?</span>
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {ct.formation}
                  </p>
                </div>

                {/* Characteristics */}
                <div className="space-y-2.5">
                  <h4 className="font-heading text-sm font-bold text-foreground">
                    Tanıma İşaretleri:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {ct.characteristics.map((feat, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-xs text-muted-foreground flex items-start gap-2.5 leading-relaxed"
                      >
                        <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Turkey Examples */}
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-1.5 text-xs">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    <span>Türkiye&apos;de Nerede Görülür:</span>
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                    {ct.turkeyExamples.map((ex, k) => (
                      <li key={k}>{ex}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* NON-EXISTENT COASTAL TYPES SPECIAL PEDAGOGICAL SECTION */}
        <section
          aria-labelledby="non-existent-types-heading"
          className="rounded-3xl border border-destructive/30 bg-gradient-to-b from-destructive/5 via-card to-card p-6 sm:p-10 shadow-md space-y-6"
        >
          <div className="border-b border-destructive/20 pb-4 space-y-1">
            <h2
              id="non-existent-types-heading"
              className="font-heading text-2xl sm:text-3xl font-bold text-foreground"
            >
              Türkiye&apos;de Görülmeyen Kıyı Tipleri
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Türkiye kıyılarında fiyort, skyer, haliç ve watt yok. İlk ikisini enlem, son ikisini
              denizlerimizin kapalı olması açıklıyor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {NON_EXISTENT_COASTAL_TYPES.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-base text-foreground">{item.name}</h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">{item.formation}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/80">
                  <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground space-y-1">
                    <span className="font-bold text-foreground block">
                      Türkiye&apos;de Neden Yok:
                    </span>
                    <p className="text-[11px] leading-relaxed">{item.whyNotInTurkey}</p>
                  </div>

                  <span className="text-[11px] text-muted-foreground block pt-1">
                    <strong>Dünyada Nerede Var:</strong> {item.globalExamples}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CROSS NAVIGATION TO 4 SEAS */}
        <section className="p-6 sm:p-8 rounded-3xl border border-border bg-gradient-to-r from-card via-muted/30 to-card space-y-4">
          <div className="space-y-1">
            <h3 className="font-heading text-lg font-bold text-foreground">
              Kıyıları Denize Göre İncele
            </h3>
            <p className="text-xs text-muted-foreground">
              Her denizin sayfasında kıyı şekilleri, akıntılar, akarsular ve kıyı illeri var.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/deniz/karadeniz"
              className={`p-4 rounded-2xl border ${BASIN_IDENTITY.karadeniz.linkCard} transition-all text-xs group block`}
            >
              <span
                className={`font-bold ${BASIN_IDENTITY.karadeniz.label} block group-hover:underline`}
              >
                Karadeniz
              </span>
              <span className="text-[10px] text-muted-foreground">Boyuna kıyı ve falezler</span>
            </Link>

            <Link
              href="/deniz/marmara"
              className={`p-4 rounded-2xl border ${BASIN_IDENTITY.marmara.linkCard} transition-all text-xs group block`}
            >
              <span
                className={`font-bold ${BASIN_IDENTITY.marmara.label} block group-hover:underline`}
              >
                Marmara Denizi
              </span>
              <span className="text-[10px] text-muted-foreground">Ria, lagün ve tombolo</span>
            </Link>

            <Link
              href="/deniz/ege"
              className={`p-4 rounded-2xl border ${BASIN_IDENTITY.ege.linkCard} transition-all text-xs group block`}
            >
              <span className={`font-bold ${BASIN_IDENTITY.ege.label} block group-hover:underline`}>
                Ege Denizi
              </span>
              <span className="text-[10px] text-muted-foreground">Enine kıyı ve grabenler</span>
            </Link>

            <Link
              href="/deniz/akdeniz"
              className={`p-4 rounded-2xl border ${BASIN_IDENTITY.akdeniz.linkCard} transition-all text-xs group block`}
            >
              <span
                className={`font-bold ${BASIN_IDENTITY.akdeniz.label} block group-hover:underline`}
              >
                Akdeniz
              </span>
              <span className="text-[10px] text-muted-foreground">Dalmaçya ve kalanklı kıyı</span>
            </Link>
          </div>
        </section>
      </PageContainer>
    </>
  );
}
