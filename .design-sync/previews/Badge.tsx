import { Badge } from "cografya_web";
import { Globe } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="default">Varsayılan</Badge>
    <Badge variant="primary">AYT</Badge>
    <Badge variant="secondary">Marmara</Badge>
    <Badge variant="success">Tamamlandı</Badge>
    <Badge variant="warning">Uyarı</Badge>
    <Badge variant="destructive">M 5,2</Badge>
    <Badge variant="outline">Plaka 17</Badge>
    <Badge variant="info">Yeni veri</Badge>
    <Badge variant="chip">İç Anadolu Bölgesi</Badge>
  </div>
);

export const SizesAndDot = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge size="sm">Küçük</Badge>
    <Badge size="default">Orta</Badge>
    <Badge size="lg">Büyük</Badge>
    <Badge variant="success" dot>
      Canlı
    </Badge>
    <Badge variant="primary" icon={<Globe className="size-3.5" />}>
      81 İl
    </Badge>
  </div>
);
