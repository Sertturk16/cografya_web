import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbJsonLd, learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COASTAL_TYPES_DATA, NON_EXISTENT_COASTAL_TYPES } from "@/lib/marine/coastal-types-detail";
import {
  Compass,
  Home,
  ChevronRight,
  ArrowRight,
  Waves,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
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
          breadcrumbJsonLd([
            { name: "Ana Sayfa", path: "/" },
            { name: "Denizler & Kıyılar Atlası", path: "/deniz" },
            { name: "Kıyı Tipleri Atlası", path: "/deniz/kiyi-tipleri" },
          ]),
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

      {/* Breadcrumb & Hero */}
      <div className="space-y-4">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="size-3.5" />
            <span>Ana Sayfa</span>
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/deniz" className="hover:text-foreground transition-colors">
            Denizler &amp; Kıyılar Atlası
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-semibold">Kıyı Tipleri Atlası</span>
        </nav>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm" icon={<Compass className="size-3.5" />}>
                Kıyı Jeomorfolojisi
              </Badge>
              <Badge variant="secondary" size="sm">
                6 Temel Kıyı Tipi
              </Badge>
            </div>

            <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
              Türkiye&apos;nin Kıyı Tipleri &amp; Jeomorfolojisi
            </h1>

            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Dağların kıyı çizgisine göre uzanış doğrultusu, tektonik hareketler ve Dördüncü Zaman
              deniz seviyesi yükselmeleri (östatizma) sonucunda şekillenen Türkiye kıyıları. Görülen
              6 temel tip ile enlem ve iç deniz koşulları nedeniyle ülkemizde rastlanmayan kıyı
              tipleri.
            </p>

            <div className="pt-2">
              <Link
                href="/deniz"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center gap-2 text-xs",
                )}
              >
                <Waves className="size-3.5" />
                <span>Ana Deniz Atlası &amp; Telemetriye Dön</span>
              </Link>
            </div>
          </div>

          {/* Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                8.333 km
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Toplam Kıyı Uzunluğu (HGM)
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="font-heading text-2xl sm:text-3xl font-bold text-teal-600 block">
                6 Kıyı Tipi
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Morfogenetik Çeşitlilik
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                28 İl
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Denize Kıyısı Olan Şehir
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="font-heading text-2xl sm:text-3xl font-bold text-destructive block">
                3 Tip Yok
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Fiyort, Skyer &amp; Haliç (Watt)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6 COASTAL TYPES DETAILED SECTIONS */}
      <section aria-labelledby="existing-coastal-types-heading" className="space-y-8">
        <div className="border-b border-border pb-3">
          <h2
            id="existing-coastal-types-heading"
            className="font-heading text-2xl sm:text-3xl font-bold text-foreground"
          >
            Türkiye&apos;de Görülen 6 Temel Kıyı Tipi
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Oluşum mekanizmaları, morfolojik unsurları ve Türkiye&apos;deki en tipik coğrafi
            örnekleri.
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
                    <Badge variant="primary" size="sm">
                      {ct.badge}
                    </Badge>
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
                  <span>Oluşum Süreci ve Nedenselliği</span>
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {ct.formation}
                </p>
              </div>

              {/* Characteristics */}
              <div className="space-y-2.5">
                <h4 className="font-heading text-sm font-bold text-foreground">
                  Belirleyici Morfolojik Özellikler:
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
                  <span>Türkiye&apos;deki Tipik Örnekleri:</span>
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
          <div className="flex items-center gap-2">
            <Badge variant="destructive" size="sm" icon={<AlertCircle className="size-3.5" />}>
              Müfredat &amp; Sınav Odaklı Analiz
            </Badge>
            <span className="text-xs text-muted-foreground font-semibold">
              Neden – Sonuç İlişkisi
            </span>
          </div>
          <h2
            id="non-existent-types-heading"
            className="font-heading text-2xl sm:text-3xl font-bold text-foreground"
          >
            Türkiye&apos;de Görülmeyen Kıyı Tipleri ve Coğrafi Nedenleri
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            YKS ve KPSS Coğrafya sınavlarında en sık sorulan eleyici soru kalıbı: Türkiye
            kıyılarında fiyort, skyer ve haliç (watt) tipi kıyılara neden rastlanmaz?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {NON_EXISTENT_COASTAL_TYPES.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-base text-foreground">{item.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-destructive/10 text-destructive font-bold">
                    Görülmez
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{item.formation}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/80">
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground space-y-1">
                  <span className="font-bold text-foreground block">
                    Türkiye&apos;de Görülmeme Sebebi:
                  </span>
                  <p className="text-[11px] leading-relaxed">{item.whyNotInTurkey}</p>
                </div>

                <span className="text-[11px] text-muted-foreground block pt-1">
                  <strong>Dünyadaki Emsalleri:</strong> {item.globalExamples}
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
            Deniz Havzaları Atlasını Keşfedin
          </h3>
          <p className="text-xs text-muted-foreground">
            Kıyı tiplerinin şekillendiği 4 denizin canlı telemetri ve hidrografik profilleri.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/deniz/karadeniz"
            className="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500 transition-all text-xs group block"
          >
            <span className="font-bold text-cyan-700 dark:text-cyan-300 block group-hover:underline">
              Karadeniz
            </span>
            <span className="text-[10px] text-muted-foreground">Boyuna Kıyı &amp; Falez</span>
          </Link>

          <Link
            href="/deniz/marmara"
            className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:border-amber-500 transition-all text-xs group block"
          >
            <span className="font-bold text-amber-700 dark:text-amber-300 block group-hover:underline">
              Marmara Denizi
            </span>
            <span className="text-[10px] text-muted-foreground">Ria, Lagün &amp; Tombolo</span>
          </Link>

          <Link
            href="/deniz/ege"
            className="p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5 hover:border-teal-500 transition-all text-xs group block"
          >
            <span className="font-bold text-teal-700 dark:text-teal-300 block group-hover:underline">
              Ege Denizi
            </span>
            <span className="text-[10px] text-muted-foreground">Enine Kıyı &amp; Graben</span>
          </Link>

          <Link
            href="/deniz/akdeniz"
            className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 hover:border-rose-500 transition-all text-xs group block"
          >
            <span className="font-bold text-rose-700 dark:text-rose-300 block group-hover:underline">
              Akdeniz
            </span>
            <span className="text-[10px] text-muted-foreground">Dalmaçya &amp; Kalanklı</span>
          </Link>
        </div>
      </section>

      {/* Sources Section */}
      <V2SourcesSection scope="deniz" />
    </>
  );
}
