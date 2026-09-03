import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Globe, Compass, Layers, BookOpen, Calculator } from "lucide-react";

export function V2GisMethodologyGuide() {
  const concepts = [
    {
      title: "1. Büyük Daire Yayı (Haversine Formülü)",
      desc: "Dünya küresel bir yüzey olduğundan, iki nokta arasındaki en kısa rota düz bir çizgi değil, küre merkezini kesen büyük daire yayıdır (Great-Circle Distance). Platformumuz WGS84 ortalama yarıçapını (6.371 km) kullanır.",
      icon: <Globe className="size-5 text-primary" />,
    },
    {
      title: "2. Küresel Çokgen Alan Hesabı (L'Huilier Teoremi)",
      desc: "Geniş coğrafi alanlarda düzlem geometrisi (öklid) büyük hatalara yol açar. Alan hesaplama motorumuz, küresel açı fazlalığı (Spherical Excess) matematiğiyle gerçek eğrilik alanını verir.",
      icon: <Calculator className="size-5 text-secondary" />,
    },
    {
      title: "3. WGS84 & UTM Projeksiyon Farkı",
      desc: "Enlem ve boylam derece cinsinden açısal değerlerdir. UTM (Universal Transverse Mercator) ise Dünya'yı 6 derecelik dilimlere (Zone) bölerek metre cinsinden düzlemsel koordinat üretir.",
      icon: <Layers className="size-5 text-accent" />,
    },
    {
      title: "4. Harita Ölçeği ve Bozulmalar (Distortion)",
      desc: "3 Boyutlu yerküreyi 2 boyutlu ekrana aktarırken açı, alan veya uzunluk özelliklerinden en az biri bozulur. Türkiye haritamız 38.96°K referans enlemiyle ölçeklenmiştir.",
      icon: <Compass className="size-5 text-purple-600" />,
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
              CBS Bilimsel Metodoloji
            </Badge>
            <span className="text-xs text-muted-foreground">
              Jeodezi &amp; Kartografya Esasları
            </span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
            Coğrafi Bilgi Sistemleri &amp; Jeodezik Ölçüm Esasları
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {concepts.map((c) => (
          <div
            key={c.title}
            className="p-5 rounded-2xl border border-border bg-card/70 hover:border-primary/40 transition-all duration-300 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted/60 border border-border">{c.icon}</div>
              <h4 className="font-heading font-bold text-base text-foreground">{c.title}</h4>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-1">
              {c.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
