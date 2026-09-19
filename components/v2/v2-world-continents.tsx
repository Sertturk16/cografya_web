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
import { Link } from "@/i18n/navigation";
import { CONTINENT_KEY_TO_SLUG } from "@/lib/geo/continents";
import { continentIdentityOf } from "@/lib/theme/continent-identity";
import type { Continent } from "@/lib/api/types";

/**
 * A continent card's DATA. Not its colour.
 *
 * This table used to carry `color`, `badgeClass` and `borderClass` — the same seven identities
 * `lib/map/continent-theme.ts`'s `CONTINENT_META` held, in the same hue families at different
 * stops, 49 raw palette occurrences that nothing compared against the map's. The colour now
 * comes from `continentIdentityOf(continent.id)` at render time, so the card cannot wear a
 * colour its own `id` does not name and there is nothing here left to mis-assign. `color` was
 * additionally DEAD — declared on every entry and rendered nowhere.
 */
export interface ContinentData {
  id: Continent;
  nameTr: string;
  nameEn: string;
  code: string;
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
    countryCount: 44,
    population: "745 Milyon",
    areaKm2: "10.180.000 km²",
    highestPoint: { name: "Elbrus Dağı", elevation: "5.642 m", country: "Rusya / Kafkaslar" },
    longestRiver: { name: "Volga Nehri", length: "3.530 km" },
    largestLake: { name: "Ladoga Gölü", area: "17.700 km²" },
    dominantClimate: "Ilıman Okyanusal, Akdeniz ve Karasal İklim",
    keyFeatures: [
      "Gelişmiş Sanayi Kuşağı",
      "Alp Dağ Silsilesi",
      "Girintili Çıkıntılı Kıyılar (Fiyortlar)",
    ],
  },
  {
    id: "ASYA",
    nameTr: "Asya",
    nameEn: "Asia",
    code: "AS",
    countryCount: 48,
    population: "4.75 Milyar",
    areaKm2: "44.579.000 km²",
    highestPoint: { name: "Everest Dağı", elevation: "8.848 m", country: "Nepal / Çin" },
    longestRiver: { name: "Yangtze Nehri", length: "6.300 km" },
    largestLake: { name: "Hazar Denizi", area: "371.000 km²" },
    dominantClimate: "Muson, Çöl, Step ve Sibirya Tundra İklimi",
    keyFeatures: [
      "Dünyanın En Yüksek Zirveleri (Himalayalar)",
      "En Kalabalık Nüfus Yoğunluğu",
      "Tibet Yaylası",
    ],
  },
  {
    id: "AFRIKA",
    nameTr: "Afrika",
    nameEn: "Africa",
    code: "AF",
    countryCount: 54,
    population: "1.46 Milyar",
    areaKm2: "30.370.000 km²",
    highestPoint: { name: "Kilimanjaro Dağı", elevation: "5.895 m", country: "Tanzanya" },
    longestRiver: { name: "Nil Nehri", length: "6.650 km" },
    largestLake: { name: "Victoria Gölü", area: "68.800 km²" },
    dominantClimate: "Ekvatoral, Savan ve Tropikal Çöl İklimi",
    keyFeatures: [
      "Büyük Sahra Çölü (En Büyük Sıcak Çöl)",
      "Doğu Afrika Rift Vadisi",
      "Zengin Yaban Hayatı ve Biyoçeşitlilik",
    ],
  },
  {
    id: "KUZEY_AMERIKA",
    nameTr: "Kuzey Amerika",
    nameEn: "North America",
    code: "NA",
    countryCount: 23,
    population: "600 Milyon",
    areaKm2: "24.709.000 km²",
    highestPoint: { name: "Denali (McKinley)", elevation: "6.190 m", country: "ABD (Alaska)" },
    longestRiver: { name: "Mississippi-Missouri", length: "6.275 km" },
    largestLake: { name: "Superior Gölü", area: "82.100 km²" },
    dominantClimate: "Kutup, Karasal Ilıman ve Çöl İklimi",
    keyFeatures: [
      "Büyük Göller Havzası (Dünya Tatlı Su Rezervi)",
      "Kayalık Dağları (Rocky Mountains)",
      "Büyük Kanyon (Grand Canyon)",
    ],
  },
  {
    id: "GUNEY_AMERIKA",
    nameTr: "Güney Amerika",
    nameEn: "South America",
    code: "SA",
    countryCount: 12,
    population: "435 Milyon",
    areaKm2: "17.840.000 km²",
    highestPoint: { name: "Aconcagua Dağı", elevation: "6.961 m", country: "Arjantin" },
    longestRiver: { name: "Amazon Nehri", length: "6.400 km" },
    largestLake: { name: "Titicaca Gölü", area: "8.372 km²" },
    dominantClimate: "Tropikal Yağmur Ormanı ve Dağ İklimi",
    keyFeatures: [
      "Amazon Yağmur Ormanları (Dünyanın Akciğerleri)",
      "And Dağ Silsilesi (En Uzun Sıradağ)",
      "Atacama Çölü (En Kurak Bölge)",
    ],
  },
  {
    id: "OKYANUSYA",
    nameTr: "Okyanusya & Avustralya",
    nameEn: "Oceania",
    code: "OC",
    countryCount: 14,
    population: "45 Milyon",
    areaKm2: "8.525.000 km²",
    highestPoint: { name: "Puncak Jaya", elevation: "4.884 m", country: "Endonezya / Okyanusya" },
    longestRiver: { name: "Murray-Darling", length: "3.672 km" },
    largestLake: { name: "Eyre Gölü", area: "9.500 km²" },
    dominantClimate: "Tropikal, Çöl ve Ilıman Okyanusal",
    keyFeatures: [
      "Büyük Set Resifi (Great Barrier Reef)",
      "Avustralya İç Çölleri (Outback)",
      "Volkanik Polinezya ve Mikronezya Adaları",
    ],
  },
  {
    id: "ANTARKTIKA",
    nameTr: "Antarktika",
    nameEn: "Antarctica",
    code: "AN",
    countryCount: 0,
    population: "~1.000-5.000 (Bilim İnsanı)",
    areaKm2: "14.200.000 km²",
    highestPoint: { name: "Vinson Masifi", elevation: "4.892 m", country: "Uluslararası Antlaşma" },
    longestRiver: { name: "Onyx Nehri", length: "32 km (Buzul Eriyik)" },
    largestLake: { name: "Vostok Gölü (Buzulaltı)", area: "12.500 km²" },
    dominantClimate: "Kutup İklimi (En Soğuk, En Rüzgarlı, En Kurak)",
    keyFeatures: [
      "Dünya Buzul Kütlesinin %90'ı",
      "Uluslararası Bilimsel Araştırma Üsleri",
      "Kutup Gündüz & Gece Döngüleri",
    ],
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
            <span className="text-xs font-semibold text-muted-foreground">
              Küresel Jeomorfoloji
            </span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-primary">
            Dünyanın 7 Kıtası &amp; Coğrafi Karakteristikleri
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Her kıtanın en yüksek zirvesi, en uzun akarsuyu, yüzölçümü ve jeolojik
            karakteristikleri.
          </p>
        </div>
        <Link
          href="/dunya/kita"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-2xs group/btn shrink-0"
        >
          <span>Tüm Kıtaları Karşılaştır</span>
          <ArrowRight className="size-3.5 text-primary transition-transform group-hover/btn:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CONTINENTS_DATA.map((continent) => {
          const dynamicCount = countryCounts
            ? (countryCounts[continent.id] ?? continent.countryCount)
            : continent.countryCount;
          const identity = continentIdentityOf(continent.id);
          return (
            <Card
              key={continent.id}
              className={`border border-border bg-card/80 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-lg ${identity.edgeHover} group flex flex-col justify-between`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {/* BACKDROP: one `--continent-*-tint` over `bg-card/80` over
                      `--background` — the `DECK` column of the table in `app/globals.css`, its
                      own column because this Card is NOT opaque. */}
                  <Badge variant="outline" className={identity.badge}>
                    {dynamicCount > 0 ? `${dynamicCount} Ülke` : "Özel Statü"}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">
                    {continent.code}
                  </span>
                </div>
                <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>{continent.nameTr}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({continent.nameEn})
                  </span>
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
                      <Mountain className="size-3.5" /> Zirve:
                    </span>
                    <span className="font-semibold text-right text-foreground">
                      {continent.highestPoint.name} ({continent.highestPoint.elevation})
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <Waves className="size-3.5" /> Nehir:
                    </span>
                    <span className="font-semibold text-right text-foreground">
                      {continent.longestRiver.name} ({continent.longestRiver.length})
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <TreePine className="size-3.5" /> İklim:
                    </span>
                    <span className="font-medium text-right text-muted-foreground text-[11px]">
                      {continent.dominantClimate}
                    </span>
                  </div>
                </div>

                {/* Characteristic Bullets */}
                <div className="space-y-1">
                  {continent.keyFeatures.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <Sparkles className="size-3 text-primary shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={{
                      pathname: "/dunya/kita/[slug]",
                      params: { slug: CONTINENT_KEY_TO_SLUG[continent.id] },
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-2xs"
                  >
                    <span>{continent.nameTr} Coğrafyası &amp; Ülkeleri</span>
                    <ArrowRight className="size-3.5" />
                  </Link>

                  {onSelectContinent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground border-border/70"
                      onClick={() => onSelectContinent(continent.id)}
                    >
                      Haritada Filtrele
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
