import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function V2MarineOceanographyGuide() {
  return (
    <section className="space-y-6" aria-labelledby="v2-marine-coastal-guide-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1.5">
          <h2
            id="v2-marine-coastal-guide-heading"
            className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-primary"
          >
            Kıyılar Neden Birbirine Benzemez?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bir kıyının şeklini iki şey belirler: dağların kıyıya paralel mi dik mi uzandığı ve
            Dördüncü Zaman&apos;da yükselen denizin hangi vadileri doldurduğu. Türkiye&apos;de altı
            kıyı tipi görülür.
          </p>
        </div>

        <Link
          href="/deniz/kiyi-tipleri"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 group font-bold text-xs gap-1.5",
          )}
        >
          <span>Altı Kıyı Tipini Örnekleriyle Gör</span>
          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. BOYUNA KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">
                Karadeniz ve Akdeniz
              </span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Boyuna Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Dağlar kıyıya paralel uzanır, iç kesimlere ancak geçitlerden gidilir: Zigana, Kop,
              Çubuk, Sertavul, Gülek. Pasifik tipi kıyı da denir.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Nasıl Tanınır:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Dalgalar kıyıyı oyar, dik falezler (yalıyarlar) oluşur.</li>
                <li>Kıta sahanlığı dar; biraz açılınca deniz birden derinleşir.</li>
                <li>Doğal liman, koy ve körfez az.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 2. ENİNE KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">Ege Bölgesi</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Enine Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Ege&apos;de dağlar denize dik iner. Aralarındaki çöküntü ovaları (grabenler) denize
              açılır; deniz havası bu ovalar boyunca 150-200 km içeri girer.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Nasıl Tanınır:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Türkiye&apos;nin en girintili çıkıntılı, en çok koy ve körfezi olan kıyısı.</li>
                <li>Kıta sahanlığı geniş.</li>
                <li>Kıyı boyu ile kuş uçuşu uzaklık arasındaki fark en çok burada.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 3. RİA KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">Boğazlar ve Haliç</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Ria Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Deniz yükselince eski akarsu vadileri sular altında kalmış. Ortaya karanın içine
              uzanan, derin ve doğal su yolları çıkmış.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>İstanbul Boğazı ve Haliç</li>
                <li>Çanakkale Boğazı</li>
                <li>Muğla - Gökova kıyıları</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 4. DALMAÇYA KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">
                Antalya (Kaş - Finike)
              </span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Dalmaçya Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Kıyıya paralel sıradağların arasındaki vadilere deniz dolar. Suyun üstünde kalan
              tepeler ve sırtlar, kıyı boyunca dizilmiş adalara dönüşür.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Antalya Kaş - Kalkan - Finike açıkları</li>
                <li>Kekova Batık Şehir ve adacıklar kümesi</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 5. LİMANLI KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">
                Marmara ve Karadeniz
              </span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Limanlı ve Lagün Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Dalgaların taşıdığı kum, bir koyun ya da geniş bir vadinin ağzında birikip set çeker;
              bu sete kıyı kordonu denir. Setin arkasında denizden ayrılmış bir göl kalır: lagün,
              yani denizkulağı.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Büyükçekmece ve Küçükçekmece Gölleri</li>
                <li>Terkos (Durusu) Gölü</li>
                <li>Akyatan Lagünü (Adana)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 6. KALANKLI KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">Mersin (Silifke)</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Kalanklı Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Kireçtaşı arazide suyun oyduğu derin kanyonlara deniz dolmuş. Sonuç dar, derin ve
              yamaçları dik koylar.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Mersin - Silifke kıyı kuşağı</li>
                <li>Narlıkuyu ve Cennet-Cehennem kıyı hattı</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
