"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Globe,
  Mountain,
  Waves,
  TreePine,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { Continent } from "@/lib/api/types";

export interface ContinentData {
  id: Continent;
  nameTr: string;
  nameEn: string;
  code: string;
  color: string;
  badgeClass: string;
  borderClass: string;
  countryCount: number;
  population: string;
  areaKm2: string;
  highestPoint: { name: string; elevation: string; country: string };
  longestRiver: { name: string; length: string };
  largestLake: { name: string; area: string };
  dominantClimate: string;
  keyFeatures: string[];
}

export const CONTINENTS_DATA: ContinentData[] = [
  {
    id: "AVRUPA",
    nameTr: "Avrupa",
    nameEn: "Europe",
    code: "EU",
    color: "from-indigo-600 to-blue-700",
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    borderClass: "hover:border-indigo-500/50",
    countryCount: 44,
    population: "745 Milyon",
    areaKm2: "10.180.000 km²",
    highestPoint: { name: "Elbrus Dağı", elevation: "5.642 m", country: "Rusya / Kafkaslar" },
    longestRiver: { name: "Volga Nehri", length: "3.530 km" },
    largestLake: { name: "Ladoga Gölü", area: "17.700 km²" },
    dominantClimate: "Ilıman Okyanusal, Akdeniz ve Karasal İklim",
    keyFeatures: ["Gelişmiş Sanayi Kuşağı", "Alp Dağ Silsilesi", "Girintili Çıkıntılı Kıyılar (Fiyortlar)"],
  },
  {
    id: "ASYA",
    nameTr: "Asya",
    nameEn: "Asia",
    code: "AS",
    color: "from-amber-600 to-orange-700",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    borderClass: "hover:border-amber-500/50",
    countryCount: 48,
    population: "4.75 Milyar",
    areaKm2: "44.579.000 km²",
    highestPoint: { name: "Everest Dağı", elevation: "8.848 m", country: "Nepal / Çin" },
    longestRiver: { name: "Yangtze Nehri", length: "6.300 km" },
    largestLake: { name: "Hazar Denizi", area: "371.000 km²" },
    dominantClimate: "Muson, Çöl, Step ve Sibirya Tundra İklimi",
    keyFeatures: ["Dünyanın En Yüksek Zirveleri (Himalayalar)", "En Kalabalık Nüfus Yoğunluğu", "Tibet Yaylası"],
  },
  {
    id: "AFRIKA",
    nameTr: "Afrika",
    nameEn: "Africa",
    code: "AF",
    color: "from-emerald-600 to-green-700",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    borderClass: "hover:border-emerald-500/50",
    countryCount: 54,
    population: "1.46 Milyar",
    areaKm2: "30.370.000 km²",
    highestPoint: { name: "Kilimanjaro Dağı", elevation: "5.895 m", country: "Tanzanya" },
    longestRiver: { name: "Nil Nehri", length: "6.650 km" },
    largestLake: { name: "Victoria Gölü", area: "68.800 km²" },
    dominantClimate: "Ekvatoral, Savan ve Tropikal Çöl İklimi",
    keyFeatures: ["Büyük Sahra Çölü (En Büyük Sıcak Çöl)", "Doğu Afrika Rift Vadisi", "Zengin Yaban Hayatı ve Biyoçeşitlilik"],
  },
  {
    id: "KUZEY_AMERIKA",
    nameTr: "Kuzey Amerika",
    nameEn: "North America",
    code: "NA",
    color: "from-sky-600 to-cyan-700",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    borderClass: "hover:border-sky-500/50",
    countryCount: 23,
    population: "600 Milyon",
    areaKm2: "24.709.000 km²",
    highestPoint: { name: "Denali (McKinley)", elevation: "6.190 m", country: "ABD (Alaska)" },
    longestRiver: { name: "Mississippi-Missouri", length: "6.275 km" },
    largestLake: { name: "Superior Gölü", area: "82.100 km²" },
    dominantClimate: "Kutup, Karasal Ilıman ve Çöl İklimi",
    keyFeatures: ["Büyük Göller Havzası (Dünya Tatlı Su Rezervi)", "Kayalık Dağları (Rocky Mountains)", "Büyük Kanyon (Grand Canyon)"],
  },
  {
    id: "GUNEY_AMERIKA",
    nameTr: "Güney Amerika",
    nameEn: "South America",
    code: "SA",
    color: "from-rose-600 to-red-700",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    borderClass: "hover:border-rose-500/50",
    countryCount: 12,
    population: "435 Milyon",
    areaKm2: "17.840.000 km²",
    highestPoint: { name: "Aconcagua Dağı", elevation: "6.961 m", country: "Arjantin" },
    longestRiver: { name: "Amazon Nehri", length: "6.400 km" },
    largestLake: { name: "Titicaca Gölü", area: "8.372 km²" },
    dominantClimate: "Tropikal Yağmur Ormanı ve Dağ İklimi",
    keyFeatures: ["Amazon Yağmur Ormanları (Dünyanın Akciğerleri)", "And Dağ Silsilesi (En Uzun Sıradağ)", "Atacama Çölü (En Kurak Bölge)"],
  },
  {
    id: "OKYANUSYA",
    nameTr: "Okyanusya & Avustralya",
    nameEn: "Oceania",
    code: "OC",
    color: "from-purple-600 to-violet-700",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    borderClass: "hover:border-purple-500/50",
    countryCount: 14,
    population: "45 Milyon",
    areaKm2: "8.525.000 km²",
    highestPoint: { name: "Puncak Jaya", elevation: "4.884 m", country: "Endonezya / Okyanusya" },
    longestRiver: { name: "Murray-Darling", length: "3.672 km" },
    largestLake: { name: "Eyre Gölü", area: "9.500 km²" },
    dominantClimate: "Tropikal, Çöl ve Ilıman Okyanusal",
    keyFeatures: ["Büyük Set Resifi (Great Barrier Reef)", "Avustralya İç Çölleri (Outback)", "Volkanik Polinezya ve Mikronezya Adaları"],
  },
  {
    id: "ANTARKTIKA",
    nameTr: "Antarktika",
    nameEn: "Antarctica",
    code: "AN",
    color: "from-teal-600 to-cyan-800",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    borderClass: "hover:border-teal-500/50",
    countryCount: 0,
    population: "~1.000-5.000 (Bilim İnsanı)",
    areaKm2: "14.200.000 km²",
    highestPoint: { name: "Vinson Masifi", elevation: "4.892 m", country: "Uluslararası Antlaşma" },
    longestRiver: { name: "Onyx Nehri", length: "32 km (Buzul Eriyik)" },
    largestLake: { name: "Vostok Gölü (Buzulaltı)", area: "12.500 km²" },
    dominantClimate: "Kutup İklimi (En Soğuk, En Rüzgarlı, En Kurak)",
    keyFeatures: ["Dünya Buzul Kütlesinin %90'ı", "Uluslararası Bilimsel Araştırma Üsleri", "Kutup Gündüz & Gece Döngüleri"],
  },
];

interface V2WorldContinentsProps {
  onSelectContinent?: (continentId: string) => void;
  countryCounts?: Partial<Record<Continent, number>>;
}

export function V2WorldContinents({ onSelectContinent, countryCounts }: V2WorldContinentsProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="primary" size="sm" icon={<Globe className="size-3.5" />}>
              Kıtalar Atlası
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">Küresel Jeomorfoloji</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)]">
            Dünyanın 7 Kıtası &amp; Coğrafi Karakteristikleri
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Her kıtanın en yüksek zirvesi, en uzun akarsuyu, yüzölçümü ve jeolojik karakteristikleri.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CONTINENTS_DATA.map((continent) => {
          const dynamicCount = countryCounts ? countryCounts[continent.id] ?? continent.countryCount : continent.countryCount;
          return (
            <Card
              key={continent.id}
              className={`border border-border bg-card/80 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-lg ${continent.borderClass} group flex flex-col justify-between`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={continent.badgeClass}>
                    {dynamicCount > 0 ? `${dynamicCount} Ülke` : "Özel Statü"}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">{continent.code}</span>
                </div>
              <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                <span>{continent.nameTr}</span>
                <span className="text-xs font-normal text-muted-foreground">({continent.nameEn})</span>
              </CardTitle>
              <CardDescription className="text-xs flex items-center gap-3 pt-1">
                <span className="flex items-center gap-1">
                  <Compass className="size-3 text-primary" /> {continent.areaKm2}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="size-3 text-secondary" /> {continent.population}
                </span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3.5 text-xs pt-0">
              {/* Key Geographic Landmarks */}
              <div className="space-y-2 rounded-xl bg-muted/40 p-3 border border-border/60">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                    <Mountain className="size-3.5 text-amber-600 dark:text-amber-400" /> Zirve:
                  </span>
                  <span className="font-semibold text-right text-foreground">
                    {continent.highestPoint.name} ({continent.highestPoint.elevation})
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                    <Waves className="size-3.5 text-cyan-600 dark:text-cyan-400" /> Nehir:
                  </span>
                  <span className="font-semibold text-right text-foreground">
                    {continent.longestRiver.name} ({continent.longestRiver.length})
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                    <TreePine className="size-3.5 text-emerald-600 dark:text-emerald-400" /> İklim:
                  </span>
                  <span className="font-medium text-right text-muted-foreground text-[11px]">
                    {continent.dominantClimate}
                  </span>
                </div>
              </div>

              {/* Characteristic Bullets */}
              <div className="space-y-1">
                {continent.keyFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Sparkles className="size-3 text-primary shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {onSelectContinent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs group-hover:border-primary/40 group-hover:text-primary transition-all"
                  onClick={() => onSelectContinent(continent.id)}
                  rightIcon={<ArrowRight className="size-3.5" />}
                >
                  Haritada {continent.nameTr}&apos;yi İncele
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
      </div>
    </section>
  );
}
