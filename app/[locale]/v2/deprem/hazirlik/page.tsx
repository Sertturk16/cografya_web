import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbJsonLd, learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PREPAREDNESS_DATA } from "@/lib/earthquake/preparedness-data";
import {
  ShieldCheck,
  Home,
  ChevronRight,
  ArrowLeft,
  PhoneCall,
  CheckCircle2,
  AlertOctagon,
} from "lucide-react";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => "/v2/deprem/hazirlik",
    title: "Deprem Hazırlık Rehberi: Öncesi, Sırası ve Sonrası Hayatta Kalma Kılavuzu",
    description:
      "AFAD ve AKUT standartlarında kapsamlı afet bilinci kılavuzu. Eşya sabitleme, afet çantası, Çök-Kapan-Tutun tekniği, ilk 72 saat ve toplanma alanları.",
  });
}

export default async function V2PreparednessPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 overflow-x-clip">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          breadcrumbJsonLd([
            { name: "Ana Sayfa", path: "/v2" },
            { name: "Canlı Deprem Monitörü", path: "/v2/deprem" },
            { name: "Deprem Hazırlık Rehberi", path: "/v2/deprem/hazirlik" },
          ]),
          learningResourceJsonLd({
            name: "Deprem Öncesi, Sırası ve Sonrası Kapsamlı Hazırlık Kılavuzu",
            description:
              "Deprem öncesi yaşam alanı sabitlemeleri, afet çantası, sarsıntı anı doğru davranışları ve ilk 72 saatlik tahliye adımları.",
            path: "/v2/deprem/hazirlik",
            locale,
            learningResourceType: "Article",
            teaches: "Temel afet bilinci, deprem çantası hazırlığı ve hayatta kalma refleksleri",
          }),
        ]}
      />

      <V2Header />
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-12">
        {/* Breadcrumb & Hero */}
        <div className="space-y-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/v2"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <Link href="/v2/deprem" className="hover:text-foreground transition-colors">
              Canlı Deprem Monitörü
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Deprem Hazırlık Rehberi</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<ShieldCheck className="size-3.5" />}>
                  Temel Afet Bilinci
                </Badge>
                <Badge variant="secondary" size="sm">
                  AFAD &amp; AKUT Standartları
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
                Deprem Hazırlık &amp; Hayatta Kalma Rehberi
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Deprem anında panik yerine doğru refleksi sergileyebilmek için bilimsel, pedagojik
                ve uygulanabilir adımlar. Sarsıntı öncesinde yaşam alanını güvenli kılma, sarsıntı
                esnasında Çök-Kapan-Tutun disiplini ve sarsıntı sonrasındaki kritik ilk 72 saat.
              </p>

              <div className="pt-2">
                <Link
                  href="/v2/deprem"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex items-center gap-2 text-xs",
                  )}
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Canlı Deprem Monitörüne Dön</span>
                </Link>
              </div>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  %50
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Eşya Sabitlemeyle Önlenebilir Yaralanma
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-destructive block">
                  72 Saat
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Kendi Kendine Yetebilme Süresi
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  3 Adım
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Çök – Kapan – Tutun
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  112
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Tek Acil Çağrı Numarası
                </span>
              </div>
            </div>
          </div>
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
      </main>

      <V2Footer />
    </div>
  );
}
