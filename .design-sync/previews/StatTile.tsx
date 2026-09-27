import { StatGrid, StatTile } from "cografya_web";
import { Mountain, Ruler, Users } from "lucide-react";

export const Measurements = () => (
  <StatGrid>
    <StatTile
      label="Nüfus"
      value={5864049}
      locale="tr"
      absent={{ label: "Veri yok" }}
      icon={<Users className="size-4" />}
      tone="primary"
    />
    <StatTile
      label="Yüzölçümü"
      value={25632}
      unit="km²"
      locale="tr"
      absent={{ label: "Veri yok" }}
      icon={<Ruler className="size-4" />}
      tone="secondary"
    />
    <StatTile
      label="Ortalama Yükselti"
      value={938}
      unit="m"
      locale="tr"
      absent={{ label: "Veri yok" }}
      icon={<Mountain className="size-4" />}
      tone="accent"
    />
  </StatGrid>
);

export const Facts = () => (
  <StatGrid>
    <StatTile label="Toplam Kıyı Uzunluğu (HGM)" fact="8.333 km" tone="primary" />
    <StatTile label="Türkiye'de Görülen" fact="6 Kıyı Tipi" tone="secondary" />
    <StatTile label="Denize Kıyısı Olan İl" fact="28 İl" tone="accent" />
  </StatGrid>
);

export const Absent = () => (
  <StatGrid>
    <StatTile
      label="Yıllık Yağış"
      value={null}
      unit="mm"
      absent={{ label: "Ölçüm yok", hint: "Bu ilde istasyon verisi yayımlanmıyor" }}
    />
  </StatGrid>
);
