"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { V2LeaderboardButton } from "./v2-leaderboard-modal";
import { MapPin, Compass, Layers, ArrowRight, CheckCircle2 } from "lucide-react";

export function V2GameHub() {
  return (
    <div className="space-y-8">
      {/* 1. CONTROL & MODE SELECTOR PANEL */}
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="border-b border-border pb-5">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-primary">Bir Oyun Seç</h2>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Üç oyun da Türkiye haritasında oynanır.
          </p>
        </div>

        {/* Mode Selector Cards (Direct Routing Architecture) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: 81 İl Bulma */}
          <div className="p-6 rounded-3xl border border-border bg-card/80 hover:bg-card hover:border-primary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
            <div className="space-y-4">
              <span className="inline-flex p-3 rounded-2xl bg-primary/15 text-primary group-hover:scale-110 transition-transform">
                <MapPin className="size-6" />
              </span>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                  81 İl Bulma
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Sorulan ili dilsiz haritada bul. Takılırsan ipucu al: ilin bölgesini ve plaka
                  kodunu söyler, ama o sorunun puanı yarıya iner.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  <span>81 ilin hepsi, karışık sırayla</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  <span>Art arda bildikçe ek puan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  <span>İstersen 60 saniyeye karşı oyna</span>
                </div>
              </div>
            </div>

            <div className="pt-6 flex items-center gap-2">
              <Link href="/oyun/81-il" className="flex-1">
                <Button
                  variant="primary"
                  size="default"
                  className="w-full"
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Oyuna Başla
                </Button>
              </Link>
              <V2LeaderboardButton mode="provinces" variant="outline" />
            </div>
          </div>

          {/* Card 2: 7 Bölge Tanıma */}
          <div className="p-6 rounded-3xl border border-border bg-card/80 hover:bg-card hover:border-secondary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
            <div className="space-y-4">
              <span className="inline-flex p-3 rounded-2xl bg-secondary/15 text-secondary group-hover:scale-110 transition-transform">
                <Compass className="size-6" />
              </span>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground group-hover:text-secondary transition-colors">
                  7 Bölge Tanıma
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Harita bölgelere göre boyalı ama adları yazmıyor. Adı sorulan bölgeyi bul ve
                  üstüne tıkla.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-secondary" />
                  <span>7 coğrafi bölgenin hepsi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-secondary" />
                  <span>İpucu kıyısını ve komşularını söyler</span>
                </div>
              </div>
            </div>

            <div className="pt-6 flex items-center gap-2">
              <Link href="/oyun/bolge-bulma" className="flex-1">
                <Button
                  variant="secondary"
                  size="default"
                  className="w-full"
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Bölgeleri Keşfet
                </Button>
              </Link>
              <V2LeaderboardButton mode="regions" variant="outline" />
            </div>
          </div>

          {/* Card 3: Bölge Bölge İl Bulma */}
          <div className="p-6 rounded-3xl border border-border bg-card/80 hover:bg-card hover:border-accent/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
            <div className="space-y-4">
              <span className="inline-flex p-3 rounded-2xl bg-accent/15 text-accent group-hover:scale-110 transition-transform">
                <Layers className="size-6" />
              </span>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground group-hover:text-accent transition-colors">
                  Bölge Bölge İl Bulma
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Marmara, Ege ya da Karadeniz gibi bir bölge seç. Harita o bölgeye yakınlaşır, sen
                  de illerini tek tek bulursun.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-accent" />
                  <span>Yalnız o bölgenin illeri sorulur</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-accent" />
                  <span>Küçük illere tıklamak kolaylaşır</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/oyun/bolge-bolge-il">
                <Button
                  variant="outline"
                  size="default"
                  className="w-full hover:bg-accent/10 hover:text-accent"
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Bölge Seçimine Git
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
