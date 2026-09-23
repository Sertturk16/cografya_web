"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Mountain, Waves, TreePine, Users, Compass, ArrowRight, Sparkles } from "lucide-react";
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
    population: "745 milyon",
    areaKm2: "10.180.000 km²",
    highestPoint: { name: "Elbrus Dağı", elevation: "5.642 m", country: "Rusya / Kafkaslar" },
    longestRiver: { name: "Volga Nehri", length: "3.530 km" },
    largestLake: { name: "Ladoga Gölü", area: "17.700 km²" },
    dominantClimate: "Ilıman Okyanusal, Akdeniz ve Karasal İklim",
    keyFeatures: [
      "Alp Dağları",
      "Kuzeyde fiyortlarla girintili çıkıntılı kıyılar",
      "Birbirine yakın, yoğun sanayi bölgeleri",
    ],
  },
  {
    id: "ASYA",
    nameTr: "Asya",
    nameEn: "Asia",
    code: "AS",
    countryCount: 48,
    population: "4,75 milyar",
    areaKm2: "44.579.000 km²",
    highestPoint: { name: "Everest Dağı", elevation: "8.849 m", country: "Nepal / Çin" },
    longestRiver: { name: "Yangtze Nehri", length: "6.300 km" },
    largestLake: { name: "Hazar Denizi", area: "371.000 km²" },
    dominantClimate: "Muson, Çöl, Step ve Sibirya Tundra İklimi",
    keyFeatures: [
      "Everest ve en yüksek zirveler Himalayalarda",
      "Dünyanın en kalabalık ve nüfusu en yoğun kıtası",
      "Ortalama 4.500 m yükseklikte Tibet Platosu",
    ],
  },
  {
    id: "AFRIKA",
    nameTr: "Afrika",
    nameEn: "Africa",
    code: "AF",
    countryCount: 54,
    population: "1,46 milyar",
    areaKm2: "30.370.000 km²",
    highestPoint: { name: "Kilimanjaro Dağı", elevation: "5.895 m", country: "Tanzanya" },
    longestRiver: { name: "Nil Nehri", length: "6.650 km" },
    largestLake: { name: "Victoria Gölü", area: "68.800 km²" },
    dominantClimate: "Ekvatoral, Savan ve Tropikal Çöl İklimi",
    keyFeatures: [
      "Sahra, dünyanın en büyük sıcak çölü",
      "Doğuda kıtayı yaran Rift Vadisi",
      "Savanlarda zengin yaban hayatı",
    ],
  },
  {
    id: "KUZEY_AMERIKA",
    nameTr: "Kuzey Amerika",
    nameEn: "North America",
    code: "NA",
    countryCount: 23,
    population: "600 milyon",
    areaKm2: "24.709.000 km²",
    highestPoint: { name: "Denali (McKinley)", elevation: "6.190 m", country: "ABD (Alaska)" },
    longestRiver: { name: "Mississippi-Missouri", length: "6.275 km" },
    largestLake: { name: "Superior Gölü", area: "82.100 km²" },
    dominantClimate: "Kutup, Karasal Ilıman ve Çöl İklimi",
    keyFeatures: [
      "Büyük Göller, dünyanın en büyük tatlı su göl grubu",
      "Batıda boydan boya Kayalık Dağları",
      "Colorado Nehri'nin oyduğu Büyük Kanyon",
    ],
  },
  {
    id: "GUNEY_AMERIKA",
    nameTr: "Güney Amerika",
    nameEn: "South America",
    code: "SA",
    countryCount: 12,
    population: "435 milyon",
    areaKm2: "17.840.000 km²",
    highestPoint: { name: "Aconcagua Dağı", elevation: "6.961 m", country: "Arjantin" },
    longestRiver: { name: "Amazon Nehri", length: "6.400 km" },
    largestLake: { name: "Titicaca Gölü", area: "8.372 km²" },
    dominantClimate: "Tropikal Yağmur Ormanı ve Dağ İklimi",
    keyFeatures: [
      "Amazon, en geniş tropikal yağmur ormanı",
      "And Dağları, karadaki en uzun sıradağ",
      "Atacama, kutuplar dışındaki en kurak çöl",
    ],
  },
  {
    id: "OKYANUSYA",
    nameTr: "Okyanusya ve Avustralya",
    nameEn: "Oceania",
    code: "OC",
    countryCount: 14,
    population: "45 milyon",
    areaKm2: "8.525.000 km²",
    highestPoint: { name: "Wilhelm Dağı", elevation: "4.509 m", country: "Papua Yeni Gine" },
    longestRiver: { name: "Murray-Darling", length: "3.672 km" },
    largestLake: { name: "Eyre Gölü", area: "9.500 km²" },
    dominantClimate: "Tropikal, Çöl ve Ilıman Okyanusal",
    keyFeatures: [
      "Büyük Set Resifi Avustralya kıyısı boyunca uzanır",
      "Avustralya'nın içi büyük ölçüde çöl",
      "Pasifik'e dağılmış binlerce küçük ada",
    ],
  },
  {
    id: "ANTARKTIKA",
    nameTr: "Antarktika",
    nameEn: "Antarctica",
    code: "AN",
    countryCount: 0,
    population: "Yalnız araştırmacılar, 1.000-5.000 kişi",
    areaKm2: "14.200.000 km²",
    highestPoint: { name: "Vinson Masifi", elevation: "4.892 m", country: "Uluslararası Antlaşma" },
    longestRiver: { name: "Onyx Nehri", length: "32 km, yazın akar" },
    largestLake: { name: "Vostok Gölü (Buzulaltı)", area: "12.500 km²" },
    dominantClimate: "Kutup iklimi: en soğuk, en rüzgârlı, en kurak",
    keyFeatures: [
      "Dünyadaki buzun yaklaşık %90'ı burada",
      "Kalıcı nüfus yok, yalnız araştırma üsleri var",
      "Aylarca süren kutup gündüzü ve gecesi",
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
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-primary">
            Yedi Kıta
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Her kartta kıtanın yüzölçümü, nüfusu, en yüksek dağı, en uzun nehri ve iklimi var.
          </p>
        </div>
        <Link
          href="/dunya/kita"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-2xs group/btn shrink-0"
        >
          <span>Kıtaları yan yana karşılaştır</span>
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
                    {dynamicCount > 0 ? `${dynamicCount} ülke` : "Ülke yok"}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>{continent.nameTr}</span>
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
                      <Mountain className="size-3.5" /> En yüksek:
                    </span>
                    <span className="font-semibold text-right text-foreground">
                      {continent.highestPoint.name} ({continent.highestPoint.elevation})
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <Waves className="size-3.5" /> En uzun nehir:
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
                    <span>{continent.nameTr} sayfasına git</span>
                    <ArrowRight className="size-3.5" />
                  </Link>

                  {onSelectContinent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground border-border/70"
                      onClick={() => onSelectContinent(continent.id)}
                    >
                      Haritada Göster
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
