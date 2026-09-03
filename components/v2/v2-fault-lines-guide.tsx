import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Layers, AlertTriangle } from "lucide-react";

export function V2FaultLinesGuide() {
  const faultSystems = [
    {
      name: "Kuzey Anadolu Fay Hattı (KAF)",
      tag: "Doğrultu Atımlı (Sağ Yanal)",
      desc: "Saros Körfezi'nden başlayıp Marmara Denizi, Bolu, Tokat ve Erzincan üzerinden Karlıova birleşimine kadar uzanan, dünyanın sismik açıdan en aktif sağ yanal doğrultu atımlı fay zonlarından biridir.",
      riskLevel: "Çok Yüksek",
      color: "border-red-500/40 bg-red-500/5",
      badgeColor: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    },
    {
      name: "Doğu Anadolu Fay Hattı (DAF)",
      tag: "Sol Yanal Doğrultu Atımlı",
      desc: "Hatay-Kahramanmaraş üçgeninden başlayarak Adıyaman, Malatya, Elazığ ve Bingöl üzerinden Karlıova birleşim noktasına ulaşan ana sismotektonik hat.",
      riskLevel: "Çok Yüksek",
      color: "border-blue-500/40 bg-blue-500/5",
      badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    },
    {
      name: "Batı Anadolu Fay Sistemi (BAFS)",
      tag: "Normal Faylanma (Graben Sistemi)",
      desc: "Ege Bölgesi'ndeki horst-graben (Bakırçay, Gediz, Küçük Menderes, Büyük Menderes) yapısını oluşturan, genişleme tektoniğine bağlı çok parçalı sismik sistem.",
      riskLevel: "Yüksek",
      color: "border-emerald-500/40 bg-emerald-500/5",
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" size="sm" icon={<Layers className="size-3.5" />}>
              Sismotektonik Yapı
            </Badge>
            <span className="text-xs text-muted-foreground">
              Levha Tektoniği &amp; Ana Kırıklar
            </span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
            Türkiye&apos;nin Ana Fay Hatları &amp; Levha Dinamiği
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {faultSystems.map((fault) => (
          <div
            key={fault.name}
            className={`p-5 rounded-2xl border ${fault.color} space-y-3 shadow-2xs hover:-translate-y-0.5 transition-transform`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${fault.badgeColor}`}
              >
                {fault.tag}
              </span>
              <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                <AlertTriangle className="size-3.5" /> {fault.riskLevel}
              </span>
            </div>

            <h4 className="font-heading font-bold text-base text-foreground leading-snug">
              {fault.name}
            </h4>

            <p className="text-xs text-muted-foreground leading-relaxed">{fault.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
