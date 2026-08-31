"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Waves,
  MapPin,
  Clock,
  Layers,
} from "lucide-react";

export function V2LiveTicker() {
  return (
    <aside aria-label="Canlı Veri Akışı" className="w-full border-b border-border/70 bg-muted/40 backdrop-blur-md overflow-hidden text-xs py-2 px-4 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Status Tag */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="primary" size="sm" dot className="bg-[var(--color-primary,#b0522e)] text-white shadow-2xs font-mono text-[10px] px-2">
            CANLI TELEMETRİ
          </Badge>
          <span className="hidden md:inline-flex text-muted-foreground text-[11px]">
            Copernicus &amp; AFAD Aktif
          </span>
        </div>

        {/* Ticker Items (min-w-0 flex-1 ensures no horizontal overflow on parent) */}
        <div className="flex-1 min-w-0 flex items-center gap-6 overflow-x-auto scrollbar-none py-0.5 text-muted-foreground text-[11px] sm:text-xs">
          <Link href="/v2/deprem" className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors">
            <Flame className="size-3.5 text-destructive animate-pulse" />
            <span className="font-semibold text-foreground">Son Deprem:</span>
            <span>M 3.6 Göksun, Kahramanmaraş</span>
            <span className="text-[10px] text-muted-foreground font-mono">(15 dk önce)</span>
          </Link>

          <span className="text-border">|</span>

          <Link href="/v2/deniz" className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors">
            <Waves className="size-3.5 text-accent" />
            <span className="font-semibold text-foreground">Marmara:</span>
            <span>23.4 °C (Dalga: 0.4m)</span>
          </Link>

          <span className="text-border">|</span>

          <Link href="/v2/deniz" className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors">
            <Waves className="size-3.5 text-accent" />
            <span className="font-semibold text-foreground">Akdeniz:</span>
            <span>29.5 °C (Dalga: 0.7m)</span>
          </Link>

          <span className="text-border">|</span>

          <Link href="/v2/turkiye" className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors">
            <MapPin className="size-3.5 text-secondary" />
            <span className="font-semibold text-foreground">81 İl Atlası:</span>
            <span>Resmî TÜİK &amp; Harita Verisi</span>
          </Link>

          <span className="text-border">|</span>

          <Link href="/v2/araclar" className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors">
            <Layers className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">CBS Araçları:</span>
            <span>WGS84 Jeodezik Hesaplama</span>
          </Link>
        </div>

        {/* Right Timestamp */}
        <div className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-muted-foreground shrink-0">
          <Clock className="size-3 text-muted-foreground" />
          <span>CANLI UTC+3</span>
        </div>
      </div>
    </aside>
  );
}
