"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Waves, Thermometer, ArrowRight, Sparkles, Droplets } from "lucide-react";

export interface SeaBasinInfo {
  id: "black_sea" | "marmara" | "aegean" | "mediterranean";
  nameTr: string;
  nameEn: string;
  badgeClass: string;
  borderClass: string;
  icon: string;
  stationCount: number;
  coastalProvinceCount: number;
  avgSummerTemp: string;
  avgWinterTemp: string;
  salinity: string;
  maxDepth: string;
  areaKm2: string;
  keyCharacteristics: string[];
  currentSystem: string;
}

export const BASIN_DATA: SeaBasinInfo[] = [
  {
    id: "black_sea",
    nameTr: "Karadeniz Havzası",
    nameEn: "Black Sea Basin",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    borderClass: "hover:border-cyan-500/50",
    icon: "Waves",
    stationCount: 15,
    coastalProvinceCount: 15,
    avgSummerTemp: "24.5°C – 26.5°C",
    avgWinterTemp: "7.0°C – 9.5°C",
    salinity: "%o17 – %o18 (En Düşük)",
    maxDepth: "2.212 m",
    areaKm2: "436.400 km²",
    keyCharacteristics: [
      "200 metrenin altında H2S (hidrojen sülfür) gazı nedeniyle canlı yaşamı yoktur.",
      "Tuna, Dinyester, Dinyeper ve Kızılırmak gibi dev nehirlerle beslenir; bol tatlı su girdisi vardır.",
      "Bol plankton ve oksijen zenginliği sayesinde Türkiye balıkçılığının %70'inden fazlasını karşılar.",
    ],
    currentSystem:
      "Saat yönünün tersine dönen siklonik genel akıntı halkası (Rim Current) hâkimdir.",
  },
  {
    id: "marmara",
    nameTr: "Marmara Denizi",
    nameEn: "Sea of Marmara",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    borderClass: "hover:border-amber-500/50",
    icon: "Anchor",
    stationCount: 6,
    coastalProvinceCount: 7,
    avgSummerTemp: "23.5°C – 25.5°C",
    avgWinterTemp: "8.5°C – 10.5°C",
    salinity: "%o22 (Yüzey) / %o38 (Dip)",
    maxDepth: "1.370 m (Çınarcık Çukuru)",
    areaKm2: "11.350 km²",
    keyCharacteristics: [
      "Tamamı Türkiye sınırları içerisinde yer alan jeolojik bir 'İç Deniz'dir.",
      "İstanbul ve Çanakkale Boğazları ile iki farklı su kütlesini birbirine bağlar.",
      "Kuzey Anadolu Fay Hattı deniz tabanından geçer; 3 büyük derin tektonik çukurluk bulunur.",
    ],
    currentSystem:
      "İki tabakalı akıntı: Yüzeyde Karadeniz'den Ege'ye, dipte Akdeniz'den Karadeniz'e yoğun alt akıntı.",
  },
  {
    id: "aegean",
    nameTr: "Ege Denizi",
    nameEn: "Aegean Sea",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    borderClass: "hover:border-teal-500/50",
    icon: "Sailboat",
    stationCount: 5,
    coastalProvinceCount: 5,
    avgSummerTemp: "25.0°C – 27.5°C",
    avgWinterTemp: "12.0°C – 14.5°C",
    salinity: "%o33 – %o37 (Orta-Yüksek)",
    maxDepth: "2.561 m",
    areaKm2: "214.000 km²",
    keyCharacteristics: [
      "Enine kıyı tipi nedeniyle Türkiye'nin en uzun kıyı şeridine (3.484 km adalar dahil) sahiptir.",
      "Yüzlerce ada, koy, körfez ve doğal liman ile zengin deniz turizmi potansiyeli barındırır.",
      "Kıta sahanlığı geniştir; dağlar denize dik uzanır ve deniz etkisi iç kesimlere sokulur.",
    ],
    currentSystem:
      "Boğazlardan gelen az tuzlu su batı kıyısından güneye, Akdeniz suyu doğu kıyısından kuzeye akar.",
  },
  {
    id: "mediterranean",
    nameTr: "Akdeniz Havzası",
    nameEn: "Mediterranean Sea",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    borderClass: "hover:border-rose-500/50",
    icon: "SunMedium",
    stationCount: 4,
    coastalProvinceCount: 4,
    avgSummerTemp: "28.5°C – 30.5°C (En Sıcak)",
    avgWinterTemp: "16.0°C – 18.0°C",
    salinity: "%o38 – %o39 (En Tuzlu)",
    maxDepth: "5.267 m (Calypso Çukuru)",
    areaKm2: "2.500.000 km²",
    keyCharacteristics: [
      "Güneşlenme süresi ve buharlaşmanın en yüksek olduğu, Türkiye'nin en sıcak ve tuzlu denizidir.",
      "Boyuna kıyı tipi hâkimdir; Toros Dağları kıyıya paralel uzandığı için falezler yaygındır.",
      "Kızıldeniz'den Süveyş Kanalı üzerinden gelen 'Lessepsiyen' tropikal göçmen türlere ev sahipliği yapar.",
    ],
    currentSystem:
      "Doğu Akdeniz'de saat yönünün tersine dönen sıcak kıyı akıntısı sistemi etkindir.",
  },
];

interface V2MarineBasinCardsProps {
  onSelectBasin?: (basinId: string) => void;
}

export function V2MarineBasinCards({ onSelectBasin }: V2MarineBasinCardsProps) {
  return (
    <section className="space-y-6" aria-labelledby="v2-marine-basins-heading">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="primary" size="sm" icon={<Waves className="size-3.5" />}>
              Oşinografi Atlası
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">
              4 Deniz Havzası Analizi
            </span>
          </div>
          <h2
            id="v2-marine-basins-heading"
            className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)]"
          >
            Türkiye&apos;yi Çevreleyen 4 Denizin Hidrografik Yapısı
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Karadeniz, Marmara, Ege ve Akdeniz&apos;in tuzluluk, sıcaklık, derinlik ve akıntı
            karakteristikleri.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {BASIN_DATA.map((basin) => (
          <Card
            key={basin.id}
            className={`border border-border bg-card/80 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-lg ${basin.borderClass} group flex flex-col justify-between`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={basin.badgeClass}>
                  {basin.stationCount} Canlı İstasyon • {basin.coastalProvinceCount} Kıyı İli
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground">{basin.areaKm2}</span>
              </div>
              <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                <span>{basin.nameTr}</span>
                <span className="text-xs font-normal text-muted-foreground">({basin.nameEn})</span>
              </CardTitle>
              <CardDescription className="text-xs flex items-center gap-4 pt-1">
                <span className="flex items-center gap-1">
                  <Thermometer className="size-3 text-primary" /> Yaz: {basin.avgSummerTemp}
                </span>
                <span className="flex items-center gap-1">
                  <Droplets className="size-3 text-cyan-600" /> Tuzluluk: {basin.salinity}
                </span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3.5 text-xs pt-0">
              {/* Metric Box */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 border border-border/60">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Maksimum Derinlik</span>
                  <span className="font-mono font-bold text-foreground">{basin.maxDepth}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground block">Kış Su Sıcaklığı</span>
                  <span className="font-mono font-bold text-primary">{basin.avgWinterTemp}</span>
                </div>
              </div>

              {/* Current System Note */}
              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px]">
                <span className="font-bold text-primary block mb-0.5">Akıntı Rejimi:</span>
                <span className="text-muted-foreground">{basin.currentSystem}</span>
              </div>

              {/* Characteristic Bullets */}
              <div className="space-y-1.5">
                {basin.keyCharacteristics.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-snug"
                  >
                    <Sparkles className="size-3 text-primary shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {onSelectBasin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs group-hover:border-primary/40 group-hover:text-primary transition-all"
                  onClick={() => onSelectBasin(basin.id)}
                  rightIcon={<ArrowRight className="size-3.5" />}
                >
                  Haritada {basin.nameTr}&apos;ni İncele
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
