"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Building2, PhoneCall, Radio } from "lucide-react";

export function V2EarthquakePreparedness() {
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<ShieldCheck className="size-3.5" />}>
              Afet Bilinci &amp; Güvenlik
            </Badge>
            <span className="text-xs text-muted-foreground">
              AFAD Temel Afet Bilinci Standartları
            </span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
            Deprem Öncesi, Sırası ve Sonrası Rehberi
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Building2 className="size-4" />
            <span>Deprem Öncesi Hazırlık</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Evindeki ağır eşyaları sabitle, deprem çantası hazırla ve aile acil durum toplanma
            alanını e-Devlet üzerinden önceden öğren.
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 space-y-2">
          <div className="flex items-center gap-2 text-secondary font-bold text-sm">
            <ShieldCheck className="size-4" />
            <span>Deprem Anında: Çök - Kapan - Tutun</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pencere, balkon ve merdivenlerden uzak dur. Sağlam bir eşyanın yanında hayat üçgeni
            pozisyonu alarak sarsıntı geçene kadar bekle.
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 space-y-2">
          <div className="flex items-center gap-2 text-accent font-bold text-sm">
            <PhoneCall className="size-4" />
            <span>Deprem Sonrası İletişim</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Telefon hatlarını meşgul etme, SMS veya internet tabanlı haberleşme kanallarını kullan.
            Resmî AFAD anonslarını takip et.
          </p>
        </div>
      </div>

      {/* Scientific Attribution Strip */}
      <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <span>
            Veri Kaynağı:{" "}
            <strong>T.C. İçişleri Bakanlığı AFAD Deprem Dairesi Başkanlığı (TDVMS)</strong>
          </span>
        </div>
        <span className="text-[11px] font-mono">Güncelleme: 120 sn Otomatik Canlı Akış</span>
      </div>
    </div>
  );
}
