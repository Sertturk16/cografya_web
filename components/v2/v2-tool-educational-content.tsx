import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Compass, MapPin, Layers, Route, Globe, ArrowRight, Scale, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface V2ToolEducationalContentProps {
  mode: "hub" | "distance" | "coordinates" | "area";
}

export function V2ToolEducationalContent({ mode }: V2ToolEducationalContentProps) {
  return (
    <div className="space-y-10">
      {/* 1. PEDAGOGICAL MEB 9 CURRICULUM + CBS GEODESY SECTION */}
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg space-y-8">
        <div className="space-y-2 border-b border-border pb-5">
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
            {mode === "distance" && "Kuş uçuşu mesafeyi okumak"}
            {mode === "coordinates" && "Enlem, boylam ve UTM dilimi"}
            {mode === "area" && "Bir alanın ölçüsü neye bağlı?"}
            {mode === "hub" && "Üç araç, kısaca"}
          </h3>
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
                İki nokta arasındaki en kısa uzaklıktır. Yollar, dağlar, vadiler ve denizler hesaba
                girmez. Ölçü, Dünya yüzeyinde iki noktayı birleştiren en kısa yay boyunca alınır.
              </p>
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono">
                Örnek: Türkiye 36° ile 42° kuzey paralelleri arasında uzanır. Bu 6 derecelik fark,
                kuzey-güney yönünde yaklaşık 666 km eder.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <Scale className="size-5" />
                <h4>Yol neden daha uzun?</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Karayolu dağı aşmak için viraj çizer, vadiyi izler, köprüden ve tünelden geçer. Bu
                yüzden iki şehir arasındaki yol, kuş uçuşu mesafeden hemen her zaman uzundur.
                Türkiye&apos;de iki il merkezi arasındaki karayolu, kuş uçuşu mesafeden genellikle
                yaklaşık %25 ile %40 daha uzundur.
              </p>
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground">
                Aracın verdiği karayolu tahmini kabadır: kuş uçuşu mesafeyi 1,28 ile çarpar. Gerçek
                yol uzunluğu için bir yol haritasına bak.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-accent font-bold text-base">
                <Globe className="size-5" />
                <h4>Büyük daire ve Haversine formülü</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Haritada düz görünen çizgi, Dünya üzerinde bir yaydır. Bu yay, merkezi
                Dünya&apos;nın merkezinde olan en büyük çemberin, yani büyük dairenin parçasıdır.
                Araç yayın boyunu Haversine formülüyle bulur ve Dünya&apos;nın ortalama yarıçapını{" "}
                <strong>R = 6.371 km</strong> alır.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Compass className="size-5" />
                <h4>Sol alttaki çizgi ölçek</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Haritayı yakınlaştırdıkça ya da kuzeye, güneye kaydırdıkça ölçek çubuğu kendini
                yeniden hesaplar. Ekrandaki bir çizginin yerde kaç kilometre tuttuğunu ona bakarak
                kestirebilirsin.
              </p>
            </div>
          </div>
        )}

        {mode === "coordinates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <MapPin className="size-5" />
                <h4>Enlem ve boylam</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Enlem, bir yerin Ekvator&apos;dan kuzeye ya da güneye kaç derece uzak olduğunu
                söyler. Boylam, Greenwich&apos;ten geçen başlangıç meridyeninden doğuya ya da batıya
                kaç derece uzak olduğunu. Türkiye&apos;nin tamamı{" "}
                <strong>36°–42° kuzey enlemleri</strong> ile{" "}
                <strong>26°–45° doğu boylamları</strong> arasındadır.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Compass className="size-5" />
                <h4>Aynı yer, iki yazım</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Aşağıda Ankara&apos;daki bir noktanın iki yazımı var. Bir derece 60 dakika, bir
                dakika 60 saniyedir:
                <br />
                &bull; <strong>Derece-dakika-saniye:</strong> 39° 55&apos; 12.0&quot; K &bull; 32°
                51&apos; 36.0&quot; D
                <br />
                &bull; <strong>Ondalık derece:</strong> 39.920000° K &bull; 32.860000° D
                <br />
                Ondalık derecede dördüncü ondalık basamak, enlemde yaklaşık 11 metreye karşılık
                gelir.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-accent font-bold text-base">
                <Globe className="size-5" />
                <h4>Bir Derece Kaç Kilometredir?</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                1 derece arayla çizilen iki paralelin arası her yerde yaklaşık{" "}
                <strong>111 km</strong>&apos;dir. Meridyenler ise kutuplarda birleşir: 1 derecelik
                boylam farkı Ekvator&apos;da 111 km iken Türkiye&apos;nin ortasında (39° K
                dolayında) <strong>86 km</strong>&apos;ye iner.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <Layers className="size-5" />
                <h4>UTM dilimi ne demek?</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                GPS&apos;in kullandığı WGS84 konumu derece olarak verir; harita yazılımları bu
                sistemi EPSG:4326 koduyla anar. UTM ise Dünya&apos;yı 6&apos;şar derecelik dilimlere
                böler ve her dilimde konumu metreyle yazar. Türkiye dört dilime düşer: 35, 36, 37 ve
                38. Kuzey yarımkürede numaranın yanına N eklenir (36N gibi). Araç, tıkladığın
                noktanın dilimini gösterir.
              </p>
            </div>
          </div>
        )}

        {mode === "area" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-accent font-bold text-base">
                <Layers className="size-5" />
                <h4>Düz kâğıtta değil, küre üstünde</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Geniş bir alanı düz bir yüzeydeymiş gibi hesaplamak Dünya&apos;nın eğriliğini yok
                sayar; alan büyüdükçe hata da büyür. Araç, köşelerin enlem ve boylamını kullanarak
                alanı küre yüzeyinde hesaplar.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Scale className="size-5" />
                <h4>İzdüşüm alan ve gerçek alan</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                İzdüşüm alan, dağları ve vadileri dümdüz sayarak bulunan alandır. Gerçek alan
                yamaçları da katar, bu yüzden daha büyüktür. Türkiye&apos;nin izdüşüm alanı 783.562
                km², gerçek alanı 814.578 km²&apos;dir. Bu araç yükseltiyi bilmez; bulduğu sonuç
                izdüşüm alana denk gelir.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-base">
                <Sparkles className="size-5" />
                <h4>km², hektar, dönüm</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Sonuç üç birimle birlikte yazılır. Aralarındaki bağ:
                <br />
                &bull; <strong>1 km²</strong> = 100 hektar = 1.000 dönüm (dekar) = 1.000.000 m²
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-accent font-bold text-base">
                <Compass className="size-5" />
                <h4>Kenarlar kesişirse</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Köşeleri çapraz sırayla koyarsan kenarlar birbirini keser ve papyona benzeyen bir
                şekil çıkar. Papyonun iki yarısı ters yönde dolaşılır; hesap bu yüzden birinin
                alanını ötekinden düşer. Böyle bir şeklin tek bir alanı olmaz; araç uyarı verir ve o
                sırada yazan sayı doğru değildir. Köşeleri sınır boyunca sırayla koy ya da uyarıdaki
                düğmeyle dizdir.
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
                İki nokta ya da birkaç duraklı bir rota arasındaki kuş uçuşu mesafe.
              </p>
              <Link
                href="/araclar/mesafe-olcme"
                className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Mesafeyi ölç</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-2">
              <div className="flex items-center gap-2 text-secondary font-bold text-sm">
                <MapPin className="size-4" />
                <h4>2. Koordinat ve il</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tıkladığın noktanın enlemi, boylamı, UTM dilimi ve içinde kaldığı il.
              </p>
              <Link
                href="/araclar/koordinat-bulma"
                className="text-xs text-secondary font-semibold hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Koordinat bul</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-2">
              <div className="flex items-center gap-2 text-accent font-bold text-sm">
                <Layers className="size-4" />
                <h4>3. Alan</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Noktalarla çevirdiğin şeklin alanı ve çevresi.
              </p>
              <Link
                href="/araclar/alan-hesaplama"
                className="text-xs text-accent font-semibold hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Alanı hesapla</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 2. TARGET AUDIENCES & PRACTICAL APPLICATIONS (HEDEF KİTLE VE KAZANIMLAR) */}
      <Card variant="panel" space="6">
        <div className="space-y-1 border-b border-border pb-4">
          <h4 className="font-heading font-bold text-lg text-foreground">Kim, ne için açar?</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2">
            <span className="font-bold text-primary block text-sm">🎓 Öğrenciler</span>
            <p className="text-muted-foreground leading-relaxed">
              Ders kitabındaki bir hesabı önce elle yap: iki il arasındaki boylam farkından yerel
              saat farkını ya da enlem farkından kilometreyi bul. Sonra haritada iki nokta koyup
              sonucunu kontrol et.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2">
            <span className="font-bold text-secondary block text-sm">👨‍🏫 Öğretmenler</span>
            <p className="text-muted-foreground leading-relaxed">
              Listeden iki il seçip mesafeyi sınıfla birlikte ölç. Çıkan haritayı PNG olarak indirip
              ödev kâğıdına ekleyebilirsin.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2">
            <span className="font-bold text-accent block text-sm">🧭 Gezginler</span>
            <p className="text-muted-foreground leading-relaxed">
              Bir gezinin duraklarını sırayla koyup toplam uzunluğu çıkar, gideceğin ilin
              koordinatını not et ya da bir gölün kaç dönüm tuttuğuna bak.
            </p>
          </div>
        </div>
      </Card>

      {/* 2. RELATED TOOLS ROW (Diğer CBS Araçları) */}
      {mode !== "hub" && (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <h4 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <span>Başka bir araca geç</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {mode !== "distance" && (
              <Link
                href="/araclar/mesafe-olcme"
                className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-primary/10 hover:border-primary/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-primary/15 text-primary">
                    <Route className="size-4" />
                  </span>
                  <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                    Mesafe ölçme
                  </span>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            )}

            {mode !== "coordinates" && (
              <Link
                href="/araclar/koordinat-bulma"
                className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-secondary/10 hover:border-secondary/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-secondary/15 text-secondary">
                    <MapPin className="size-4" />
                  </span>
                  <span className="font-bold text-xs text-foreground group-hover:text-secondary transition-colors">
                    Koordinat bulma
                  </span>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-secondary transition-colors" />
              </Link>
            )}

            {mode !== "area" && (
              <Link
                href="/araclar/alan-hesaplama"
                className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-accent/10 hover:border-accent/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-accent/15 text-accent">
                    <Layers className="size-4" />
                  </span>
                  <span className="font-bold text-xs text-foreground group-hover:text-accent transition-colors">
                    Alan hesaplama
                  </span>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
              </Link>
            )}

            <Link
              href="/araclar"
              className="p-3.5 rounded-2xl bg-muted/40 border border-border hover:bg-muted/80 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-foreground/10 text-foreground">
                  <Compass className="size-4" />
                </span>
                <span className="font-bold text-xs text-foreground">Tüm araçlar</span>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
