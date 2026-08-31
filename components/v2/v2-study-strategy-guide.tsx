"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";

export function V2StudyStrategyGuide() {
  const topics = [
    {
      title: "1. Doğal Sistemler & İklim Bilgisi (En Çok Soru Çıkan Alan)",
      desc: "Basınç merkezleri, rüzgârlar, Türkiye'de ve dünyada iklim tipleri, yağış rejimleri ve bitki örtüsü dağılımı her yıl garanti 2 soru getirir.",
      weight: "%35 Ağırlık",
      color: "text-primary",
    },
    {
      title: "2. Beşeri Yapı & Nüfus Piramitleri",
      desc: "Nüfus artış hızı, göç türleri, yerleşme tipleri ve nüfus piramitlerinin analizi grafik ve tablo yorumlama yeteneği gerektirir.",
      weight: "%25 Ağırlık",
      color: "text-secondary",
    },
    {
      title: "3. Ekonomik Coğrafya & Madenler/Enerji",
      desc: "Türkiye'nin maden yatakları, enerji kaynakları (jeotermal, rüzgâr, hidroelektrik) ve sanayi kollarının mekânsal dağılışı.",
      weight: "%20 Ağırlık",
      color: "text-accent",
    },
    {
      title: "4. Harita Okuryazarlığı & Küresel Boğazlar/Kanallar",
      desc: "Hürmüz, Malakka, Süveyş, Panama, Babülmendep gibi kritik deniz ticaret geçitleri dilsiz dünya haritası üzerinden mutlaka çalışılmalıdır.",
      weight: "%20 Ağırlık",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<GraduationCap className="size-3.5" />}>
              Sınav Hazırlık Stratejisi
            </Badge>
            <span className="text-xs text-muted-foreground">
              YKS &amp; KPSS Coğrafya Yol Haritası
            </span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
            AYT &amp; TYT Coğrafya Soru Dağılımı ve Başarı Taktikleri
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topics.map((t) => (
          <div
            key={t.title}
            className="p-5 rounded-2xl border border-border bg-card/70 hover:border-primary/40 transition-all duration-300 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-base text-foreground">{t.title}</h4>
              <Badge variant="secondary" size="sm" className="font-mono text-xs">
                {t.weight}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
