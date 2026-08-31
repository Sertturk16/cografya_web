"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  MapPin,
  Layers,
  BookOpen,
  Route,
  Globe,
  ArrowRight,
  Scale,
  Sparkles,
} from "lucide-react";

interface V2ToolEducationalContentProps {
  mode: "hub" | "distance" | "coordinates" | "area";
}

export function V2ToolEducationalContent({ mode }: V2ToolEducationalContentProps) {
  return (
    <div className="space-y-10">
      {/* 1. PEDAGOGICAL MEB 9 CURRICULUM + CBS GEODESY SECTION */}
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg space-y-8">
        <div className="space-y-2 border-b border-border pb-5">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
              MEB Coğrafya 9 &amp; CBS Eğitimi
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              Temel Kavramlar ve Bilimsel Esaslar
            </span>
          </div>
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)]">
            {mode === "distance" && "Kuş Uçuşu Mesafe ve Harita Ölçeği Rehberi"}
            {mode === "coordinates" && "Coğrafi Koordinat Sistemi ve Projeksiyon Rehberi"}
            {mode === "area" && "Küresel Çokgen Alanı ve Yüzölçümü Rehberi"}
            {mode === "hub" && "Harita Bilgisi, Jeodezik Ölçümler ve CBS Esasları"}
          </h3>
          <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-3xl">
            Milli Eğitim Bakanlığı (MEB) Coğrafya 9 ders kitabı müfredat kazanımları ile çağdaş
            Coğrafi Bilgi Sistemleri (CBS) matematiksel modellerinin sentezi.
          </p>
        </div>

        {/* Content Blocks depending on mode */}
        {mode === "distance" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Route className="size-5" />
                <h4>Kuş Uçuşu Mesafe Nedir?</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                İki nokta arasındaki en kısa doğrudan geometrik uzaklıktır. Yol, arazi engebesi,
                vadiler, sıradağlar ve yerleşim yerleri gibi engeller hesaba katılmaz; yalnızca
                yerkürenin geometrik yüzeyi üzerindeki büyük daire yayı (great-circle) esas alınır.
              </p>
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono">
                Örnek: Türkiye&apos;nin 36°–42° kuzey paralelleri arasındaki 6 derecelik fark ≈ 666
                km kuş uçuşu mesafeye karşılık gelir.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <Scale className="size-5" />
                <h4>Karayolu Mesafesinden Neden Farklıdır?</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Karayolu mesafesi, topoğrafik eğimlere, viyadüklere, tünellere ve virajlara göre
                uzar. Türkiye gibi genç ve engebeli dağlık ülkelerde karayolu mesafesi kuş uçuşu
                mesafeye göre ortalama <strong>%25 ila %35 daha uzundur</strong>.
              </p>
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground">
                Platformumuz, hesaplanan kuş uçuşu mesafeye ek olarak %28 topoğrafik sapma
                katsayısıyla tahmini karayolu uzunluğunu da eşzamanlı üretir.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-accent font-bold text-base">
                <Globe className="size-5" />
                <h4>Büyük Daire Yayı (Haversine Formülü)</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Düz haritada çizilen doğru bir çizgi gibi görünse de yerküre üzerinde küre merkezini
                kesen bir yaydır. Platformumuz, WGS84 ortalama yerküre yarıçapı olan{" "}
                <strong>R = 6.371,0 km</strong> değerini kullanarak trigonometrik Haversine
                denklemini çözer.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Compass className="size-5" />
                <h4>Çizgi Ölçek ve Hassasiyet</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Haritanın sol altında yer alan dinamik çizgi ölçek, yakınlaştırma (zoom) seviyesine
                ve enlem derecesine göre anlık olarak yeniden ölçeklenir. Böylece ekrandaki piksel
                boyutuyla yeryüzündeki gerçek mesafe daima tutarlı kalır.
              </p>
            </div>
          </div>
        )}

        {mode === "coordinates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <MapPin className="size-5" />
                <h4>Coğrafi Koordinat Sistemi Nedir?</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Dünya üzerindeki herhangi bir noktanın Ekvator&apos;a (enlem) ve Greenwich Başlangıç
                Meridyeni&apos;ne (boylam) olan açısal uzaklığıdır. Türkiye bütünüyle{" "}
                <strong>36°–42° Kuzey enlemleri</strong> ile{" "}
                <strong>26°–45° Doğu boylamları</strong> arasında yer alır.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Compass className="size-5" />
                <h4>Ondalık Derece (DD) ve DMS Gösterimi</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Aynı koordinat iki farklı biçimde ifade edilebilir:
                <br />
                &bull; <strong>DMS (Derece-Dakika-Saniye):</strong> 39° 55&apos; 12.0&quot; K &bull;
                32° 51&apos; 36.0&quot; D
                <br />
                &bull; <strong>DD (Ondalık Derece):</strong> 39.920000° K &bull; 32.860000° D
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-accent font-bold text-base">
                <Globe className="size-5" />
                <h4>Bir Derece Kaç Kilometredir?</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                İki ardışık paralel dairesi arasındaki mesafe her yerde sabittir ve yaklaşık{" "}
                <strong>111 km</strong>&apos;dir. Meridyenler ise kutuplarda birleştiği için
                aralarındaki mesafe Ekvator&apos;da 111 km iken Türkiye enlemlerinde (~39°K)
                yaklaşık <strong>86 km</strong>&apos;ye düşer.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <Layers className="size-5" />
                <h4>WGS84 &amp; UTM Projeksiyon Farkı</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                WGS84 açısal koordinat sunarken; UTM (Universal Transverse Mercator) Dünya&apos;yı 6
                derecelik dilimlere (Zone 35N, 36N, 37N, 38N) bölerek metre cinsinden düzlemsel
                koordinat üretir.
              </p>
            </div>
          </div>
        )}

        {mode === "area" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-accent font-bold text-base">
                <Layers className="size-5" />
                <h4>Küresel Çokgen Alanı ve L&apos;Huilier Teoremi</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Geniş coğrafi yüzölçümlerinde düzlem geometrisi (Öklid) yerkürenin eğriliğini ihmal
                ettiği için büyük hatalara yol açar. Platformumuz, küresel açı fazlalığı (Spherical
                Excess) formülünü L&apos;Huilier teoremiyle hesaplayarak gerçek yüzey alanını bulur.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Scale className="size-5" />
                <h4>İzdüşüm Alan ile Gerçek Alan Farkı</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                İzdüşüm alan, arazideki dağ, tepe ve vadilerin düz kabul edilmesiyle hesaplanan
                alandır. Gerçek alan ise topoğrafik yüzey kıvrımlarını içerir. Türkiye&apos;nin
                izdüşüm yüzölçümü 783.562 km² iken gerçek yüzölçümü engebeden dolayı 814.578
                km²&apos;dir.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <Sparkles className="size-5" />
                <h4>Birim Dönüşümleri (km², Hektar, Dönüm)</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Hesaplanan alan çıktıları eşzamanlı olarak üç temel metrik birime dönüştürülür:
                <br />
                &bull; <strong>1 km²</strong> = 100 Hektar (ha) = 1.000 Dekar / Dönüm = 1.000.000 m²
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-base">
                <Compass className="size-5" />
                <h4>Kesişen Çokgen Geometrisi</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Köşe noktaları çapraz bağlandığında çokgen kendi kenarlarını keser ve birbirini yok
                eden ters yönlü üçgenler oluşur. Doğru yüzölçümü için köşelerin çevre boyunca saat
                yönünde veya tersinde sırayla yerleştirilmesi gerekir.
              </p>
            </div>
          </div>
        )}

        {mode === "hub" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Route className="size-4" />
                <h4>1. Kuş Uçuşu Mesafe</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Yerküre eğriliği üzerinde büyük daire yayı mesafesi, uçuş süresi ve karayolu farkı
                hesaplamaları.
              </p>
              <Link
                href="/v2/araclar/mesafe-olcme"
                className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Mesafe Aracına Git</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-2">
              <div className="flex items-center gap-2 text-secondary font-bold text-sm">
                <MapPin className="size-4" />
                <h4>2. Koordinat &amp; İl Tespiti</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                WGS84, DMS ve UTM projeksiyon zonları ile tıklanan noktanın hangi il sınırları içine
                düştüğünün tespiti.
              </p>
              <Link
                href="/v2/araclar/koordinat-bulma"
                className="text-xs text-secondary font-semibold hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Koordinat Aracına Git</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-2">
              <div className="flex items-center gap-2 text-accent font-bold text-sm">
                <Layers className="size-4" />
                <h4>3. Çokgen Alan Hesabı</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                L&apos;Huilier teoremiyle küresel çokgen yüzölçümü, km², hektar, dönüm ve çevre
                uzunluğu hesabı.
              </p>
              <Link
                href="/v2/araclar/alan-hesaplama"
                className="text-xs text-accent font-semibold hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Alan Aracına Git</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 2. TARGET AUDIENCES & PRACTICAL APPLICATIONS (HEDEF KİTLE VE KAZANIMLAR) */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              size="sm"
              className="border-primary/30 text-primary bg-primary/10"
            >
              Kullanım Alanları &amp; Hedef Kitle
            </Badge>
          </div>
          <h4 className="font-heading font-bold text-lg text-foreground">
            Kimler Nasıl Yararlanabilir?
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2">
            <span className="font-bold text-primary block text-sm">
              🎓 Öğrenciler &amp; Sınav Adayları
            </span>
            <p className="text-muted-foreground leading-relaxed">
              MEB Coğrafya 9 müfredatındaki 111 km paralel mesafesi, 4 dakikalık meridyen yerel saat
              farkı (Ankara-Iğdır 48 dk) ve engebenin izdüşüm alana etkisini görselleştirerek
              TYT/AYT/KPSS coğrafya sorularını pekiştirin.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2">
            <span className="font-bold text-emerald-600 block text-sm">
              👨‍🏫 Öğretmenler &amp; Eğitmenler
            </span>
            <p className="text-muted-foreground leading-relaxed">
              Akıllı tahtada ders anlatırken 81 ili anında bağlayıp mesafe/koordinat problemleri
              oluşturun; PNG dışa aktarma ile telifli ve ölçekli harita görsellerini slayt ve
              ödevlerinize ekleyin.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2">
            <span className="font-bold text-sky-600 block text-sm">
              🧭 CBS Araştırmacıları &amp; Gezginler
            </span>
            <p className="text-muted-foreground leading-relaxed">
              WGS84, DMS ve Gauss-Krüger UTM Zone 35-38N dilim koordinatlarını inceleyin;
              L&apos;Huilier teoremiyle göl/havza alanlarını km², Hektar ve Dönüm cinsinden hassas
              ölçün.
            </p>
          </div>
        </div>
      </div>

      {/* 2. RELATED TOOLS ROW (Diğer CBS Araçları) */}
      {mode !== "hub" && (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <h4 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <span>Diğer CBS &amp; Coğrafi Ölçüm Araçları</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {mode !== "distance" && (
              <Link
                href="/v2/araclar/mesafe-olcme"
                className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-primary/10 hover:border-primary/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-primary/15 text-primary">
                    <Route className="size-4" />
                  </span>
                  <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                    Kuş Uçuşu Mesafe Ölçer
                  </span>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            )}

            {mode !== "coordinates" && (
              <Link
                href="/v2/araclar/koordinat-bulma"
                className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-secondary/10 hover:border-secondary/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-secondary/15 text-secondary">
                    <MapPin className="size-4" />
                  </span>
                  <span className="font-bold text-xs text-foreground group-hover:text-secondary transition-colors">
                    Koordinat &amp; Konum Bulucu
                  </span>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-secondary transition-colors" />
              </Link>
            )}

            {mode !== "area" && (
              <Link
                href="/v2/araclar/alan-hesaplama"
                className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-accent/10 hover:border-accent/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-accent/15 text-accent">
                    <Layers className="size-4" />
                  </span>
                  <span className="font-bold text-xs text-foreground group-hover:text-accent transition-colors">
                    Çokgen Alan Hesaplama
                  </span>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
              </Link>
            )}

            <Link
              href="/v2/araclar"
              className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-muted/80 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-foreground/10 text-foreground">
                  <Compass className="size-4" />
                </span>
                <span className="font-bold text-xs text-foreground">CBS Araçları Hub</span>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
