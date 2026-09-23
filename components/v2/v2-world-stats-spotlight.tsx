import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Mountain, Flame, Snowflake, Waves } from "lucide-react";

export function V2WorldStatsSpotlight() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-primary">
          Dünyanın Enleri
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Toprağı en geniş ve nüfusu en kalabalık beş ülke, bir de karanın ve denizin uç noktaları.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PANEL 1: EN BÜYÜK 5 ÜLKE (YÜZÖLÇÜMÜ) */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading font-bold text-foreground">
              En Geniş 5 Ülke
            </CardTitle>
            <CardDescription className="text-xs">
              Dünyadaki karaların yaklaşık %37&apos;si bu beş ülkede. Rusya açık ara ilk sırada;
              Kanada, Çin ve ABD birbirine çok yakın.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {[
              {
                rank: 1,
                name: "Rusya",
                iso: "RU",
                area: "17.098.242 km²",
                share: "11,5",
                continent: "Asya / Avrupa",
              },
              {
                rank: 2,
                name: "Kanada",
                iso: "CA",
                area: "9.984.670 km²",
                share: "6,7",
                continent: "Kuzey Amerika",
              },
              {
                rank: 3,
                name: "Çin",
                iso: "CN",
                area: "9.596.961 km²",
                share: "6,4",
                continent: "Asya",
              },
              {
                rank: 4,
                name: "ABD",
                iso: "US",
                area: "9.525.067 km²",
                share: "6,4",
                continent: "Kuzey Amerika",
              },
              {
                rank: 5,
                name: "Brezilya",
                iso: "BR",
                area: "8.515.767 km²",
                share: "5,7",
                continent: "Güney Amerika",
              },
            ].map((country) => (
              <div
                key={country.rank}
                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="size-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center font-mono">
                    #{country.rank}
                  </span>
                  <div>
                    <span className="font-bold text-xs text-foreground block">{country.name}</span>
                    <span className="text-[10px] text-muted-foreground">{country.continent}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs text-primary block">
                    {country.area}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    karaların %{country.share}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* PANEL 2: EN KALABALIK 5 ÜLKE (NÜFUS) */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading font-bold text-foreground">
              En Kalabalık 5 Ülke
            </CardTitle>
            <CardDescription className="text-xs">
              Dünyada yaşayan her 100 kişiden yaklaşık 46&apos;sı bu beş ülkede. Rakamlar BM
              tahmini.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {[
              {
                rank: 1,
                name: "Hindistan",
                iso: "IN",
                pop: "1,43 milyar",
                share: "17,8",
                continent: "Güney Asya",
              },
              {
                rank: 2,
                name: "Çin",
                iso: "CN",
                pop: "1,41 milyar",
                share: "17,5",
                continent: "Doğu Asya",
              },
              {
                rank: 3,
                name: "ABD",
                iso: "US",
                pop: "340 milyon",
                share: "4,2",
                continent: "Kuzey Amerika",
              },
              {
                rank: 4,
                name: "Endonezya",
                iso: "ID",
                pop: "279 milyon",
                share: "3,5",
                continent: "Güneydoğu Asya",
              },
              {
                rank: 5,
                name: "Pakistan",
                iso: "PK",
                pop: "241 milyon",
                share: "3,0",
                continent: "Güney Asya",
              },
            ].map((country) => (
              <div
                key={country.rank}
                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="size-6 rounded-lg bg-secondary/15 text-secondary font-bold text-xs flex items-center justify-center font-mono">
                    #{country.rank}
                  </span>
                  <div>
                    <span className="font-bold text-xs text-foreground block">{country.name}</span>
                    <span className="text-[10px] text-muted-foreground">{country.continent}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs text-secondary block">
                    {country.pop}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    dünyanın %{country.share}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* PANEL 3: AŞIRI FİZİKİ COĞRAFYA EKSTREMLERİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading font-bold text-foreground">
              Uç Noktalar
            </CardTitle>
            <CardDescription className="text-xs">
              Karanın en yüksek ve en alçak yeri, okyanusun en derin çukuru, ölçülmüş en yüksek ve
              en düşük sıcaklık.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2.5 pt-0 text-xs">
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mountain className="size-4 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">En yüksek nokta: Everest</span>
                  <span className="text-[10px] text-muted-foreground">Nepal ile Çin sınırında</span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs">+8.848 m</span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Waves className="size-4 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">En derin çukur: Mariana</span>
                  <span className="text-[10px] text-muted-foreground">
                    Büyük Okyanus, Challenger Derinliği
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs">-10.994 m</span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Waves className="size-4 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">En alçak kara: Lut Gölü</span>
                  <span className="text-[10px] text-muted-foreground">
                    Gölün kıyısı, İsrail ile Ürdün arasında
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs">-440 m</span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="size-4 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">
                    En sıcak ölçüm: Ölüm Vadisi
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Furnace Creek, Kaliforniya, ABD
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs">56,7 °C</span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Snowflake className="size-4 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">
                    En soğuk ölçüm: Vostok İstasyonu
                  </span>
                  <span className="text-[10px] text-muted-foreground">Doğu Antarktika</span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs">−89,2 °C</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
