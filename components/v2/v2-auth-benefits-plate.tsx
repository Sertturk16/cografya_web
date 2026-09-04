"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Star, Trophy, Layers, Video, ShieldCheck, Sparkles } from "lucide-react";

interface V2AuthBenefitsPlateProps {
  mode?: "login" | "register";
}

export function V2AuthBenefitsPlate({ mode = "register" }: V2AuthBenefitsPlateProps) {
  const benefits = [
    {
      icon: <Star className="size-4 text-amber-500" />,
      title: "Kişisel Favoriler & Hızlı Erişim",
      desc: "İlgi duyduğun 81 il ve 248 ülkeyi favorilerine ekle, güncel hava, iklim ve deniz telemetrilerini anında takip et.",
      badge: "Özelleştirilmiş",
    },
    {
      icon: <Trophy className="size-4 text-emerald-500" />,
      title: "Harita Oyunları & Başarı Rozetleri",
      desc: "81 İl ve Bölge bulma sınavlarında skorlarını kaydet, '81 İl Fatihi' rozetini kazan ve lider tablosuna adını yazdır.",
      badge: "Oyunlaştırma",
    },
    {
      icon: <Layers className="size-4 text-primary" />,
      title: "Bulut Tabanlı CBS Ölçüm Arşivi",
      desc: "Harita üzerinde yaptığın Haversine mesafe ve küresel çokgen alan ölçümlerini hesabına kaydedip dilediğin zaman incele.",
      badge: "CBS Arşivi",
    },
    {
      icon: <Video className="size-4 text-rose-500" />,
      title: "Video Çözüm İlerleme Takibi",
      desc: "AYT Coğrafya branş denemelerinde hangi soruları çözüp izlediğini soru soru işaretle, eksik konularını tespit et.",
      badge: "Soru Analitiği",
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-xl space-y-6 flex flex-col justify-between h-full">
      <div className="space-y-6">
        {/* Header Badge & Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Sparkles className="size-3.5" />}>
              Coğrafya Gurmesi Üyeliği
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">Tamamen Ücretsiz</span>
          </div>

          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] leading-snug">
            {mode === "register"
              ? "Yeni Nesil Coğrafya Dünyasına Adım At"
              : "Kişisel Coğrafya Merkezine Hoş Geldin"}
          </h3>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Coğrafya Gurmesi hesabınla tüm atlas araçlarına, canlı telemetri kayıtlarına ve sınav
            takip modüllerine tek noktadan eriş.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="space-y-3.5">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="p-4 rounded-2xl border border-border/80 bg-muted/40 hover:border-primary/40 transition-all duration-200 flex items-start gap-3.5 shadow-2xs"
            >
              <div className="size-8 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                {b.icon}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-heading font-bold text-sm text-foreground truncate">
                    {b.title}
                  </h4>
                  <Badge variant="outline" className="text-[10px] py-0 font-mono shrink-0">
                    {b.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust & Verification Footer */}
      <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>KVKK ve GDPR Uyumlu Güvenli Altyapı</span>
        </div>
        <span className="font-mono text-[11px]">81 İl &bull; 248 Ülke &bull; 30 İstasyon</span>
      </div>
    </div>
  );
}
