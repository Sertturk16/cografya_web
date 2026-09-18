"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import type { SeaBasinDetailData } from "@/lib/marine/sea-basins-detail";
import type { MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BreadcrumbsNav, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs-nav";
// Safe from a Client Component: `PageHero` reaches only `typography.tsx` and `lib/utils`, and
// neither imports `server-only` — the boundary `components/patterns/rsc-boundary.test.ts` enforces.
import { PageHero } from "@/components/patterns/page-hero";
import { cn } from "@/lib/utils";
import {
  Waves,
  Droplets,
  Compass,
  MapPin,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Anchor,
  CloudRain,
  Mountain,
} from "lucide-react";
import { Card } from "@/components/ui/card";
type LinkHref = React.ComponentProps<typeof Link>["href"];

/**
 * What this view actually needs of a basin — everything except `faq`.
 *
 * WHY THE FIELD IS EXCLUDED RATHER THAN IGNORED. This is a Client Component, so every field of
 * every prop it is handed is serialised into the Flight payload embedded in the page's HTML,
 * whether the component reads it or not. PR5 moved the FAQ out of this file and onto the `faq`
 * prop below, and nothing here has read `data.faq` since — but all four basin pages went on
 * passing the whole `basinData`, so three Turkish question/answer pairs per basin kept shipping
 * to the browser on every basin page, in BOTH locales. On the EN twins that was untranslated
 * prose reaching a page whose FAQ block is deliberately hidden; on the TR ones it was simply
 * weight for a component that never looks at it.
 *
 * `Omit` is the whole fix, and it only works because the pages STRIP THE FIELD AT RUNTIME
 * (`const { faq, ...view } = basinData`). TypeScript's excess-property check fires on object
 * LITERALS, never on a variable that happens to hold a wider object, so a page passing
 * `basinData` straight through would still type-check here and still serialise `faq`. The type
 * states the contract; the destructure is what enforces it.
 */
export type SeaBasinViewData = Omit<SeaBasinDetailData, "faq">;

interface V2SeaBasinDetailViewProps {
  data: SeaBasinViewData;
  marinePoints: MarinePointData[];
  /**
   * The SAME array the page's own `breadcrumbJsonLd` call is built from — passed in rather
   * than computed here, because this is a Client Component and cannot render the JSON-LD half
   * of `components/patterns/breadcrumbs.tsx` (that half, `Breadcrumbs`, imports `lib/seo/
   * json-ld`, which is `server-only`). The four `/deniz/{akdeniz,ege,karadeniz,marmara}/
   * page.tsx` callers build this once and feed both the visible nav below (via
   * `BreadcrumbsNav`) and their own server-rendered `<JsonLd>` from it — ONE array, never
   * typed out twice.
   */
  breadcrumbItems: readonly BreadcrumbTrailItem[];
  /**
   * The FAQ block, BUILT BY THE PAGE and rendered here — a Server Component handed to a Client
   * Component as a prop, which creates no import edge from this file.
   *
   * It has to arrive this way. The block is `components/patterns/faq-section.tsx`, which emits
   * the `FAQPage` JSON-LD beside the questions from one `items` array; that component imports
   * `lib/seo/json-ld`, whose first line is `import "server-only"`. Importing it HERE would make
   * `pnpm build` fail with `'server-only' cannot be imported from a Client Component module` and
   * would red `components/patterns/rsc-boundary.test.ts` — the same regression this very file
   * caused once before through `components/patterns/breadcrumbs.tsx`, which is why
   * `breadcrumbs-nav.tsx` exists and why `breadcrumbItems` above is passed in rather than
   * computed. Same boundary, same shape, one lesson.
   *
   * So the four `deniz/{akdeniz,ege,karadeniz,marmara}` pages build `<FaqSection …/>` and the
   * markup and the schema stay ONE array (`basinData.faq`) in ONE place. Those pages no longer
   * call `faqPageJsonLd` themselves, and the delegated-markup exemption that used to pair their
   * schema with markup written in this file is gone with it.
   */
  faq: React.ReactNode;
}

export function V2SeaBasinDetailView({
  data,
  marinePoints,
  breadcrumbItems,
  faq,
}: V2SeaBasinDetailViewProps) {
  // Sort points by displayOrder
  const sortedPoints = [...marinePoints].sort((a, b) => a.displayOrder - b.displayOrder);

  const otherBasins = [
    { slug: "karadeniz", name: "Karadeniz", badge: "En Az Tuzlu", href: "/deniz/karadeniz" },
    {
      slug: "marmara",
      name: "Marmara Denizi",
      badge: "İç Deniz & Boğazlar",
      href: "/deniz/marmara",
    },
    { slug: "ege", name: "Ege Denizi", badge: "Enine Kıyı & Şelf", href: "/deniz/ege" },
    { slug: "akdeniz", name: "Akdeniz", badge: "En Sıcak & Tuzlu", href: "/deniz/akdeniz" },
  ].filter((b) => b.slug !== data.slug);

  return (
    <div className="space-y-14">
      {/* Breadcrumb & Hero */}
      <div className="space-y-4">
        <BreadcrumbsNav items={breadcrumbItems} />

        <div
          className={`relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b ${data.gradientClass} p-6 sm:p-10 shadow-lg`}
        >
          <PageHero
            tier="hub"
            heading={data.fullNameTr}
            badges={
              <>
                <Badge variant="primary" size="sm" icon={<Waves className="size-3.5" />}>
                  Mavi Vatan Havza Atlası
                </Badge>
                <Badge variant="secondary" size="sm">
                  {data.badge}
                </Badge>
              </>
            }
            lede={
              <>
                Fiziki coğrafyası, derinlik profili, akıntı rejimleri, kıyı yer şekilleri, canlı
                telemetri istasyonları ve çevre sorunlarıyla kapsamlı {data.nameTr} rehberi.
              </>
            }
          />

          {/* Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-8">
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[10px] text-muted-foreground font-medium block">Yüzölçümü</span>
              <span className="font-heading text-lg sm:text-xl font-bold text-foreground block mt-0.5">
                {data.metrics.area}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[10px] text-muted-foreground font-medium block">
                Maksimum Derinlik
              </span>
              <span className="font-heading text-lg sm:text-xl font-bold text-cyan-600 block mt-0.5">
                {data.metrics.maxDepth}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[10px] text-muted-foreground font-medium block">
                Ortalama Derinlik
              </span>
              <span className="font-heading text-lg sm:text-xl font-bold text-foreground block mt-0.5">
                {data.metrics.avgDepth}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[10px] text-muted-foreground font-medium block">
                Tuzluluk Oranı
              </span>
              <span className="font-heading text-lg sm:text-xl font-bold text-accent block mt-0.5">
                {data.metrics.salinity}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[10px] text-muted-foreground font-medium block">
                Türkiye Kıyı Şeridi
              </span>
              <span className="font-heading text-lg sm:text-xl font-bold text-primary block mt-0.5">
                {data.metrics.coastalLengthTr}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[10px] text-muted-foreground font-medium block">
                Kıyı İli Sayısı
              </span>
              <span className="font-heading text-lg sm:text-xl font-bold text-primary block mt-0.5">
                {data.metrics.provincesCount} İl
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: FILTERED LIVE TELEMETRY TABLE */}
      <section aria-labelledby="basin-telemetry-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-cyan-500 animate-pulse" />
            <h2
              id="basin-telemetry-heading"
              className="font-heading text-xl sm:text-2xl font-bold text-foreground"
            >
              {data.nameTr} Canlı Telemetri İstasyonları ({sortedPoints.length} Nokta)
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            CMEMS &amp; ECMWF Açık Deniz Modelleri
          </span>
        </div>

        {sortedPoints.length > 0 ? (
          <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-3 sm:p-4">İstasyon &amp; Kıyı</th>
                  <th className="p-3 sm:p-4">İl</th>
                  <th className="p-3 sm:p-4">Su Sıcaklığı (SST)</th>
                  <th className="p-3 sm:p-4">Belirgin Dalga (Hs)</th>
                  <th className="p-3 sm:p-4">Rüzgâr (10m)</th>
                  <th className="p-3 sm:p-4">Model Zamanı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sortedPoints.map((pt) => {
                  return (
                    <tr key={pt.slugTr} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 sm:p-4">
                        <div className="font-bold text-foreground text-xs sm:text-sm">
                          {pt.nameTr}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{pt.coastLabelTr}</div>
                      </td>
                      <td className="p-3 sm:p-4">
                        {pt.provinceSlug ? (
                          <Link
                            href={`/turkiye/${pt.provinceSlug}` as LinkHref}
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            <span>{pt.provinceName}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              ({pt.plateCode})
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{pt.provinceName}</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {pt.sst !== null && pt.sst !== undefined ? `${pt.sst.toFixed(1)} °C` : "—"}
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-cyan-600 dark:text-cyan-400">
                        {pt.waveHeight !== null && pt.waveHeight !== undefined
                          ? `${pt.waveHeight.toFixed(2)} m`
                          : "—"}
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-foreground">
                        {pt.windSpeedKmh !== null && pt.windSpeedKmh !== undefined
                          ? `${pt.windSpeedKmh.toFixed(0)} km/h`
                          : "—"}
                      </td>
                      <td className="p-3 sm:p-4 text-[11px] text-muted-foreground font-mono">
                        {/* "—", never "Güncel". The column heading is "Model Zamanı", so a
                            fallback string here is read as an ANSWER to it: the row states a
                            freshness it does not have, and states it in the case where no cycle
                            has been ingested and the platform knows least. The three cells to
                            the left of this one already use the neutral dash; `validAt` was the
                            exception to the table's own convention. */}
                        {pt.validAt || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center rounded-3xl border border-dashed border-border bg-card/40 text-xs text-muted-foreground">
            Bu havzaya ait istasyon verisi yükleniyor...
          </div>
        )}
      </section>

      {/* SUBMARINE FAULT CALLOUT (IF MARMARA OR EGE) */}
      {data.faultLineNotice && (
        <div className="p-5 sm:p-6 rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-500/5 via-card to-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
              <Layers className="size-6" />
            </div>
            <div>
              <span className="font-heading text-base sm:text-lg font-bold text-foreground block">
                Denizaltı Sismotektoniği &amp; Aktif Faylar
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">{data.faultLineNotice.text}</p>
            </div>
          </div>
          <Link
            href={data.faultLineNotice.href as LinkHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0 font-bold text-xs group gap-1.5",
            )}
          >
            <span>Fay Hatları Atlasına Git</span>
            <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}

      {/* 8 CORE CURRICULUM GEOGRAPHICAL SECTIONS */}
      <div className="space-y-10">
        {/* 1. PHYSICAL GEOGRAPHY */}
        <Card as="article" variant="panel" space="4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Mountain className="size-4.5" />
            <span>Fiziki Coğrafya &amp; Havza Morfolojisi</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.physicalGeography.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.physicalGeography.content}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {data.physicalGeography.points.map((pt, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-xs text-muted-foreground space-y-1"
              >
                <span className="size-2 rounded-full bg-primary inline-block mr-1.5" />
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 2. CLIMATE IMPACT */}
        <Card as="article" variant="panel" space="4">
          <div className="flex items-center gap-2 text-secondary font-bold text-sm">
            <CloudRain className="size-4.5" />
            <span>İklim Dinamikleri</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.climateImpact.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.climateImpact.content}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {data.climateImpact.points.map((pt, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-xs text-muted-foreground space-y-1"
              >
                <span className="size-2 rounded-full bg-secondary inline-block mr-1.5" />
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 3. COASTAL GEOMORPHOLOGY & TYPES */}
        <Card as="article" variant="panel" space="4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2 text-teal-600 font-bold text-sm">
              <Compass className="size-4.5" />
              <span>Kıyı Tipleri &amp; Yer Şekilleri</span>
            </div>
            <Link
              href={data.coastalGeomorphology.coastalTypesHref as LinkHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0 text-xs font-bold gap-1",
              )}
            >
              <span>Kıyı Tipleri Atlası</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.coastalGeomorphology.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.coastalGeomorphology.content}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {data.coastalGeomorphology.coastalTypes.map((type, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold"
              >
                {type}
              </span>
            ))}
          </div>
        </Card>

        {/* 4. CURRENTS & WATER MOVEMENT */}
        <Card as="article" variant="panel" space="4">
          <div className="flex items-center gap-2 text-cyan-600 font-bold text-sm">
            <Waves className="size-4.5" />
            <span>Hidrodinami &amp; Akıntı Rejimi</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.currentsAndWaterMovement.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.currentsAndWaterMovement.content}
          </p>
          <div className="space-y-2 pt-2">
            {data.currentsAndWaterMovement.keyPoints.map((kp, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-muted/40 border border-border/80 text-xs text-muted-foreground flex items-start gap-2"
              >
                <CheckCircle2 className="size-4 text-cyan-600 shrink-0 mt-0.5" />
                <span>{kp}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 5. HYDROGRAPHIC BALANCE & RIVERS */}
        <Card as="article" variant="panel" space="4">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
            <Droplets className="size-4.5" />
            <span>Beslenme Kaynakları &amp; Akarsular</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.hydrographicBalance.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.hydrographicBalance.content}
          </p>
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-foreground block">
              Havzayı Besleyen Ana Akarsular:
            </span>
            <div className="flex flex-wrap gap-2">
              {data.hydrographicBalance.majorRivers.map((riv, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-mono"
                >
                  {riv}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* 6. ECONOMIC GEOGRAPHY */}
        <Card as="article" variant="panel" space="4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Anchor className="size-4.5" />
            <span>Ekonomik Coğrafya</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.economicGeography.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.economicGeography.content}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {data.economicGeography.sectors.map((sec, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-card border border-border space-y-1 text-xs"
              >
                <span className="font-bold text-foreground block">{sec.name}</span>
                <p className="text-muted-foreground leading-relaxed">{sec.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* 7. HUMAN GEOGRAPHY & COASTAL PROVINCES */}
        <Card as="article" variant="panel" space="4">
          <div className="flex items-center gap-2 text-secondary font-bold text-sm">
            <MapPin className="size-4.5" />
            <span>Nüfus &amp; Kıyı Şehirleri</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.humanGeography.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.humanGeography.content}
          </p>
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-foreground block">
              {data.nameTr}&apos;ne Kıyısı Olan {data.coastalProvinces.length} İlimiz:
            </span>
            <div className="flex flex-wrap gap-2">
              {data.coastalProvinces.map((prov) => (
                <Link
                  key={prov.plate}
                  href={`/turkiye/${prov.slug}` as LinkHref}
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
        </Card>

        {/* 8. ENVIRONMENTAL ISSUES */}
        <Card as="article" variant="panel" space="4">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm">
            <AlertTriangle className="size-4.5" />
            <span>Çevre Sorunları &amp; Ekolojik Tehditler</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {data.environmentalIssues.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {data.environmentalIssues.content}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {data.environmentalIssues.risks.map((risk, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground space-y-1"
              >
                <span className="size-2 rounded-full bg-destructive inline-block mr-1.5" />
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SSS / FAQ — the page's own `<FaqSection>`, rendered exactly where this view's
          hand-written block used to sit. See the `faq` prop's docblock for why it arrives as a
          prop instead of being imported here. */}
      {faq}

      {/* OTHER SEAS CROSS-NAVIGATION STRIP */}
      <section className="p-6 sm:p-8 rounded-3xl border border-border bg-gradient-to-r from-card via-muted/30 to-card space-y-4">
        <div className="space-y-1">
          <h3 className="font-heading text-lg font-bold text-foreground">
            Diğer Deniz Havzalarını İnceleyin
          </h3>
          <p className="text-xs text-muted-foreground">
            Türkiye&apos;yi çevreleyen 4 denizin canlı telemetri ve fiziki coğrafya atlası.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {otherBasins.map((ob) => (
            <Link
              key={ob.slug}
              href={ob.href as LinkHref}
              className="p-4 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all group flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors block">
                  {ob.name}
                </span>
                <span className="text-[11px] text-muted-foreground">{ob.badge}</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </section>

      {/* NO SOURCES SECTION HERE, AND NO NOTICE EITHER — both are the PAGE's.
          This view is a client component, and `MarineDataNotice` (the block carrying the safety
          disclaimer for the SST / wave / wind values the table above publishes, and the link to
          the ECMWF and Copernicus Marine licence text on `/hakkimizda`) is an async server
          component that cannot be rendered from inside one.
          While the bibliography lived here and the attribution lived nowhere, the four basin
          pages published CMEMS/ECMWF-derived values under a heading naming both providers with
          the mandated notice rendered on no page at all. Each basin page now renders
          `MarineDataNotice` and then `V2SourcesSection`, in that order — the same order
          `/deniz` uses, the notice before the bibliography that echoes it. */}
    </div>
  );
}
