"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Compass,
  MapPin,
  Layers,
  Sparkles,
  ArrowRight,
  Route,
  CheckCircle2,
  GraduationCap,
  Users,
  BookOpen,
} from "lucide-react";

export function V2ToolsHub() {
  return (
    <div className="space-y-14">
      {/* 1. THREE DEDICATED TOOL NAVIGATION CARDS (HERO GRADE WITH BUTTON COMPONENTS) */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)]">
              Özel CBS &amp; Harita Ölçüm Modülleri
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              İhtiyacınıza uygun müstakil ölçüm aracını seçerek tam ekran odaklı çalışma tuvali
              üzerinde ölçüm yapın.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Mesafe Ölçer (Turuncu / Beyaz Buton) */}
          <div className="p-6 sm:p-7 rounded-3xl border border-border bg-gradient-to-b from-card via-card to-primary/5 hover:border-primary/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-primary/15 text-primary group-hover:scale-110 transition-transform">
                  <Route className="size-6" />
                </span>
                <Badge variant="primary" size="sm">
                  Jeodezik Kuş Uçuşu
                </Badge>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Kuş Uçuşu Mesafe Ölçer
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
                  İki veya çok duraklı güzergâhlar boyunca büyük daire yay mesafesini, tahmini uçuş
                  süresini ve karayolu farkını hesapla.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2 text-xs text-muted-foreground pt-3 border-t border-border/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>WGS84 Haversine büyük daire yayı</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>800 km/s uçuş süresi &amp; %28 karayolu tahmini</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Dinamik metrik çizgi ölçek (Scale Bar)</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-border/60">
              <Link href="/v2/araclar/mesafe-olcme" className="block w-full">
                <Button
                  variant="primary"
                  className="w-full text-white font-bold h-11 text-xs gap-2"
                  rightIcon={
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Mesafe Aracını Başlat
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 2: Koordinat Bulucu (Yeşil / Beyaz Buton) */}
          <div className="p-6 sm:p-7 rounded-3xl border border-border bg-gradient-to-b from-card via-card to-emerald-500/5 hover:border-emerald-500/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-emerald-600/15 text-emerald-600 group-hover:scale-110 transition-transform">
                  <MapPin className="size-6" />
                </span>
                <Badge
                  variant="outline"
                  size="sm"
                  className="border-emerald-600/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                >
                  WGS84, DMS &amp; UTM
                </Badge>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                  Koordinat &amp; Konum Bulucu
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
                  Haritada dilediğin noktaya tıklayarak enlem/boylam, DMS, UTM projeksiyon zonunu ve
                  noktanın hangi il sınırında olduğunu öğren.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2 text-xs text-muted-foreground pt-3 border-t border-border/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  <span>Ondalık Derece (DD) &amp; DMS Çift Format</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  <span>Noktadan İl Tespiti (Reverse Geocoding)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  <span>6° UTM Dilim (Zone 35-38N) eşlemesi</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-border/60">
              <Link href="/v2/araclar/koordinat-bulma" className="block w-full">
                <Button
                  variant="emerald"
                  className="w-full text-white font-bold h-11 text-xs gap-2"
                  rightIcon={
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Koordinat Aracını Başlat
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 3: Alan Hesaplama (Mavi / Beyaz Buton) */}
          <div className="p-6 sm:p-7 rounded-3xl border border-border bg-gradient-to-b from-card via-card to-sky-500/5 hover:border-sky-500/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-sky-600/15 text-sky-600 group-hover:scale-110 transition-transform">
                  <Layers className="size-6" />
                </span>
                <Badge
                  variant="outline"
                  size="sm"
                  className="border-sky-600/30 text-sky-700 dark:text-sky-300 bg-sky-500/10"
                >
                  Küresel Çokgen Yüzölçümü
                </Badge>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-sky-600 transition-colors">
                  Çokgen Yüzölçümü &amp; Alan Hesabı
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
                  Haritada belirlediğin köşe noktalarıyla çokgenler oluşturarak km², hektar, dönüm
                  ve çevre uzunluğunu L&apos;Huilier hassasiyetiyle ölç.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2 text-xs text-muted-foreground pt-3 border-t border-border/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-sky-600 shrink-0" />
                  <span>L&apos;Huilier küresel açı fazlalığı teoremi</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-sky-600 shrink-0" />
                  <span>km², Hektar ve Dönüm eşzamanlı dönüşümü</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-sky-600 shrink-0" />
                  <span>Kesişen çokgen tespiti &amp; Dış hat sıralaması</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-border/60">
              <Link href="/v2/araclar/alan-hesaplama" className="block w-full">
                <Button
                  variant="sky"
                  className="w-full text-white font-bold h-11 text-xs gap-2"
                  rightIcon={
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Alan Aracını Başlat
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TARGET AUDIENCES & USE CASES SECTION (HEDEF KİTLE VE KULLANIM SENARYOLARI) */}
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg space-y-8">
        <div className="space-y-2 border-b border-border pb-5">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Users className="size-3.5" />}>
              Hedef Kitle &amp; Kullanım Alanları
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              Kimin İçin Tasarlandı?
            </span>
          </div>
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)]">
            Eğitimden Akademik Araştırmaya Çok Yönlü CBS Deneyimi
          </h3>
          <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-3xl">
            Platformumuz, lise ve üniversite sınavlarına hazırlanan öğrencilerden ders anlatan
            öğretmenlere ve harita/CBS profesyonellerine kadar geniş bir hedef kitleye hitap eder.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Audience 1: Öğrenciler & Sınav Adayları */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-base text-foreground">
                Öğrenciler &amp; Sınav Adayları
              </h4>
              <span className="text-[11px] text-muted-foreground font-medium">
                MEB 9, YKS (TYT/AYT) ve KPSS Coğrafya
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              &bull; <strong>111 km Kuralı:</strong> İki paralel arası değişmeyen mesafe mantığını
              haritada somutlaştırın.
              <br />
              &bull; <strong>4 Dakika Yerel Saat:</strong> Boylamlar arası zaman farkını (örn:
              Ankara-Iğdır arası 48 dk) doğrudan hesaplayın.
              <br />
              &bull; <strong>İzdüşüm vs Gerçek Alan:</strong> Engebenin yüzölçümüne etkisini
              kavrayın.
            </p>
          </div>

          {/* Audience 2: Coğrafya Öğretmenleri & Eğitmenler */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="size-10 rounded-xl bg-emerald-600/15 text-emerald-600 flex items-center justify-center">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-base text-foreground">
                Öğretmenler &amp; Eğitmenler
              </h4>
              <span className="text-[11px] text-muted-foreground font-medium">
                Akıllı Tahta &amp; Ders Materyali Hazırlığı
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              &bull; <strong>Akıllı Tahta Uyumu:</strong> Sınıfta projeksiyon ve dokunmatik ekranda
              canlı interaktif ölçüm yapın.
              <br />
              &bull; <strong>81 İl Hızlı Seçici:</strong> Öğrencilere soru sorarken il merkezlerini
              anında bağlayın.
              <br />
              &bull; <strong>PNG Dışa Aktarım:</strong> Telifli ve ölçekli harita görsellerini sınav
              ve slaytlarınıza ekleyin.
            </p>
          </div>

          {/* Audience 3: CBS & Harita Araştırmacıları / Gezginler */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="size-10 rounded-xl bg-sky-600/15 text-sky-600 flex items-center justify-center">
              <Compass className="size-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-base text-foreground">
                CBS Meraklıları &amp; Doğa Gezginleri
              </h4>
              <span className="text-[11px] text-muted-foreground font-medium">
                Arazi, Rota ve Alan Planlaması
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              &bull; <strong>WGS84 &amp; UTM Zonları:</strong> EPSG:4326 ve Gauss-Krüger dilim
              koordinatlarını karşılaştır.
              <br />
              &bull; <strong>Küresel Yüzölçümü:</strong> L&apos;Huilier formülüyle göl, orman ve
              havza alanlarını Hektar/Dönüm olarak ölç.
              <br />
              &bull; <strong>Rota Süre Simülasyonu:</strong> Kuş uçuşu ile %28 topoğrafik karayolu
              sapmasını analiz et.
            </p>
          </div>
        </div>
      </div>

      {/* 3. PLATFORM CAPABILITIES & METHODOLOGY COMPARISON TABLE */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="primary" size="sm" icon={<Sparkles className="size-3.5" />}>
              CBS Karşılaştırma Matrisi
            </Badge>
            <h3 className="font-heading font-bold text-lg sm:text-xl text-foreground tracking-tight m-0 leading-tight">
              Araç Yetenekleri ve Bilimsel Standartlar
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            3 Ölçüm Modülü Karşılaştırması
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-muted-foreground font-semibold">
                <th className="pb-3 pr-4">Özellik / Yetenek</th>
                <th className="pb-3 px-4 text-primary">Kuş Uçuşu Mesafe Ölçer</th>
                <th className="pb-3 px-4 text-emerald-600">Koordinat &amp; Konum Bulucu</th>
                <th className="pb-3 pl-4 text-sky-600">Çokgen Alan Hesaplama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-foreground">
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  Matematiksel Model
                </td>
                <td className="py-3 px-4 font-mono">Haversine Great-Circle</td>
                <td className="py-3 px-4 font-mono">WGS84 + Gauss-Krüger</td>
                <td className="py-3 pl-4 font-mono">L&apos;Huilier Spherical Excess</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  Temel Çıktı Birimleri
                </td>
                <td className="py-3 px-4">km, Metre, Deniz Mili (NM)</td>
                <td className="py-3 px-4">DD (Ondalık), DMS, UTM Zone</td>
                <td className="py-3 pl-4">km², Hektar (ha), Dönüm, Çevre</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  81 İl Seçici Desteği
                </td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">
                  ✓ Var (MGM Koordinatları)
                </td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">
                  ✓ Var (İl Merkez Noktası)
                </td>
                <td className="py-3 pl-4 text-emerald-600 font-semibold">
                  ✓ Var (Köşe Noktası Olarak)
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  Doğrudan Koordinat Girişi
                </td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">✓ Var (DD &amp; DMS)</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">✓ Var (DD &amp; DMS)</td>
                <td className="py-3 pl-4 text-emerald-600 font-semibold">✓ Var (DD &amp; DMS)</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">Ölçüm Kaydetme</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">
                  ✓ Var (Hesaba Bağlı Bulut Arşivi)
                </td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">
                  ✓ Var (Hesaba Bağlı Bulut Arşivi)
                </td>
                <td className="py-3 pl-4 text-emerald-600 font-semibold">
                  ✓ Var (Hesaba Bağlı Bulut Arşivi)
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  PNG Olarak İndirme
                </td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">
                  ✓ Var (Yüksek Çözünürlük)
                </td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">
                  ✓ Var (Yüksek Çözünürlük)
                </td>
                <td className="py-3 pl-4 text-emerald-600 font-semibold">
                  ✓ Var (Yüksek Çözünürlük)
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  Özel Ekstra Özellik
                </td>
                <td className="py-3 px-4">Uçuş süresi &amp; %28 Karayolu tahmini</td>
                <td className="py-3 px-4">Noktadan İl Tespiti (Reverse Geocode)</td>
                <td className="py-3 pl-4">Kesişen Çokgen Uyarısı &amp; Dış Hat Sıralama</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
