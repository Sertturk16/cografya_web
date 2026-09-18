import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { cn } from "@/lib/utils";
import { PREPAREDNESS_DATA } from "@/lib/earthquake/preparedness-data";
import { ShieldCheck, Home, ArrowLeft, PhoneCall, CheckCircle2, AlertOctagon } from "lucide-react";
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
    hrefForLocale: () => "/deprem/hazirlik",
    title: "Deprem Hazırlık Rehberi: Öncesi, Sırası ve Sonrası Hayatta Kalma Kılavuzu",
    description:
      "AFAD ve AKUT standartlarında kapsamlı afet bilinci kılavuzu. Eşya sabitleme, afet çantası, Çök-Kapan-Tutun tekniği, ilk 72 saat ve toplanma alanları.",
  });
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
            name: "Deprem Öncesi, Sırası ve Sonrası Kapsamlı Hazırlık Kılavuzu",
            description:
              "Deprem öncesi yaşam alanı sabitlemeleri, afet çantası, sarsıntı anı doğru davranışları ve ilk 72 saatlik tahliye adımları.",
            path: "/deprem/hazirlik",
            locale,
            learningResourceType: "Article",
            teaches: "Temel afet bilinci, deprem çantası hazırlığı ve hayatta kalma refleksleri",
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
              { label: "Canlı Deprem Monitörü", href: "/deprem", path: "/deprem" },
              { label: "Deprem Hazırlık Rehberi", path: "/deprem/hazirlik" },
            ]}
            locale={locale}
            surface="trOnly"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Deprem Hazırlık & Hayatta Kalma Rehberi"
              badges={
                <>
                  <Badge variant="primary" size="sm" icon={<ShieldCheck className="size-3.5" />}>
                    Temel Afet Bilinci
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    AFAD &amp; AKUT Standartları
                  </Badge>
                </>
              }
              lede={
                <>
                  Deprem anında panik yerine doğru refleksi sergileyebilmek için bilimsel, pedagojik
                  ve uygulanabilir adımlar. Sarsıntı öncesinde yaşam alanını güvenli kılma, sarsıntı
                  esnasında Çök-Kapan-Tutun disiplini ve sarsıntı sonrasındaki kritik ilk 72 saat.
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
                <span>Canlı Deprem Monitörüne Dön</span>
              </Link>
            </PageHero>

            {/* Metric Strip */}
            {/* Already all bridge tokens — this strip diverges from the sibling rotation in
                WHICH tone each tile takes, not in whether the tone is themed. Preserved
                exactly: `destructive` on the 72-hour figure and `secondary` on the drill are
                the copy's meaning, not an accident of position. */}
            <StatGrid gutter="hero">
              <StatTile label="Eşya Sabitlemeyle Önlenebilir Yaralanma" fact="%50" tone="primary" />
              <StatTile label="Kendi Kendine Yetebilme Süresi" fact="72 Saat" tone="destructive" />
              <StatTile label="Çök – Kapan – Tutun" fact="3 Adım" tone="secondary" />
              <StatTile label="Tek Acil Çağrı Numarası" fact="112" tone="primary" />
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
                <div className="flex items-center gap-2">
                  <Badge variant={phase.badgeVariant} size="sm">
                    {phase.badge}
                  </Badge>
                </div>
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
                        <span className="font-bold text-foreground block">
                          Uygulama ve Kontrol Adımları:
                        </span>
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
                      <div className="ml-10 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                        <AlertOctagon className="size-4 shrink-0 text-amber-600 mt-0.5" />
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
                Acil Durum İletişim Protokolü
              </h3>
              <p className="text-xs text-muted-foreground">
                Afet anında tüm aramalar tek bir merkezde toplanır.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="font-bold text-foreground text-sm block">112 Acil Çağrı</span>
              <p className="text-muted-foreground">
                Ambulans, İtfaiye, AFAD ve Polis için Türkiye genelinde tek numaradır. Gereksiz yere
                meşgul etmeyin.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="font-bold text-foreground text-sm block">
                e-Devlet Toplanma Alanı
              </span>
              <p className="text-muted-foreground">
                İkametgâhınıza en yakın afet toplanma alanını e-Devlet AFAD kapısından öğrenin.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="font-bold text-foreground text-sm block">
                SMS &amp; Veri İletişimi
              </span>
              <p className="text-muted-foreground">
                Şebekeleri tıkamamak için yakınlarınıza sesli arama yerine kısa mesajla durumunuzu
                iletin.
              </p>
            </div>
          </div>
        </div>

        {/* Sources Section */}
        <V2SourcesSection scope="deprem" />
      </PageContainer>
    </>
  );
}
