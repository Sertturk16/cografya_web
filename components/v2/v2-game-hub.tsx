"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gamepad2,
  MapPin,
  Compass,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
  Brain,
} from "lucide-react";

export function V2GameHub() {
  return (
    <div className="space-y-8">
      {/* 1. CONTROL & MODE SELECTOR PANEL */}
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm" icon={<Gamepad2 className="size-3.5" />}>
                Harita Oyun Stüdyosu v2
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">
                İnteraktif Sınav &amp; Hafıza Motoru
              </span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] mt-1">
              Coğrafya Kâşifi — Türkiye Harita Oyunları
            </h2>
          </div>

          <Badge
            variant="secondary"
            size="sm"
            icon={<Sparkles className="size-3 text-amber-500" />}
          >
            3 Özel Sınav Modu
          </Badge>
        </div>

        {/* Mode Selector Cards (Direct Routing Architecture) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: 81 İl Bulma */}
          <div className="p-6 rounded-3xl border border-border bg-card/80 hover:bg-card hover:border-primary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-primary/15 text-primary group-hover:scale-110 transition-transform">
                  <MapPin className="size-6" />
                </span>
                <Badge variant="primary" size="sm">
                  81 Soru
                </Badge>
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                  81 İl Bulma Sınavı
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Rastgele sorulan Türkiye illerini dilsiz haritada tıklayarak bulun. Seri çarpanı
                  ve akıllı ipucu desteğiyle hafızanızı sınayın.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Eksiksiz 81 il soru havuzu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Seri çarpanı ve zamanlı mod</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/v2/oyun/81-il">
                <Button
                  variant="primary"
                  size="default"
                  className="w-full"
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Sınava Başla
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 2: 7 Bölge Tanıma */}
          <div className="p-6 rounded-3xl border border-border bg-card/80 hover:bg-card hover:border-secondary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-secondary/15 text-secondary group-hover:scale-110 transition-transform">
                  <Compass className="size-6" />
                </span>
                <Badge variant="secondary" size="sm">
                  7 Coğrafi Bölge
                </Badge>
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground group-hover:text-secondary transition-colors">
                  7 Bölge Tanıma
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Türkiye&apos;nin 7 coğrafi bölgesinin sınırlarını ve mekânsal konumlarını renkli
                  vektör poligonlar üzerinde test et.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-teal-600" />
                  <span>7 bölge vektör harita sınırları</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-teal-600" />
                  <span>Bölgesel coğrafya kavrama</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/v2/oyun/bolge-bulma">
                <Button
                  variant="secondary"
                  size="default"
                  className="w-full"
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Bölgeleri Keşfet
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 3: Bölge Bölge İl Quiz'i */}
          <div className="p-6 rounded-3xl border border-border bg-card/80 hover:bg-card hover:border-accent/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-accent/15 text-accent group-hover:scale-110 transition-transform">
                  <Layers className="size-6" />
                </span>
                <Badge variant="info" size="sm">
                  Odaklanmış Mod
                </Badge>
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground group-hover:text-accent transition-colors">
                  Bölge Bölge İl Quiz&apos;i
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Marmara, Ege, Karadeniz gibi dilediğin bölgeyi seç; harita otomatik olarak o
                  bölgeye yakınlaşsın ve illeri tek tek tamamla.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-cyan-600" />
                  <span>Bölgeye özel otomatik zoom</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-cyan-600" />
                  <span>Küçük illeri rahat tıklama</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/v2/oyun/bolge-bolge-il">
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

        {/* Feature Highlights Strip */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <span className="font-semibold text-foreground">Yeni Oyun Özellikleri:</span>
            <span className="text-muted-foreground">
              Canlı Web Audio ses efektleri, Zoom/Pan desteği, akıllı ipuçları ve detaylı inceleme.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-purple-600" />
            <span className="text-muted-foreground">
              Aktif Geri Çağırma (Active Recall) uyumlu MEB müfredatı.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
