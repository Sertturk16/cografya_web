import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbJsonLd, learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FAULT_LINES_DATA } from "@/lib/earthquake/fault-lines-data";
import {
  Layers,
  Home,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Clock,
  Waves,
  Activity,
  ArrowLeft,
  Info,
} from "lucide-react";

export const revalidate = 86400;

interface FaultLinesPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: FaultLinesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => "/deprem/fay-hatlari",
    title: "Türkiye'nin Ana Fay Hatları: KAF, DAF ve BAFS Sismotektonik Atlası",
    description:
      "Kuzey Anadolu Fayı, Doğu Anadolu Fayı ve Batı Anadolu Fay Sistemi'nin tektonik oluşumu, geçtiği iller, tarihsel büyük depremler ve sismik riskleri.",
  });
}

export default async function FaultLinesPage({ params }: FaultLinesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          breadcrumbJsonLd([
            { name: "Ana Sayfa", path: "/" },
            { name: "Canlı Deprem Monitörü", path: "/deprem" },
            { name: "Türkiye'nin Fay Hatları", path: "/deprem/fay-hatlari" },
          ]),
          learningResourceJsonLd({
            name: "Türkiye'nin Ana Fay Hatları Sismotektonik Atlası",
            description:
              "Kuzey Anadolu Fayı (KAF), Doğu Anadolu Fayı (DAF) ve Batı Anadolu Fay Sistemi (BAFS) tektonik analizi.",
            path: "/deprem/fay-hatlari",
            locale,
            learningResourceType: "Article",
            teaches: "Fay hatları, tektonik levhalar, segment kırılmaları ve sismik risk",
          }),
        ]}
      />

      <V2LiveTicker />

      <PageContainer>
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
            <Link href="/deprem" className="hover:text-foreground transition-colors">
              Canlı Deprem Monitörü
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Türkiye&apos;nin Fay Hatları</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" size="sm" icon={<Layers className="size-3.5" />}>
                  Sismotektonik Atlası
                </Badge>
                <Badge variant="secondary" size="sm">
                  3 Ana Kırık Sistemi
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
                Türkiye&apos;nin Ana Fay Hatları: KAF, DAF ve BAFS
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Avrasya, Afrika ve Arap levhalarının kıskacındaki Anadolu levhacığının sismik
                omurgası. Fayların oluşum mekanizmaları, geçtiği iller, segment kırılmaları ve
                tarihsel büyük depremler.
              </p>

              <div className="pt-2">
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
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-red-600 block">
                  1.200 km
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  KAF Toplam Uzunluk
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-blue-600 block">
                  550 km
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  DAF Toplam Uzunluk
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-emerald-600 block">
                  8 Graben
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  BAFS Çöküntü Havzası
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  25 mm/yıl
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Batıya Doğru Kaçış
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 FAULT SYSTEMS DETAILED CARDS */}
        <div className="space-y-10">
          {FAULT_LINES_DATA.map((fault) => (
            <article
              key={fault.id}
              id={fault.id}
              className={`rounded-3xl border ${fault.borderClass} bg-card p-6 sm:p-10 shadow-lg space-y-8`}
            >
              {/* Fault Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${fault.badgeClass}`}
                    >
                      {fault.type}
                    </span>
                    <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertTriangle className="size-3.5" /> Sismik Risk: {fault.riskLevel}
                    </span>
                  </div>
                  <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                    {fault.name}
                  </h2>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-muted/50 border border-border/80 text-right">
                  <span className="text-[10px] text-muted-foreground font-medium block">
                    Hattın Uzunluğu
                  </span>
                  <span className="font-heading text-xl font-bold text-foreground">
                    ~{fault.lengthKm} km
                  </span>
                </div>
              </div>

              {/* Formation & Movement Mechanism */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
                  <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                    <Activity className={`size-4.5 ${fault.accentColor}`} />
                    <span>Tektonik Oluşum ve Levha Sınırı</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {fault.formation}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
                  <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                    <Layers className={`size-4.5 ${fault.accentColor}`} />
                    <span>Faylanma ve Hareket Mekanizması</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {fault.movementMechanism}
                  </p>
                </div>
              </div>

              {/* Segments */}
              <div className="space-y-3">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Ana Segmentler ve Kırık Zonu Kolları
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fault.segments.map((seg, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1"
                    >
                      <span className="font-bold text-xs text-foreground block">{seg.name}</span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {seg.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provinces Traversed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    <span>Hattın Geçtiği ve Etkilediği İller</span>
                  </h3>
                  <span className="text-xs text-muted-foreground">{fault.provinces.length} İl</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {fault.provinces.map((prov) => (
                    <Link
                      key={prov.plate}
                      href={
                        `/turkiye/${prov.slug}` as unknown as React.ComponentProps<
                          typeof Link
                        >["href"]
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-border text-xs font-semibold hover:border-primary hover:text-primary transition-colors group"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground group-hover:text-primary">
                        {prov.plate}
                      </span>
                      <span>{prov.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Historical Earthquakes Table */}
              <div className="space-y-3">
                <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                  <Clock className="size-4 text-secondary" />
                  <span>Tarihsel Büyük Depremler ve Sismik Enerji Boşalımları</span>
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-border/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="p-3">Yıl</th>
                        <th className="p-3">Merkez / Bölge</th>
                        <th className="p-3">Büyüklük</th>
                        <th className="p-3">Sismik Etki &amp; Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {fault.historicalEarthquakes.map((eq, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-mono font-bold text-foreground">{eq.year}</td>
                          <td className="p-3 font-semibold text-foreground">{eq.place}</td>
                          <td className="p-3 font-mono font-bold text-destructive">
                            {eq.magnitude}
                          </td>
                          <td className="p-3 text-muted-foreground leading-relaxed">{eq.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seismic Gap & Risk Alert */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Info className="size-4" />
                  <span>Sismik Boşluk &amp; Gelecek Tehlike Değerlendirmesi</span>
                </span>
                <p className="text-muted-foreground leading-relaxed pl-5.5">
                  {fault.seismicGapAndRisk}
                </p>
              </div>

              {/* Marine Connection Box (if any) */}
              {fault.marineConnection && (
                <div className="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-300">
                    <Waves className="size-4 shrink-0" />
                    <span>
                      <strong>Denizaltı Fayı Bağlantısı:</strong>{" "}
                      {fault.marineConnection.description}
                    </span>
                  </div>
                  <Link
                    href={
                      fault.marineConnection.href as unknown as React.ComponentProps<
                        typeof Link
                      >["href"]
                    }
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "shrink-0 font-bold text-xs",
                    )}
                  >
                    <span>{fault.marineConnection.seaName} Sayfası →</span>
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>

        {/* Back to Live Monitor CTA */}
        <div className="p-6 rounded-3xl border border-border bg-gradient-to-r from-card via-muted/30 to-card flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              Anlık Sismik Hareketleri Harita Üzerinde İzleyin
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              AFAD istasyonlarından 120 saniyede bir güncellenen son depremler verisi.
            </p>
          </div>
          <Link
            href="/deprem"
            className={cn(
              buttonVariants({ variant: "primary" }),
              "flex items-center gap-2 font-bold",
            )}
          >
            <span>Canlı Deprem Radarına Git</span>
            <Activity className="size-4" />
          </Link>
        </div>

        {/* Sources Section. `omit` the preparedness card — see `/deprem`.
            The two AFAD seismic cards are DELIBERATELY LEFT: this page renders no earthquake
            events of its own, but `V2LiveTicker` publishes AFAD magnitudes in its chrome, and
            whether a ticker-only value earns a citation is the same single question as whether
            it owes one (see `components/marine/marine-attribution-coverage.test.ts`). Answering
            it here and nowhere else would split one decision across 33 pages. */}
        <V2SourcesSection scope="deprem" omit={["afad-hazirlik"]} />
      </PageContainer>
    </>
  );
}
