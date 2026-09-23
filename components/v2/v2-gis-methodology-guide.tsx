import * as React from "react";
import { Globe, Compass, Layers, Calculator } from "lucide-react";

export function V2GisMethodologyGuide() {
  const concepts = [
    {
      title: "1. Küre üstünde en kısa yol",
      desc: "Bir portakalın kabuğunda iki nokta arasına ip gerersen ip kabuğun üstünde bir yay çizer. Dünya'da bu yay, merkezi Dünya'nın merkezi olan en büyük çemberin bir parçasıdır; bu çembere büyük daire denir. Mesafe aracı yayın uzunluğunu Haversine formülüyle bulur ve Dünya'nın yarıçapını 6.371 km alır.",
      icon: <Globe className="size-5 text-primary" />,
    },
    {
      title: "2. Alan neden düz hesaplanmaz?",
      desc: "Kuzeye gittikçe bir derecelik boylamın boyu kısalır: Ekvator'da yaklaşık 111 km, Türkiye'nin ortasında 86 km. Dereceleri düz bir ızgaradaymış gibi çarpan bir hesap bu yüzden şaşar. Alan aracı hesabı küre yüzeyinde yapar.",
      icon: <Calculator className="size-5 text-secondary" />,
    },
    {
      title: "3. Derece mi, metre mi?",
      desc: "Enlem ve boylam birer açıdır, derece ile yazılır; GPS'in kullandığı WGS84 sistemi de böyle çalışır. UTM ise Dünya'yı 6 derece genişliğinde 60 dilime böler ve her dilimin içinde konumu metreyle verir.",
      icon: <Layers className="size-5 text-accent" />,
    },
    {
      title: "4. Her düz harita bir şeyi bozar",
      desc: "Yuvarlak Dünya düz ekrana aktarılınca açı, alan ya da uzunluktan en az biri bozulur. Buradaki Türkiye haritasında doğu-batı uzunlukları 38,96° kuzey enleminde doğrudur, bu enlemden uzaklaştıkça biraz kayar. Ölçümler çizimden değil, noktaların enlem ve boylamından hesaplandığı için bu kayma sonucu etkilemez.",
      icon: <Compass className="size-5 text-primary" />,
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            Ölçmeden Önce Bilmen Gereken Dört Şey
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
