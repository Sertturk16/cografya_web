import * as React from "react";

export function V2StudyStrategyGuide() {
  const topics = [
    {
      title: "Doğal sistemler ve iklim",
      desc: "Basınç merkezleri, rüzgârlar, iklim tipleri, yağış rejimleri ve bitki örtüsü. Türkiye'deki dağılımı dünyadakiyle yan yana çalış.",
    },
    {
      title: "Nüfus ve yerleşme",
      desc: "Nüfus artış hızı, göç türleri, yerleşme tipleri ve nüfus piramitleri. Bu konuda bir grafiğe ya da tabloya bakıp ne anlattığını söyleyebilmen gerekir.",
    },
    {
      title: "Madenler, enerji ve sanayi",
      desc: "Maden yatakları, enerji kaynakları (jeotermal, rüzgâr, hidroelektrik) ve sanayi kollarının Türkiye'de nerelerde toplandığı.",
    },
    {
      title: "Boğazlar ve kanallar",
      desc: "Hürmüz, Malakka, Süveyş, Panama, Babülmendep: deniz ticaretinin geçtiği bu yerleri dilsiz dünya haritasında gösterebilecek kadar iyi bil.",
    },
  ];

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
            Coğrafya Çalışırken Dört Ana Başlık
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topics.map((t) => (
          <div
            key={t.title}
            className="p-5 rounded-2xl border border-border bg-card/70 hover:border-primary/40 transition-all duration-300 space-y-2.5 shadow-2xs"
          >
            <h4 className="font-heading font-bold text-base text-foreground">{t.title}</h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
