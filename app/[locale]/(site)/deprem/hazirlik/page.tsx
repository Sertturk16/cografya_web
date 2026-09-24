import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { EarthquakeAttribution } from "@/components/earthquake/earthquake-attribution";
import { getEarthquakeMetaSafe } from "@/lib/api/earthquakes";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { ProseSkeleton } from "@/components/patterns/page-skeleton";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { cn } from "@/lib/utils";
import { PREPAREDNESS_DATA } from "@/lib/earthquake/preparedness-data";
import { Home, ArrowLeft, PhoneCall, CheckCircle2, AlertOctagon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SOURCE_NOTE } from "@/components/patterns/source-note";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => "/deprem/hazirlik",
    title: "Deprem Hazırlık Rehberi: Öncesi, Sırası ve Sonrası",
    description:
      "AFAD'ın önerilerine dayanan deprem hazırlık rehberi: eşyaları sabitle, afet çantası hazırla, sarsıntıda çök-kapan-tutun. İlk 72 saat ve toplanma alanları.",
  });
}

// The live ticker in this page's chrome shows AFAD's latest magnitude, so the page carries
// AFAD's notice and the early-warning disclaimer exactly as `/deprem` does.
async function AfadAttribution() {
  const earthquakeMeta = await getEarthquakeMetaSafe();
  if (earthquakeMeta === null) return null;
  return (
    <EarthquakeAttribution
      attributions={earthquakeMeta.attributions}
      disclaimerTr={earthquakeMeta.disclaimerTr}
    />
  );
}

export default async function V2PreparednessPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          learningResourceJsonLd({
            name: "Deprem Hazırlık Rehberi: Öncesi, Sırası ve Sonrası",
            description:
              "Depremden önce evdeki eşyaları sabitlemek, afet çantası, sarsıntı anında ne yapılacağı ve depremden sonraki ilk 72 saat.",
            path: "/deprem/hazirlik",
            locale,
            learningResourceType: "Article",
            teaches:
              "Deprem çantası hazırlığı, sarsıntı anında doğru davranış ve depremden sonraki ilk adımlar",
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
              { label: "Son Depremler", href: "/deprem", path: "/deprem" },
              { label: "Deprem Hazırlık Rehberi", path: "/deprem/hazirlik" },
            ]}
            locale={locale}
            surface="trOnly"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Depreme Hazırlık Rehberi"
              lede={
                <>
                  Üç bölüm var: deprem gelmeden evini ve aileni nasıl hazırlayacağın, sarsıntı
                  sırasında Çök-Kapan-Tutun&apos;u nasıl uygulayacağın ve sarsıntıdan sonraki ilk 72
                  saatte neler yapacağın.
                </>
              }
            >
              <Link
                href="/deprem"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center gap-2 text-xs",
                )}
              >
                <ArrowLeft className="size-3.5" />
                <span>Son Depremlere Dön</span>
              </Link>
            </PageHero>

            {/* Metric Strip */}
            {/* Already all bridge tokens — this strip diverges from the sibling rotation in
                WHICH tone each tile takes, not in whether the tone is themed. Preserved
                exactly: `destructive` on the 72-hour figure and `secondary` on the drill are
                the copy's meaning, not an accident of position. */}
            <StatGrid gutter="hero">
              <StatTile label="Kişi başı günlük su, en az" fact="2,5 litre" tone="primary" />
              <StatTile
                label="Yardım gelene kadar geçebilecek süre"
                fact="72 saat"
                tone="destructive"
              />
              <StatTile label="Çök, kapan, tutun" fact="3 adım" tone="secondary" />
              <StatTile label="Tüm acil durumlar için tek numara" fact="112" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* 3 PREPAREDNESS PHASES ACCORDION-FREE RICH PROSE */}
        <div className="space-y-12">
          {PREPAREDNESS_DATA.map((phase) => (
            <section
              key={phase.id}
              id={phase.id}
              className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-lg space-y-8"
            >
              {/* Phase Header */}
              <div className="border-b border-border pb-5 space-y-2">
                <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                  {phase.title}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {phase.summary}
                </p>
              </div>

              {/* Sub-Sections */}
              <div className="space-y-8">
                {phase.subSections.map((sub, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="size-7 rounded-lg bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <h3 className="font-heading text-base sm:text-lg font-bold text-foreground">
                          {sub.title}
                        </h3>
                        <span className="text-xs text-muted-foreground block">{sub.summary}</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-10">
                      {sub.content}
                    </p>

                    {/* Action Points / Checklists if present */}
                    {sub.actionPoints && sub.actionPoints.length > 0 && (
                      <div className="ml-10 p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2 text-xs">
                        <span className="font-bold text-foreground block">Aklında tut:</span>
                        <ul className="space-y-1.5 text-muted-foreground">
                          {sub.actionPoints.map((pt, j) => (
                            <li key={j} className="flex items-start gap-2">
                              <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Callout Notice if present */}
                    {sub.callout && (
                      <div className="ml-10 p-4 rounded-2xl bg-warning/10 border border-warning/30 text-xs text-warning-strong flex items-start gap-2.5">
                        <AlertOctagon className="size-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{sub.callout}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* EMERGENCY CONTACT & INSTITUTIONAL STRIP */}
        <div className="p-6 sm:p-8 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/5 via-card to-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <PhoneCall className="size-6" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">
                Acil Durumda İletişim
              </h3>
              <p className="text-xs text-muted-foreground">
                Hatlar kısa sürede dolar. Kimi arayacağını ve nasıl haber vereceğini şimdiden bil.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="font-bold text-foreground text-sm block">112 Acil Çağrı</span>
              <p className="text-muted-foreground">
                Ambulans, itfaiye, AFAD ve polis için Türkiye&apos;nin her yerinde tek numara.
                Gerçek bir acil durum yoksa hattı meşgul etme.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="font-bold text-foreground text-sm block">Toplanma Alanın</span>
              <p className="text-muted-foreground">
                Evine en yakın afet toplanma alanını e-Devlet&apos;te AFAD&apos;ın sayfasından
                öğren.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="font-bold text-foreground text-sm block">Kısa Mesaj</span>
              <p className="text-muted-foreground">
                Şebekeyi tıkamamak için yakınlarını arama; nasıl olduğunu kısa mesajla yaz.
              </p>
            </div>
          </div>
        </div>
        <p className={`${SOURCE_NOTE} mb-3`}>
          Buradaki öneriler AFAD&apos;ın deprem hazırlık önerilerini izler:{" "}
          <a href="https://www.afad.gov.tr" target="_blank" rel="noopener noreferrer">
            afad.gov.tr
          </a>
        </p>
        <Suspense fallback={<ProseSkeleton lines={2} heading={false} />}>
          <AfadAttribution />
        </Suspense>
      </PageContainer>
    </>
  );
}
