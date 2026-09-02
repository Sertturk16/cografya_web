"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Compass,
  MapPin,
  Layers,
} from "lucide-react";

export function V2GamePedagogyGuide() {
  const techniques = [
    {
      title: "1. Zihinsel Harita Çapaları (Mental Anchors)",
      desc: "İlleri tek tek ezberlemek yerine; deniz kıyıları, göller (Tuz Gölü, Van Gölü) ve sınır boyları gibi doğal nirengi noktalarını referans alın.",
      icon: <Compass className="size-5 text-primary" />,
    },
    {
      title: "2. Komşuluk & Havza Kümeleme",
      desc: "İlleri bağımsız değil, ait oldukları havzalar ve komşu iller ağıyla birlikte düşünün (örn. Çukurova havzasında Adana-Mersin-Osmaniye kümesi).",
      icon: <Layers className="size-5 text-secondary" />,
    },
    {
      title: "3. Plaka Sırası & Kronolojik Coğrafya",
      desc: "Cumhuriyet dönemi ilk 67 ilin alfabetik düzeni ile sonradan il olan 14 ilin (68 Aksaray - 81 Düzce) konum mantığını kavrayın.",
      icon: <MapPin className="size-5 text-accent" />,
    },
    {
      title: "4. Aktif Geri Çağırma (Active Recall)",
      desc: "Dilsiz haritada konum tahmin etmek, pasif harita okumaya göre %300 daha kalıcı sinaptik bağlar kurarak görsel hafızayı pekiştirir.",
      icon: <Brain className="size-5 text-purple-600" />,
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Brain className="size-3.5" />}>
              Pedagojik Öğrenme Metodu
            </Badge>
            <span className="text-xs text-muted-foreground">Mekânsal Biliş &amp; Görsel Hafıza</span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
            Harita Hafızasını Güçlendirme &amp; Sınav Başarı Rehberi
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {techniques.map((tech) => (
          <div
            key={tech.title}
            className="p-4 sm:p-5 rounded-2xl border border-border bg-card/70 hover:border-primary/40 transition-all duration-300 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted/60 border border-border">
                {tech.icon}
              </div>
              <h4 className="font-heading font-bold text-base text-foreground">{tech.title}</h4>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-1">
              {tech.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
