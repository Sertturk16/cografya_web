"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Map,
  Compass,
  Waves,
  Mountain,
  Sun,
  CloudRain,
  Trees,
  Factory,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export interface RegionInfo {
  id: string;
  name: string;
  badgeVariant: "primary" | "secondary" | "info" | "warning" | "default" | "outline";
  color: string;
  provincesCount: number;
  areaKm2: string;
  populationShare: string;
  climate: string;
  highestPeak: string;
  description: string;
  highlightProvinces: { name: string; slug: string; plate: string }[];
}

export const TURKEY_REGIONS: RegionInfo[] = [
  {
    id: "marmara",
    name: "Marmara Bölgesi",
    badgeVariant: "primary",
    color: "from-amber-700 to-amber-900",
    provincesCount: 11,
    areaKm2: "67.000 km²",
    populationShare: "%31 (En Kalabalık)",
    climate: "Geçiş İklimi (Akdeniz - Karadeniz - Karasal)",
    highestPeak: "Uludağ (2.543 m)",
    description: "İki kıtayı birbirine bağlayan boğazları, sanayi, ticaret ve finans merkezleriyle Türkiye ekonomisinin kalbi.",
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
    color: "from-teal-700 to-teal-900",
    provincesCount: 8,
    areaKm2: "89.000 km²",
    populationShare: "%13",
    climate: "Tipik Akdeniz İklimi",
    highestPeak: "Honaz Dağı (2.571 m)",
    description: "Denize dik uzanan kırıklı dağ sıraları (horst-graben), verimli graben ovaları, zeytinlikler ve girintili kıyı şeridi.",
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
    color: "from-emerald-700 to-emerald-900",
    provincesCount: 8,
    areaKm2: "120.000 km²",
    populationShare: "%13",
    climate: "Sıcak & Kurak Yazlar, Ilık Kışlar",
    highestPeak: "Kızlar Sivrisi (3.070 m) / Medetsiz (3.524 m)",
    description: "Toros sıradağları, karstik plato ve kanyonlar, seracılık, turunçgil üretimi ve turizm kıyıları.",
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
    color: "from-yellow-800 to-amber-950",
    provincesCount: 13,
    areaKm2: "151.000 km²",
    populationShare: "%15",
    climate: "Step (Karasal) İklimi",
    highestPeak: "Erciyes Dağı (3.917 m)",
    description: "Geniş platolar, Tuz Gölü kapalı havzası, volkanik dağlar, tahıl ambarı ovalar ve başkent Ankara.",
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
    color: "from-cyan-800 to-slate-900",
    provincesCount: 18,
    areaKm2: "141.000 km²",
    populationShare: "%9",
    climate: "Her Mevsim Yağışlı Ilıman İklim",
    highestPeak: "Kaçkar Dağı (3.937 m)",
    description: "Kıyıya paralel Kuzey Anadolu Dağları, zengin orman kuşağı, fındık ve çay tarımı, yaylacılık kültürü.",
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
    color: "from-stone-700 to-stone-900",
    provincesCount: 14,
    areaKm2: "164.000 km² (En Geniş)",
    populationShare: "%7",
    climate: "Sert Karasal & Uzun Kışlar",
    highestPeak: "Ağrı Dağı (5.137 m - TR Zirvesi)",
    description: "Türkiye'nin en yüksek ve en engebeli bölgesi, volkanik koniler, Van Gölü havzası ve Fırat-Dicle nehirlerinin kaynağı.",
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
    color: "from-orange-800 to-orange-950",
    provincesCount: 9,
    areaKm2: "75.000 km²",
    populationShare: "%11",
    climate: "Şiddetli Yaz Kuraklığı & Karasal",
    highestPeak: "Karacadağ (1.957 m)",
    description: "Geniş düzlükler, plato alanları, GAP sulama projeleri, verimli Harran Ovası ve antik Mezopotamya yerleşimleri.",
    highlightProvinces: [
      { name: "Gaziantep", slug: "gaziantep", plate: "27" },
      { name: "Diyarbakır", slug: "diyarbakir", plate: "21" },
      { name: "Şanlıurfa", slug: "sanliurfa", plate: "63" },
      { name: "Mardin", slug: "mardin", plate: "47" },
      { name: "Adıyaman", slug: "adiyaman", plate: "02" },
    ],
  },
];

export function V2TurkeyRegions() {
  return (
    <section className="space-y-6">
      <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Mountain className="size-3.5" />}>
              Bölge Analizleri
            </Badge>
            <span className="text-xs text-muted-foreground">7 Coğrafi Bölge Rehberi</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] mt-1">
            Türkiye&apos;nin 7 Coğrafi Bölgesi &amp; Karakteristik Özellikleri
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TURKEY_REGIONS.map((region) => (
          <Card
            key={region.id}
            className="flex flex-col justify-between hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card overflow-hidden group"
          >
            {/* Header Banner */}
            <div className={`p-4 bg-gradient-to-r ${region.color} text-white flex items-center justify-between`}>
              <div>
                <span className="text-[10px] text-white/80 font-mono block">Bölge Profili</span>
                <h3 className="font-heading font-bold text-lg text-white leading-tight">
                  {region.name}
                </h3>
              </div>
              <Badge className="bg-white/20 text-white backdrop-blur-xs border-white/30 text-xs">
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
                    {region.highestPeak}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 py-2">
              <div className="border-t border-border pt-2.5">
                <span className="text-[11px] font-semibold text-muted-foreground block mb-2">
                  Önemli Şehirler:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {region.highlightProvinces.map((prov) => (
                    <Link
                      key={prov.slug}
                      href={`/v2/turkiye/${prov.slug}` as any}
                      className="text-xs px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 hover:text-primary transition-colors border border-border/80 font-medium"
                    >
                      {prov.name} <span className="text-[10px] text-muted-foreground font-mono">({prov.plate})</span>
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-3 border-t border-border bg-muted/20 justify-between">
              <span className="text-[11px] text-muted-foreground">Yüzölçümü: {region.areaKm2}</span>
              <span className="text-[11px] font-bold text-primary">{region.populationShare}</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
