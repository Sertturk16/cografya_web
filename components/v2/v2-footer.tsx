"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Compass, Map, Globe, Waves, Flame, Gamepad2, Layers, BookOpen, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function V2Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-card/60 backdrop-blur-md text-foreground transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Col 1 & 2: Brand and Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/v2" className="flex items-center gap-2.5 group inline-flex">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[var(--color-primary,#b0522e)] to-[var(--color-primary-dark,#7e3a1e)] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                <Compass className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-lg font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-none">
                  Coğrafya<span className="text-primary font-normal">.v2</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Yeni Nesil Coğrafya Portalı
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
              Türkiye'nin 81 ili, 199 dünya ülkesi, saatlik güncellenen Copernicus deniz telemetrisi, AFAD deprem verileri ve interaktif CBS harita araçlarıyla açık coğrafya platformu.
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge variant="outline" size="sm" className="text-[10px] font-mono border-border">
                TÜİK &amp; OSM
              </Badge>
              <Badge variant="outline" size="sm" className="text-[10px] font-mono border-border">
                Copernicus
              </Badge>
              <Badge variant="outline" size="sm" className="text-[10px] font-mono border-border">
                ECMWF
              </Badge>
              <Badge variant="outline" size="sm" className="text-[10px] font-mono border-border">
                AFAD
              </Badge>
            </div>
          </div>

          {/* Col 3: Atlas & Haritalar */}
          <div className="space-y-3">
            <h3 className="font-heading font-bold text-sm text-foreground flex items-center gap-1.5">
              <Map className="size-4 text-primary" />
              Atlas &amp; Haritalar
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/v2/turkiye" className="hover:text-primary transition-colors block">
                  Türkiye İlleri (81 İl)
                </Link>
              </li>
              <li>
                <Link href="/v2/dunya" className="hover:text-primary transition-colors block">
                  Dünya Atlası (199 Ülke)
                </Link>
              </li>
              <li>
                <Link href="/v2/deniz" className="hover:text-primary transition-colors block">
                  Canlı Deniz Telemetrisi
                </Link>
              </li>
              <li>
                <Link href="/v2/deprem" className="hover:text-primary transition-colors block">
                  Canlı Deprem Radarı
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Etkileşim & CBS Araçları */}
          <div className="space-y-3">
            <h3 className="font-heading font-bold text-sm text-foreground flex items-center gap-1.5">
              <Layers className="size-4 text-secondary" />
              Etkileşim &amp; CBS
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/v2/oyun" className="hover:text-secondary transition-colors block">
                  Harita Oyunu (3 Mod)
                </Link>
              </li>
              <li>
                <Link href={"/v2/araclar/mesafe-olcme" as any} className="hover:text-secondary transition-colors block">
                  Kuş Uçuşu Mesafe Ölçme
                </Link>
              </li>
              <li>
                <Link href={"/v2/araclar/koordinat-bulma" as any} className="hover:text-secondary transition-colors block">
                  Koordinat Bulma &amp; Dönüştürme
                </Link>
              </li>
              <li>
                <Link href={"/v2/araclar/alan-hesaplama" as any} className="hover:text-secondary transition-colors block">
                  Poligon Alan Hesaplama
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Yayınlar & Kurumsal */}
          <div className="space-y-3">
            <h3 className="font-heading font-bold text-sm text-foreground flex items-center gap-1.5">
              <BookOpen className="size-4 text-accent" />
              Yayınlar &amp; Hesap
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/v2/kitaplar" className="hover:text-accent transition-colors block">
                  Video Çözümlü Kitaplar
                </Link>
              </li>
              <li>
                <Link href="/hakkimizda" className="hover:text-accent transition-colors block">
                  Platform Hakkında
                </Link>
              </li>
              <li>
                <Link href="/v2/giris" className="hover:text-accent transition-colors block">
                  Kullanıcı Girişi
                </Link>
              </li>
              <li>
                <Link href="/v2/kayit" className="hover:text-accent transition-colors block">
                  Ücretsiz Kayıt Ol
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {currentYear} Coğrafya Platformu. Açık, bilimsel ve kaynaklı coğrafya eğitimi.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/v2/turkiye" className="hover:underline">
              81 İl Atlası
            </Link>
            <span className="text-border">·</span>
            <Link href="/v2/dunya" className="hover:underline">
              199 Ülke Atlası
            </Link>
            <span className="text-border">·</span>
            <Link href="/v2/deniz" className="hover:underline">
              Deniz Durumu
            </Link>
            <span className="text-border">·</span>
            <Link href="/hakkimizda" className="hover:underline">
              Hakkımızda
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
