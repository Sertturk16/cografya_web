import { Badge, Card, PageHero } from "cografya_web";
import { Globe } from "lucide-react";

export const Hub = () => (
  <Card variant="feature">
    <PageHero
      tier="hub"
      heading="Türkiye Haritası"
      badges={
        <>
          <Badge variant="primary" icon={<Globe className="size-3.5" />}>
            81 İl
          </Badge>
          <Badge variant="outline">7 Bölge</Badge>
        </>
      }
      lede="İllerin nüfusunu, yüzölçümünü ve iklimini haritada keşfet. Bir ile tıkla, ayrıntılar açılsın."
    />
  </Card>
);

export const Detail = () => (
  <Card variant="feature">
    <PageHero
      tier="detail"
      heading="Ankara"
      badges={
        <>
          <Badge variant="chip">İç Anadolu Bölgesi</Badge>
          <Badge variant="outline">Plaka 06</Badge>
        </>
      }
      lede="Türkiye'nin başkenti; karasal iklimin ve bozkır bitki örtüsünün tipik görüldüğü il."
    />
  </Card>
);
