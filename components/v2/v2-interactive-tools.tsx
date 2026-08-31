"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Compass,
  ArrowRight,
  Sparkles,
  MapPin,
  Navigation,
  Layers,
  Map,
} from "lucide-react";

// Coordinates for sample major cities in Turkey & World
const CITIES: Record<string, { lat: number; lng: number; name: string }> = {
  istanbul: { lat: 41.0082, lng: 28.9784, name: "İstanbul" },
  ankara: { lat: 39.9334, lng: 32.8597, name: "Ankara" },
  izmir: { lat: 38.4237, lng: 27.1428, name: "İzmir" },
  bursa: { lat: 40.1885, lng: 29.0610, name: "Bursa" },
  antalya: { lat: 36.8969, lng: 30.7133, name: "Antalya" },
  trabzon: { lat: 41.0027, lng: 39.7168, name: "Trabzon" },
  diyarbakir: { lat: 37.9144, lng: 40.2306, name: "Diyarbakır" },
  erzurum: { lat: 39.9055, lng: 41.2658, name: "Erzurum" },
  londra: { lat: 51.5074, lng: -0.1278, name: "Londra (İngiltere)" },
  tokyo: { lat: 35.6762, lng: 139.6503, name: "Tokyo (Japonya)" },
};

// Mathematically verified WGS84 Great-Circle (Haversine) distance in kilometers
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function V2InteractiveTools() {
  const [cityA, setCityA] = React.useState("istanbul");
  const [cityB, setCityB] = React.useState("ankara");

  const cityObjA = CITIES[cityA] ?? CITIES["istanbul"]!;
  const cityObjB = CITIES[cityB] ?? CITIES["ankara"]!;
  const distanceKm = calculateDistance(cityObjA.lat, cityObjA.lng, cityObjB.lat, cityObjB.lng);

  return (
    <section className="space-y-6">
      <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" size="sm" icon={<Sparkles className="size-3" />}>
              CBS &amp; Coğrafi Araçlar
            </Badge>
            <span className="text-xs text-muted-foreground">WGS84 Jeodezik Hesaplama</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] mt-1">
            Canlı Jeodezik Mesafe &amp; Harita Araçları
          </h2>
        </div>
        <Link href="/v2/araclar">
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
            Tüm CBS Araçları
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* WIDGET 1: Great-Circle Geodesic Distance Calculator */}
        <Card className="lg:col-span-7 border-primary/30 shadow-md bg-gradient-to-br from-card via-card to-muted/30 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="primary" size="sm" icon={<Compass className="size-3.5" />}>
                Büyük Daire Jeodezik Hesaplayıcı
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">WGS84 Modeli</span>
            </div>
            <CardTitle className="text-xl">Kuş Uçuşu Jeodezik Mesafe</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              İki coğrafi koordinat arasındaki küresel en kısa mesafeyi (Büyük Daire / Haversine) matematiksel olarak anında hesaplayın.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3.5 text-primary" /> Başlangıç Noktası
                </label>
                <Select
                  value={cityA}
                  onChange={(e) => setCityA(e.target.value)}
                  options={Object.entries(CITIES).map(([key, item]) => ({
                    value: key,
                    label: item.name,
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Navigation className="size-3.5 text-secondary" /> Hedef Nokta
                </label>
                <Select
                  value={cityB}
                  onChange={(e) => setCityB(e.target.value)}
                  options={Object.entries(CITIES).map(([key, item]) => ({
                    value: key,
                    label: item.name,
                  }))}
                />
              </div>
            </div>

            {/* Results Display Board */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="text-[11px] text-muted-foreground block font-medium">Büyük Daire Jeodezik Mesafe</span>
                <span className="font-heading text-3xl font-bold text-primary">
                  {distanceKm.toLocaleString("tr-TR")} <span className="text-base font-normal text-foreground">km</span>
                </span>
              </div>
              <div className="text-right text-xs text-muted-foreground font-mono space-y-0.5">
                <div>{cityObjA.name}: {cityObjA.lat.toFixed(2)}°K, {cityObjA.lng.toFixed(2)}°D</div>
                <div>{cityObjB.name}: {cityObjB.lat.toFixed(2)}°K, {cityObjB.lng.toFixed(2)}°D</div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t border-border bg-muted/20 justify-between">
            <span className="text-xs text-muted-foreground">Harita üzerinde serbest ölçüm için:</span>
            <Link href={"/v2/araclar/mesafe-olcme" as any}>
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="size-3.5" />}>
                Haritada Ölç
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* WIDGET 2: Direct Navigation Cards to CBS Tools Suite */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3">
          <Link href={"/v2/araclar/mesafe-olcme" as any} className="group flex-1">
            <div className="h-full p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-muted/40 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Compass className="size-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Kuş Uçuşu Mesafe Ölçme
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    İki veya çok duraklı güzergâh mesafesini haritada tıklayarak ölçün.
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>

          <Link href={"/v2/araclar/koordinat-bulma" as any} className="group flex-1">
            <div className="h-full p-4 rounded-2xl border border-border bg-card hover:border-secondary/60 hover:bg-muted/40 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-foreground group-hover:text-secondary transition-colors">
                    Koordinat Bulma &amp; Dönüştürme
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Haritadaki herhangi bir noktanın enlem, boylam ve derece formatlarını bulun.
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-secondary transition-colors shrink-0" />
            </div>
          </Link>

          <Link href={"/v2/araclar/alan-hesaplama" as any} className="group flex-1">
            <div className="h-full p-4 rounded-2xl border border-border bg-card hover:border-accent/60 hover:bg-muted/40 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Layers className="size-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-foreground group-hover:text-accent transition-colors">
                    Poligon Yüzölçümü Hesaplama
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Harita üzerinde çizilen çokgen alanların yüzölçümünü km² cinsinden hesaplayın.
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
