"use client";

import * as React from "react";
import { Star, Trophy, Layers, Video } from "lucide-react";

interface V2AuthBenefitsPlateProps {
  mode?: "login" | "register";
}

export function V2AuthBenefitsPlate({ mode = "register" }: V2AuthBenefitsPlateProps) {
  const benefits = [
    {
      icon: <Star className="size-4 text-primary" />,
      title: "Favoriler",
      desc: "81 ilin, 199 ülkenin ve 7 bölgenin sayfalarını favorilerine ekle. Hepsi Hesabım sayfasında tek listede durur.",
    },
    {
      icon: <Trophy className="size-4 text-primary" />,
      title: "Oyun geçmişi ve rozetler",
      desc: "81 il ve bölge bulma oyunlarında bitirdiğin turları kaydet, rozet topla, lider tablosunda nerede olduğuna bak.",
    },
    {
      icon: <Layers className="size-4 text-primary" />,
      title: "Kayıtlı ölçümler",
      desc: "Harita araçlarıyla Haversine formülüyle ölçtüğün mesafeleri ve küre üstünde hesaplanan alanları hesabına kaydet, istediğin zaman listeden bul.",
    },
    {
      icon: <Video className="size-4 text-primary" />,
      title: "Kitap çözüm videoları",
      desc: "AYT Coğrafya branş denemelerinin çözüm videolarını izle. Nerede kaldığın kaydedilir, bitirdiğin denemeyi işaretleyebilirsin.",
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-xl space-y-6 flex flex-col">
      <div className="space-y-6">
        {/* Header & Title */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground font-medium">Üyelik ücretsiz</span>

          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-primary leading-snug">
            {mode === "register" ? "Hesap açınca neler kazanırsın" : "Tekrar hoş geldin"}
          </h3>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Haritalar ve araçlar herkese açık. Hesabınla bunlar da açılır:
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
                <h4 className="font-heading font-bold text-sm text-foreground">{b.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
