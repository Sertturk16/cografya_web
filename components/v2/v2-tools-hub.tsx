"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Compass,
  MapPin,
  Layers,
  ArrowRight,
  Route,
  CheckCircle2,
  GraduationCap,
  BookOpen,
} from "lucide-react";

export function V2ToolsHub() {
  return (
    <div className="space-y-14">
      {/* 1. THREE DEDICATED TOOL NAVIGATION CARDS (HERO GRADE WITH BUTTON COMPONENTS) */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
              Üç Araç, Üç Ayrı Soru
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Her araç kendi sayfasında, büyük bir Türkiye haritasıyla açılır.
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
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Mesafe Ölçme
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
                  İstanbul ile Van arası kaç kilometre? İki nokta koy, kuş uçuşu cevabı al. Araya
                  durak ekleyince rotanın toplamı çıkar.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2 text-xs text-muted-foreground pt-3 border-t border-border/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Dünya&apos;nın yuvarlaklığı hesaba katılır</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Uçakla süre ve kaba karayolu tahmini</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Yakınlaştırdıkça çizgi ölçek güncellenir</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-border/60">
              <Link href="/araclar/mesafe-olcme" className="block w-full">
                <Button
                  variant="primary"
                  className="w-full text-white font-bold h-11 text-xs gap-2"
                  rightIcon={
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Mesafeyi Ölç
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 2: Koordinat Bulucu (Yeşil / Beyaz Buton) */}
          <div className="p-6 sm:p-7 rounded-3xl border border-border bg-gradient-to-b from-card via-card to-secondary/5 hover:border-secondary/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-secondary/15 text-secondary group-hover:scale-110 transition-transform">
                  <MapPin className="size-6" />
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-secondary transition-colors">
                  Koordinat Bulma
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
                  Haritanın herhangi bir yerine tıkla. O noktanın enlemi, boylamı ve hangi ilin
                  sınırında kaldığı yanında yazar.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2 text-xs text-muted-foreground pt-3 border-t border-border/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-secondary shrink-0" />
                  <span>Ondalık derece ve derece-dakika-saniye</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-secondary shrink-0" />
                  <span>Düştüğü ilin sayfasına tek tıkla geç</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-secondary shrink-0" />
                  <span>UTM dilimi: Türkiye 35 ile 38 arasında</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-border/60">
              <Link href="/araclar/koordinat-bulma" className="block w-full">
                <Button
                  variant="emerald"
                  className="w-full text-white font-bold h-11 text-xs gap-2"
                  rightIcon={
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Koordinat Bul
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 3: Alan Hesaplama (Mavi / Beyaz Buton) */}
          <div className="p-6 sm:p-7 rounded-3xl border border-border bg-gradient-to-b from-card via-card to-info/5 hover:border-info/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-info/15 text-info group-hover:scale-110 transition-transform">
                  <Layers className="size-6" />
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-info transition-colors">
                  Alan Hesaplama
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
                  Bir gölün ya da ovanın kenarını noktalarla çevirip kapat. Şeklin alanını ve
                  çevresini hesaplar.
                </p>
              </div>

              {/* Feature Highlights */}
              <ul className="space-y-2 text-xs text-muted-foreground pt-3 border-t border-border/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-info shrink-0" />
                  <span>Hesap düz kâğıtta değil, küre üstünde</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-info shrink-0" />
                  <span>Sonuç km², hektar ve dönüm olarak</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-info shrink-0" />
                  <span>Kenarlar kesişirse uyarır, noktaları sıraya dizer</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-border/60">
              <Link href="/araclar/alan-hesaplama" className="block w-full">
                <Button
                  variant="sky"
                  className="w-full text-white font-bold h-11 text-xs gap-2"
                  rightIcon={
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Alanı Hesapla
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TARGET AUDIENCES & USE CASES SECTION (HEDEF KİTLE VE KULLANIM SENARYOLARI) */}
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg space-y-8">
        <div className="space-y-2 border-b border-border pb-5">
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
            Ne İşine Yarar?
          </h3>
          <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-3xl">
            Ders kitabındaki hesapları haritada kendin sına ya da bir gezi rotasını çıkar. Birkaç
            örnek:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Audience 1: Öğrenciler & Sınav Adayları */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-base text-foreground">Öğrenciler</h4>
              <span className="text-[11px] text-muted-foreground font-medium">
                Sınava çalışırken
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              &bull; <strong>1° enlem ≈ 111 km:</strong> Aynı boylamda iki nokta koy, derece farkını
              111 ile çarp, sonucu aracınkiyle karşılaştır.
              <br />
              &bull; <strong>Yerel saat farkı:</strong> İki ilin boylamını oku. Her 1° fark 4 dakika
              eder.
              <br />
              &bull; <strong>Sınırın ayrıntısı:</strong> Bir gölü önce 4, sonra 12 noktayla çiz;
              alanın ve çevrenin nasıl değiştiğine bak.
            </p>
          </div>

          {/* Audience 2: Coğrafya Öğretmenleri & Eğitmenler */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="size-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-base text-foreground">Öğretmenler</h4>
              <span className="text-[11px] text-muted-foreground font-medium">
                Derste ve ödev hazırlarken
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              &bull; <strong>Tahtada:</strong> Harita dokunmatik ekranda da çalışır; iki parmakla
              yakınlaştırılır.
              <br />
              &bull; <strong>İl listesi:</strong> Soruyu sorarken iki ili listeden seç, haritada
              tıklamakla uğraşma.
              <br />
              &bull; <strong>Görsel:</strong> Ölçümü PNG olarak indir, slayda ya da çalışma kâğıdına
              koy. Harita kaynağı resmin altında yazılıdır.
            </p>
          </div>

          {/* Audience 3: CBS & Harita Araştırmacıları / Gezginler */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="size-10 rounded-xl bg-info/15 text-info flex items-center justify-center">
              <Compass className="size-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-base text-foreground">Gezginler</h4>
              <span className="text-[11px] text-muted-foreground font-medium">
                Rota çizerken, haritayla uğraşırken
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              &bull; <strong>UTM dilimi:</strong> GPS cihazı ya da topoğrafya haritası dilim
              numarası ister; tıkladığın noktanınkini gör.
              <br />
              &bull; <strong>Göl alanı:</strong> Bir gölün kıyısını çiz, alanı hektar ve dönüm
              olarak da oku.
              <br />
              &bull; <strong>Gezi rotası:</strong> Durakları sırayla koy, kuş uçuşu toplamı ve kaba
              bir karayolu tahminini gör.
            </p>
          </div>
        </div>
      </div>

      {/* 3. PLATFORM CAPABILITIES & METHODOLOGY COMPARISON TABLE */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-heading font-bold text-lg sm:text-xl text-foreground tracking-tight m-0 leading-tight">
              Hangi Araç Ne Yapar?
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-muted-foreground font-semibold">
                <th className="pb-3 pr-4">Özellik</th>
                <th className="pb-3 px-4 text-primary">Mesafe Ölçme</th>
                <th className="pb-3 px-4 text-secondary">Koordinat Bulma</th>
                <th className="pb-3 pl-4 text-info">Alan Hesaplama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-foreground">
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">Nasıl hesaplar</td>
                <td className="py-3 px-4">Haversine formülü, küre üstünde en kısa yay</td>
                <td className="py-3 px-4">WGS84 enlem-boylamı, 6 derecelik UTM dilimi</td>
                <td className="py-3 pl-4">Köşelerin enlem-boylamından, küre yüzeyinde</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">Sonuç</td>
                <td className="py-3 px-4">km, metre, deniz mili</td>
                <td className="py-3 px-4">Ondalık derece, derece-dakika-saniye, UTM dilimi</td>
                <td className="py-3 pl-4">km², hektar, dönüm; çevre km olarak</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">Listeden il seçme</td>
                <td className="py-3 px-4 text-success-strong font-semibold">
                  ✓ İl merkezi durak olur
                </td>
                <td className="py-3 px-4 text-success-strong font-semibold">
                  ✓ İl merkezinin koordinatı
                </td>
                <td className="py-3 pl-4 text-success-strong font-semibold">
                  ✓ İl merkezi köşe olur
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  Koordinat yazarak nokta koyma
                </td>
                <td className="py-3 px-4 text-success-strong font-semibold">
                  ✓ Ondalık ya da derece-dakika-saniye
                </td>
                <td className="py-3 px-4 text-success-strong font-semibold">
                  ✓ Ondalık ya da derece-dakika-saniye
                </td>
                <td className="py-3 pl-4 text-success-strong font-semibold">
                  ✓ Ondalık ya da derece-dakika-saniye
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">Ölçümü kaydetme</td>
                <td className="py-3 px-4 text-success-strong font-semibold">
                  ✓ Giriş yapınca, hesabına
                </td>
                <td className="py-3 px-4 text-success-strong font-semibold">
                  ✓ Giriş yapınca, hesabına
                </td>
                <td className="py-3 pl-4 text-success-strong font-semibold">
                  ✓ Giriş yapınca, hesabına
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  PNG olarak indirme
                </td>
                <td className="py-3 px-4 text-success-strong font-semibold">✓ 1600 × 730 piksel</td>
                <td className="py-3 px-4 text-success-strong font-semibold">✓ 1600 × 730 piksel</td>
                <td className="py-3 pl-4 text-success-strong font-semibold">✓ 1600 × 730 piksel</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">Ayrıca</td>
                <td className="py-3 px-4">Uçuş süresi ve kaba karayolu tahmini</td>
                <td className="py-3 px-4">Noktanın hangi ilde olduğu</td>
                <td className="py-3 pl-4">Kenarlar kesişince uyarı ve sıraya dizme düğmesi</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
