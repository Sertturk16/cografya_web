import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Globe, Users, Compass, Mountain, Flame, Snowflake, Waves } from "lucide-react";

export function V2WorldStatsSpotlight() {
  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant="secondary" size="sm" icon={<Trophy className="size-3.5" />}>
            Dünya Süperlatifleri
          </Badge>
          <span className="text-xs font-semibold text-muted-foreground">
            Coğrafi Ekstremler & Rekorlar
          </span>
        </div>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)]">
          Gezegenin Enleri: Zirveler, Çukurlar & Dev Ülkeler
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Dünyanın yüzölçümü ve nüfus bakımından en büyük ülkeleri ile aşırı fiziki coğrafya
          noktaları.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PANEL 1: EN BÜYÜK 5 ÜLKE (YÜZÖLÇÜMÜ) */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="primary" size="sm" icon={<Compass className="size-3.5" />}>
                Yüzölçümü Liderleri
              </Badge>
              <span className="text-[11px] font-mono text-muted-foreground">Kara Alanı Payı</span>
            </div>
            <CardTitle className="text-lg font-heading font-bold text-foreground">
              Dünyanın En Geniş 5 Ülkesi
            </CardTitle>
            <CardDescription className="text-xs">
              Küresel kara alanının yaklaşık %36&apos;sını kapsayan devasa coğrafyalar.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {[
              {
                rank: 1,
                name: "Rusya",
                iso: "RU",
                area: "17.098.242 km²",
                share: "11.5%",
                continent: "Asya / Avrupa",
              },
              {
                rank: 2,
                name: "Kanada",
                iso: "CA",
                area: "9.984.670 km²",
                share: "6.7%",
                continent: "Kuzey Amerika",
              },
              {
                rank: 3,
                name: "Çin",
                iso: "CN",
                area: "9.596.961 km²",
                share: "6.4%",
                continent: "Asya",
              },
              {
                rank: 4,
                name: "ABD",
                iso: "US",
                area: "9.525.067 km²",
                share: "6.4%",
                continent: "Kuzey Amerika",
              },
              {
                rank: 5,
                name: "Brezilya",
                iso: "BR",
                area: "8.515.767 km²",
                share: "5.7%",
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
                  <span className="text-[10px] text-muted-foreground">{country.share} pay</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* PANEL 2: EN KALABALIK 5 ÜLKE (NÜFUS) */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" size="sm" icon={<Users className="size-3.5" />}>
                Nüfus Devleri
              </Badge>
              <span className="text-[11px] font-mono text-muted-foreground">BM Demografi</span>
            </div>
            <CardTitle className="text-lg font-heading font-bold text-foreground">
              Dünyanın En Kalabalık 5 Ülkesi
            </CardTitle>
            <CardDescription className="text-xs">
              Dünya toplam nüfusunun yaklaşık %46&apos;sını barındıran ülkeler.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {[
              {
                rank: 1,
                name: "Hindistan",
                iso: "IN",
                pop: "1.43 Milyar",
                share: "17.8%",
                continent: "Güney Asya",
              },
              {
                rank: 2,
                name: "Çin",
                iso: "CN",
                pop: "1.41 Milyar",
                share: "17.5%",
                continent: "Doğu Asya",
              },
              {
                rank: 3,
                name: "ABD",
                iso: "US",
                pop: "340 Milyon",
                share: "4.2%",
                continent: "Kuzey Amerika",
              },
              {
                rank: 4,
                name: "Endonezya",
                iso: "ID",
                pop: "279 Milyon",
                share: "3.5%",
                continent: "Güneydoğu Asya",
              },
              {
                rank: 5,
                name: "Pakistan",
                iso: "PK",
                pop: "241 Milyon",
                share: "3.0%",
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
                  <span className="text-[10px] text-muted-foreground">{country.share} küresel</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* PANEL 3: AŞIRI FİZİKİ COĞRAFYA EKSTREMLERİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" size="sm" icon={<Globe className="size-3.5 text-accent" />}>
                Doğal Ekstremler
              </Badge>
              <span className="text-[11px] font-mono text-muted-foreground">Fiziki Rekorlar</span>
            </div>
            <CardTitle className="text-lg font-heading font-bold text-foreground">
              Gezegenin Aşırı Uç Noktaları
            </CardTitle>
            <CardDescription className="text-xs">
              Yeryüzünün en yüksek, en derin, en sıcak ve en kurak doğal sınırları.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2.5 pt-0 text-xs">
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mountain className="size-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">En Yüksek Nokta: Everest</span>
                  <span className="text-[10px] text-muted-foreground">Nepal / Çin Sınırı</span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                +8.848 m
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Waves className="size-4 text-blue-500 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">En Derin Çukur: Mariana</span>
                  <span className="text-[10px] text-muted-foreground">
                    Büyük Okyanus (Challenger Deep)
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                -10.994 m
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Waves className="size-4 text-teal-500 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">En Alçak Kara: Lut Gölü</span>
                  <span className="text-[10px] text-muted-foreground">Lut Gölü Kıyısı</span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs text-teal-600 dark:text-teal-400">
                -430 m
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-red-500 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">En Sıcak Yer: Ölüm Vadisi</span>
                  <span className="text-[10px] text-muted-foreground">
                    Kaliforniya, ABD (Furnace Creek)
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs text-red-600 dark:text-red-400">
                +56.7 °C
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Snowflake className="size-4 text-cyan-500 shrink-0" />
                <div>
                  <span className="font-bold block text-foreground">
                    En Soğuk Yer: Vostok İstasyonu
                  </span>
                  <span className="text-[10px] text-muted-foreground">Doğu Antarktika Platosu</span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs text-cyan-600 dark:text-cyan-400">
                -89.2 °C
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
