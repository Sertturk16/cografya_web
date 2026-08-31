"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  BookOpen,
  Map,
  Layers,
  Gamepad2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  PlayCircle,
  Video,
  FileText,
} from "lucide-react";

export function V2LearningPaths() {
  const publications = [
    {
      id: "ayt-deneme",
      title: "AYT Coğrafya Konu Özetli Branş Denemeleri",
      badge: "Video Çözümlü",
      badgeVariant: "primary" as const,
      color: "from-amber-600 to-amber-800",
      description: "20 Adet fasikül branş denemesi, her sorunun karekodlu ayrıntılı video analizi ve ÖSYM tarzı yeni nesil sorular.",
      details: { items: "20 Deneme", solutions: "120 Soru", format: "ÖSYM Formatı" },
      features: ["Tüm Soruların Adım Adım Video Çözümü", "Konu Özeti ve Kritik Harita Notları", "Akıllı Tahta ve Dijital Entegrasyon"],
      href: "/v2/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri",
      cta: "Kitabı İncele",
    },
    {
      id: "dilsiz-harita",
      title: "Dilsiz Harita & Coğrafi Hafıza Modülü",
      badge: "İnteraktif",
      badgeVariant: "secondary" as const,
      color: "from-emerald-700 to-emerald-900",
      description: "81 ilin konumu, dağ sıraları, tektonik fay hatları, boğazlar ve göllerin dilsiz harita üzerinden uygulamalı tekrarı.",
      details: { items: "81 İl", solutions: "3 Oyun Modu", format: "SVG Vektör" },
      features: ["Dilsiz Harita Üzerinde Konum Bulma", "Zamana Karşı Hızlı Sınav Simülatörü", "Bölgesel ve Küresel Harita Dağılımı"],
      href: "/v2/oyun",
      cta: "Harita Oyunu",
    },
    {
      id: "cbs-araclar",
      title: "CBS & Coğrafi Harita Analiz Araçları",
      badge: "Bilimsel Model",
      badgeVariant: "outline" as const,
      color: "from-blue-700 to-indigo-900",
      description: "WGS84 jeodezik mesafe ölçümü, WGS84 enlem/boylam koordinat dönüşümleri ve poligon jeodezik alan hesaplamaları.",
      details: { items: "3 CBS Aracı", solutions: "WGS84", format: "Jeodezik" },
      features: ["Büyük Daire Jeodezik Mesafe Formülü", "Enlem / Boylam Format Dönüştürücü", "Çokgen Poligon Yüzölçümü Aracı"],
      href: "/v2/araclar",
      cta: "Araçları Aç",
    },
  ];

  return (
    <section className="space-y-6">
      <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
              Yayınlar &amp; Dijital Modüller
            </Badge>
            <span className="text-xs text-muted-foreground">Video Çözümlü Denemeler ve İnteraktif Araçlar</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] mt-1">
            Coğrafya Yayınları &amp; Öğrenme Modülleri
          </h2>
        </div>
        <Link href="/v2/kitaplar">
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
            Tüm Kitap &amp; Yayınlar
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {publications.map((item) => (
          <Card
            key={item.id}
            className="flex flex-col justify-between hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 bg-card overflow-hidden group"
          >
            {/* Header Banner */}
            <div className={`h-36 bg-gradient-to-br ${item.color} p-4 text-white relative overflow-hidden flex flex-col justify-between`}>
              <div className="flex items-center justify-between relative z-10">
                <Badge className="bg-white/20 text-white backdrop-blur-xs border-white/30 text-[10px]">
                  {item.badge}
                </Badge>
                <div className="size-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs group-hover:scale-110 transition-transform">
                  <PlayCircle className="size-5 text-white" />
                </div>
              </div>

              {/* Decorative Glow */}
              <div className="absolute right-0 bottom-0 -mr-6 -mb-6 size-24 rounded-full bg-white/10 blur-xl pointer-events-none" />

              <div className="relative z-10">
                <span className="text-[11px] text-white/80 font-mono block">Resmî Yayın</span>
                <h3 className="font-heading font-bold text-lg text-white leading-tight">
                  {item.title}
                </h3>
              </div>
            </div>

            <CardHeader className="space-y-2 pb-2 pt-4">
              <CardDescription className="text-xs leading-relaxed">{item.description}</CardDescription>

              {/* Key Specs */}
              <div className="grid grid-cols-3 gap-1 py-1.5 border-y border-border text-center text-[10px]">
                <div className="p-1 bg-muted/40 rounded">
                  <span className="text-muted-foreground block">İçerik</span>
                  <span className="font-bold text-foreground">{item.details.items}</span>
                </div>
                <div className="p-1 bg-muted/40 rounded">
                  <span className="text-muted-foreground block">Kapsam</span>
                  <span className="font-bold text-foreground">{item.details.solutions}</span>
                </div>
                <div className="p-1 bg-muted/40 rounded">
                  <span className="text-muted-foreground block">Standart</span>
                  <span className="font-bold text-primary">{item.details.format}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 py-1">
              <div className="space-y-1.5">
                {item.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-border bg-muted/10">
              <Link href={item.href as any} className="w-full">
                <Button
                  variant="primary"
                  className="w-full text-xs font-semibold shadow-xs"
                  rightIcon={<ArrowRight className="size-3.5" />}
                >
                  {item.cta}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
