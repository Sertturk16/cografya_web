"use client";

import * as React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Waves, Wind, Thermometer, ShieldAlert, Clock, Compass, Anchor } from "lucide-react";

interface FAQItem {
  id: string;
  icon: React.ReactNode;
  question: string;
  answer: string;
  badge?: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "faq-wave-height",
    icon: <Waves className="size-4 text-cyan-600 shrink-0" />,
    question: "Dalga yüksekliği 1 metre yazıyorsa deniz durumu nasıldır?",
    badge: "Belirgin Dalga (Hs)",
    answer:
      "Tabloda gördüğünüz dalga yüksekliği, teknik adıyla 'belirgin dalga yüksekliği'dir (Significant Wave Height - Hs). Bu değer, açık deniz dalga spektrumundaki en yüksek üçte birlik dalgaların ortalamasıdır. Denizde tek tip dalga boyu olmaz; dalgaların yaklaşık %15'i bu değeri aşar ve nadir de olsa en yüksek dalgalar Hs değerinin iki katına (2 metreye) yaklaşabilir. Dolayısıyla 1 metre dalga boyu, küçük tekneler ve kıyı aktiviteleri için hissedilir bir çalkantı anlamına gelir.",
  },
  {
    id: "faq-10m-wind",
    icon: <Wind className="size-4 text-teal-600 shrink-0" />,
    question: "10 metredeki rüzgâr hızı, sahilde hissettiğim rüzgâr mıdır?",
    badge: "Açık Deniz vs. Kıyı",
    answer:
      "Ölçüm kataloğundaki rüzgâr, deniz yüzeyinden 10 metre yükseklikteki açık deniz rüzgâr vektörüdür. Sahildeki yapılar, falezler, ağaçlar ve kıyı topoğrafyası sürtünme yaratarak rüzgâr hızını kesebilir ya da vadiler boyunca rüzgârı daraltıp hızlandırabilir (kanal etkisi). Deniz yüzeyindeki 10m rüzgârı, açıkta seyreden deniz araçlarının yelken ve gövde direnci için referans alınan standart uluslararası metriktir.",
  },
  {
    id: "faq-sst",
    icon: <Thermometer className="size-4 text-rose-600 shrink-0" />,
    question: "Deniz suyu sıcaklığı, denize girince hissettiğim sıcaklık mıdır?",
    badge: "Yüzey Sıcaklığı (SST)",
    answer:
      "Oşinografik uydular ve CMEMS modelleri deniz suyunun en üst milimetrik katmanını (Sea Surface Temperature - SST) ölçer. Kıyılardaki sığ plajlarda su güneşte hızla ısınabilirken, açık denizde rüzgârla oluşan dikey karışım daha serin alt suları yukarı taşıyabilir (upwelling). Genel olarak açık deniz SST değeri, yüzücünün kıyıda hissettiği su sıcaklığı ile 1-2 °C mertebesinde uyumludur.",
  },
  {
    id: "faq-straits-confidence",
    icon: <ShieldAlert className="size-4 text-amber-600 shrink-0" />,
    question: "Boğazlarda ve dar körfezlerde bu verilere ne kadar güvenilebilir?",
    badge: "Model Grid Çözünürlüğü",
    answer:
      "Açık deniz modelleri 4 ila 9 kilometrelik grid hücreleriyle çalışır. İstanbul Boğazı, Çanakkale Boğazı ve dar kıyı girintileri bu gridlerden daha dar olduğu için kara-deniz maskesi sınırında kalır. Ayrıca Boğazlar'da Karadeniz'den Akdeniz'e üst akıntı, Akdeniz'den Karadeniz'e ise tuzlu alt akıntı şeklinde iki tabakalı karmaşık bir hidrodinamik rejim hâkimdir. Bu nedenle Boğaz istasyonları açık deniz eğilimini gösterir ancak kılavuzluk ve dar seyir için yerel akıntı haritaları esas alınmalıdır.",
  },
  {
    id: "faq-update-cycles",
    icon: <Clock className="size-4 text-primary shrink-0" />,
    question: "Dört denizin telemetri verisi neden aynı anda güncellenmez?",
    badge: "Model Çevrimleri",
    answer:
      "Karadeniz, Marmara, Ege ve Akdeniz tek bir modelden değil, bölgesel oşinografi merkezlerinin ayrı modellerinden beslenir. ECMWF Open Data atmosferik rüzgâr modelleri günde 4 kez (00, 06, 12, 18 UTC) çalışırken; CMEMS deniz suyu sıcaklığı ve dalga modelleri günde 1 veya 2 kez asimile edilir. Tablomuzdaki 'Geçerlilik Zamanı' her noktanın en taze model anını şeffaf biçimde belgeler.",
  },
  {
    id: "faq-marmara-waves",
    icon: <Compass className="size-4 text-indigo-600 shrink-0" />,
    question: "Marmara Denizi'nde dalga yüksekliği neden her noktada görünmeyebilir?",
    badge: "İç Deniz Kısıtları",
    answer:
      "Marmara Denizi yarı kapalı küçük bir iç deniz havzasıdır. Küresel açık okyanus dalga modelleri Marmara'yı bazen kara olarak maskeleyebilir. Platformumuzda Marmara için bölgesel yüksek çözünürlüklü Akdeniz-Marmara dalga modelleri entegre edilmiştir; model koşusu bakımda olduğunda eksik veri yerine dürüstçe durum belirtilir.",
  },
  {
    id: "faq-beach-validity",
    icon: <Anchor className="size-4 text-emerald-600 shrink-0" />,
    question: "Bu sayılar gideceğim plaj için birebir geçerli midir?",
    badge: "Açık Deniz Referansı",
    answer:
      "İstasyonlarımız kıyıdan birkaç deniz mili açıktaki şamandıra ve referans noktalarını temsil eder. Mendirekle korunan liman içleri, kapalı koylar veya rüzgâra kapalı güney plajları açık denize göre çok daha sakin olabilir. Bu veriler bölgenin genel denizel atmosferini ve enerji durumunu anlamak için en güvenilir bilimsel göstergedir.",
  },
];

export function V2MarineFaqAccordion() {
  return (
    <section className="space-y-6" aria-labelledby="v2-marine-faq-heading">
      <div className="border-b border-border pb-4 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm" icon={<HelpCircle className="size-3.5" />}>
            Pedagojik Oşinografi Rehberi
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">Sıkça Sorulan Sorular</span>
        </div>
        <h2 id="v2-marine-faq-heading" className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          Deniz Durumu &amp; Dalga Verilerini Okuma Rehberi
        </h2>
      </div>

      {/* Accordion Component - Default Closed */}
      <Accordion type="single" collapsible className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted/60 text-foreground shrink-0">
                  {item.icon}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-left">
                  <span className="font-semibold text-foreground text-sm sm:text-base">
                    {item.question}
                  </span>
                  {item.badge && (
                    <Badge variant="outline" size="sm" className="text-[10px] py-0 px-2 font-mono">
                      {item.badge}
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="pt-2 pl-11 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
