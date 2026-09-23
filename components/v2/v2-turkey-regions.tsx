"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { tr } from "@/lib/text/format-number";
import { REGION_IDENTITY } from "@/lib/theme/region-identity";

export const CANONICAL_REGION_SLUGS: Record<string, string> = {
  marmara: "marmara",
  ege: "ege",
  akdeniz: "akdeniz",
  icanadolu: "ic-anadolu",
  karadeniz: "karadeniz",
  doguanadolu: "dogu-anadolu",
  guneydogu: "guneydogu-anadolu",
};

/** The live per-region figures this deck renders — sourced from the hub page's own
 * `regionsList` (never hand-typed here), so a figure can never drift from the comparison
 * table or the FAQ on the same page. Matched to a `TURKEY_REGIONS` entry via
 * `CANONICAL_REGION_SLUGS`. */
export interface RegionDeckFigures {
  slug: string;
  areaKm2: number;
  populationSharePercent: number;
  highestPeakNameTr: string;
  highestPeakElevationM: number;
}

export interface RegionInfo {
  id: string;
  name: string;
  badgeVariant: "primary" | "secondary" | "info" | "warning" | "default" | "outline";
  /** The region's own identity, bound to its `--region-*` token — surface, label and edge.
   *  Named for the job rather than for the property: the previous `color` held a two-stop
   *  raw-palette gradient that had nothing to do with the colour this region is painted on
   *  any map in the product (Marmara amber against a blue fill, Ege teal against orange). */
  identityClass: string;
  provincesCount: number;
  climate: string;
  description: string;
  highlightProvinces: { name: string; slug: string; plate: string }[];
}

export const TURKEY_REGIONS: RegionInfo[] = [
  {
    id: "marmara",
    name: "Marmara Bölgesi",
    badgeVariant: "primary",
    identityClass: REGION_IDENTITY.marmara.banner,
    provincesCount: 11,
    climate: "Geçiş İklimi (Akdeniz - Karadeniz - Karasal)",
    description:
      "İki kıtayı bağlayan boğazlar bu bölgede. Türkiye'nin sanayisi, ticareti ve finansı en çok burada toplanır.",
    highlightProvinces: [
      { name: "İstanbul", slug: "istanbul", plate: "34" },
      { name: "Bursa", slug: "bursa", plate: "16" },
      { name: "Kocaeli", slug: "kocaeli", plate: "41" },
      { name: "Balıkesir", slug: "balikesir", plate: "10" },
      { name: "Çanakkale", slug: "canakkale", plate: "17" },
    ],
  },
  {
    id: "ege",
    name: "Ege Bölgesi",
    badgeVariant: "info",
    identityClass: REGION_IDENTITY.ege.banner,
    provincesCount: 8,
    climate: "Tipik Akdeniz İklimi",
    description:
      "Dağlar denize dik uzanır, aralarında verimli graben ovaları açılır. Kıyısı girintili çıkıntılı, yamaçları zeytinlik.",
    highlightProvinces: [
      { name: "İzmir", slug: "izmir", plate: "35" },
      { name: "Manisa", slug: "manisa", plate: "45" },
      { name: "Aydın", slug: "aydin", plate: "09" },
      { name: "Muğla", slug: "mugla", plate: "48" },
      { name: "Denizli", slug: "denizli", plate: "20" },
    ],
  },
  {
    id: "akdeniz",
    name: "Akdeniz Bölgesi",
    badgeVariant: "secondary",
    identityClass: REGION_IDENTITY.akdeniz.banner,
    provincesCount: 8,
    climate: "Sıcak ve Kurak Yazlar, Ilık Kışlar",
    description:
      "Toros Dağları, karstik platolar ve kanyonlar. Kıyıda seralar, turunçgil bahçeleri ve turizm.",
    highlightProvinces: [
      { name: "Antalya", slug: "antalya", plate: "07" },
      { name: "Adana", slug: "adana", plate: "01" },
      { name: "Mersin", slug: "mersin", plate: "33" },
      { name: "Hatay", slug: "hatay", plate: "31" },
      { name: "Isparta", slug: "isparta", plate: "32" },
    ],
  },
  {
    id: "icanadolu",
    name: "İç Anadolu Bölgesi",
    badgeVariant: "warning",
    identityClass: REGION_IDENTITY["ic-anadolu"].banner,
    provincesCount: 13,
    climate: "Step (Karasal) İklimi",
    description:
      "Geniş platolar ve tahıl ekilen ovalar, kapalı bir havzadaki Tuz Gölü, volkanik dağlar. Başkent Ankara da burada.",
    highlightProvinces: [
      { name: "Ankara", slug: "ankara", plate: "06" },
      { name: "Konya", slug: "konya", plate: "42" },
      { name: "Kayseri", slug: "kayseri", plate: "38" },
      { name: "Eskişehir", slug: "eskisehir", plate: "26" },
      { name: "Sivas", slug: "sivas", plate: "58" },
    ],
  },
  {
    id: "karadeniz",
    name: "Karadeniz Bölgesi",
    badgeVariant: "info",
    identityClass: REGION_IDENTITY.karadeniz.banner,
    provincesCount: 18,
    climate: "Her Mevsim Yağışlı Ilıman İklim",
    description:
      "Kuzey Anadolu Dağları kıyıya paralel uzanır, yamaçlar ormanla kaplıdır. Fındık, çay ve yayla hayatı bu bölgeyle özdeşleşir.",
    highlightProvinces: [
      { name: "Trabzon", slug: "trabzon", plate: "61" },
      { name: "Samsun", slug: "samsun", plate: "55" },
      { name: "Rize", slug: "rize", plate: "53" },
      { name: "Ordu", slug: "ordu", plate: "52" },
      { name: "Zonguldak", slug: "zonguldak", plate: "67" },
    ],
  },
  {
    id: "doguanadolu",
    name: "Doğu Anadolu Bölgesi",
    badgeVariant: "default",
    identityClass: REGION_IDENTITY["dogu-anadolu"].banner,
    provincesCount: 14,
    climate: "Sert Karasal, Uzun Kışlar",
    description:
      "Türkiye'nin en yüksek ve en engebeli bölgesi. Volkanik dağlar, Van Gölü ve Fırat ile Dicle'nin kaynakları burada.",
    highlightProvinces: [
      { name: "Erzurum", slug: "erzurum", plate: "25" },
      { name: "Van", slug: "van", plate: "65" },
      { name: "Malatya", slug: "malatya", plate: "44" },
      { name: "Ağrı", slug: "agri", plate: "04" },
      { name: "Kars", slug: "kars", plate: "36" },
    ],
  },
  {
    id: "guneydogu",
    name: "Güneydoğu Anadolu",
    badgeVariant: "outline",
    identityClass: REGION_IDENTITY["guneydogu-anadolu"].banner,
    provincesCount: 9,
    climate: "Şiddetli Yaz Kuraklığı, Karasal",
    description:
      "Geniş düzlükler ve platolar. GAP ile sulanan Harran Ovası verimlidir; Mezopotamya'nın eski yerleşimleri de bu bölgede.",
    highlightProvinces: [
      { name: "Gaziantep", slug: "gaziantep", plate: "27" },
      { name: "Diyarbakır", slug: "diyarbakir", plate: "21" },
      { name: "Şanlıurfa", slug: "sanliurfa", plate: "63" },
      { name: "Mardin", slug: "mardin", plate: "47" },
      { name: "Adıyaman", slug: "adiyaman", plate: "02" },
    ],
  },
];

export function V2TurkeyRegions({ regions }: { regions: readonly RegionDeckFigures[] }) {
  // Superlatives are derived from the live figures, never typed — the exact defect this
  // page corrected: a hand-typed "(En Geniş)" can go stale, a computed one cannot.
  const maxAreaKm2 = Math.max(...regions.map((r) => r.areaKm2));
  const maxPopulationSharePercent = Math.max(...regions.map((r) => r.populationSharePercent));
  const maxHighestPeakElevationM = Math.max(...regions.map((r) => r.highestPeakElevationM));

  return (
    <section className="space-y-6">
      <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
          Bölgelere Kısa Bakış
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TURKEY_REGIONS.map((region) => {
          const slug = CANONICAL_REGION_SLUGS[region.id] ?? region.id;
          const fig = regions.find((r) => r.slug === slug);
          const isLargestArea = fig !== undefined && fig.areaKm2 === maxAreaKm2;
          const isMostPopulous =
            fig !== undefined && fig.populationSharePercent === maxPopulationSharePercent;
          const isHighestPeak =
            fig !== undefined && fig.highestPeakElevationM === maxHighestPeakElevationM;
          const peakNameHasParenthetical = fig !== undefined && fig.highestPeakNameTr.includes("(");

          return (
            <Card
              key={region.id}
              className="flex flex-col justify-between hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card overflow-hidden group"
            >
              {/* Header Banner — the region's colour, the one the map paints it. The wash
                  carries the identity, the rule under it states the hue at full strength, and
                  the heading takes the measured `-text` member, which is why nothing here
                  needs a `dark:` variant or a white override.
                  The two `text-inherit` escapes are load-bearing, not tidying. TWO base rules
                  in `app/globals.css` stand between this div's colour and the heading, and
                  each beats a value that is merely INHERITED: `h1,h2,h3,h4 { color:
                  var(--foreground) }` at :709 and `a { color: var(--link) }` at :733. With
                  neither escape the heading renders `--link` terracotta for all seven regions;
                  with only the `a` one it renders `--foreground` for all seven, because the
                  anchor then inherits the h3's own base colour rather than this div's. Both
                  are needed, and `-text` paints nothing without them — which is exactly what
                  happened when the `text-white` that had been winning was removed. Utilities
                  outrank `@layer base` whatever the specificity, so these win, and the token
                  stays single-sourced in `identityClass` instead of being respelled per
                  region on the anchor.
                  They also outrank `a:hover { color: var(--primary) }` at `globals.css:752`,
                  so this heading deliberately keeps its region colour on hover instead of
                  turning terracotta. That is the point, not a casualty: a hover recolour to
                  the brand would contradict the one-colour-per-region identity this banner
                  exists to state. `hover:underline` on the Link carries the affordance. */}
              <div
                className={`p-4 ${region.identityClass} [&_h3]:text-inherit [&_a]:text-inherit flex items-center justify-between`}
              >
                <div>
                  <h3 className="font-heading font-bold text-lg leading-tight">
                    <Link
                      href={
                        `/turkiye/bolge/${CANONICAL_REGION_SLUGS[region.id] ?? region.id}` as unknown as React.ComponentProps<
                          typeof Link
                        >["href"]
                      }
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {region.name}
                    </Link>
                  </h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  {region.provincesCount} İl
                </Badge>
              </div>

              <CardHeader className="space-y-3 pb-2 pt-4">
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {region.description}
                </CardDescription>

                {/* Geographic Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-muted-foreground block text-[10px]">İklim</span>
                    <span className="font-semibold text-foreground text-[11px] truncate block">
                      {region.climate}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-muted-foreground block text-[10px]">En Yüksek Zirve</span>
                    <span className="font-semibold text-foreground text-[11px] truncate block">
                      {fig
                        ? `${fig.highestPeakNameTr}${peakNameHasParenthetical ? ", " : " ("}${tr(fig.highestPeakElevationM)} m${peakNameHasParenthetical ? "" : ")"}${isHighestPeak ? " · Türkiye zirvesi" : ""}`
                        : "—"}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 py-2">
                <div className="border-t border-border pt-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-2">
                    Başlıca İller:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {region.highlightProvinces.map((prov) => (
                      <Link
                        key={prov.slug}
                        href={
                          `/turkiye/${prov.slug}` as unknown as React.ComponentProps<
                            typeof Link
                          >["href"]
                        }
                        className="text-xs px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 hover:text-primary transition-colors border border-border/80 font-medium"
                      >
                        {prov.name}{" "}
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({prov.plate})
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t border-border bg-muted/20 items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground">
                    Yüzölçümü:{" "}
                    {fig ? `${tr(fig.areaKm2)} km²${isLargestArea ? " (En Geniş)" : ""}` : "—"}
                  </span>
                  <span className="text-[11px] font-bold text-primary">
                    {fig
                      ? `Nüfus payı: %${tr(fig.populationSharePercent, 1)}${isMostPopulous ? " (En Kalabalık)" : ""}`
                      : "—"}
                  </span>
                </div>
                <Link
                  href={
                    `/turkiye/bolge/${CANONICAL_REGION_SLUGS[region.id] ?? region.id}` as unknown as React.ComponentProps<
                      typeof Link
                    >["href"]
                  }
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 py-1 px-2.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  Bölgeye Git <ArrowRight className="size-3" />
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
