import * as React from "react";
import { Compass, MapPin, Layers } from "lucide-react";

export function V2GamePedagogyGuide() {
  const techniques = [
    {
      title: "Önce Belirgin Yerleri Öğren",
      desc: "İlleri tek tek ezberleme. Kıyıları, Tuz Gölü ve Van Gölü gibi büyük gölleri, komşu ülkelerle sınırı başlangıç noktası yap; her ili bunlara göre yerleştir.",
      icon: <Compass className="size-5 text-primary" />,
    },
    {
      title: "İlleri Komşularıyla Birlikte Düşün",
      desc: "Bir ili tek başına değil, çevresindeki illerle birlikte hatırla. Örneğin Adana, Mersin ve Osmaniye'yi Çukurova'nın çevresinde bir arada düşün.",
      icon: <Layers className="size-5 text-secondary" />,
    },
    {
      title: "Plaka Sırasından Yararlan",
      desc: "Plaka kodları verildiğinde Türkiye'de 67 il vardı ve 1'den 67'ye adlarının alfabetik sırasıyla numaralandı. 68 Aksaray'dan 81 Düzce'ye kadar 14 il sonradan kuruldu ve sıradaki numaraları aldı. İl oyunundaki ipucu plaka kodunu da söylediği için bu sıra işine yarar.",
      icon: <MapPin className="size-5 text-accent" />,
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="border-b border-border pb-4">
        <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
          Haritayı Daha Kolay Öğrenmek İçin Üç Öneri
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {techniques.map((tech) => (
          <div
            key={tech.title}
            className="p-4 sm:p-5 rounded-2xl border border-border bg-card/70 hover:border-primary/40 transition-all duration-300 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted/60 border border-border">{tech.icon}</div>
              <h4 className="font-heading font-bold text-base text-foreground">{tech.title}</h4>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-1">
              {tech.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
