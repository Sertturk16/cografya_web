import { Button } from "cografya_web";
import { ArrowRight, Map, Search } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary">Oyuna Başla</Button>
    <Button variant="secondary">Haritayı Aç</Button>
    <Button variant="outline">Kaynakları Gör</Button>
    <Button variant="ghost">Vazgeç</Button>
    <Button variant="destructive">Hesabı Sil</Button>
    <Button variant="link">Tüm iller</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Küçük</Button>
    <Button size="md">Orta</Button>
    <Button size="lg">Büyük</Button>
    <Button size="icon" variant="outline" aria-label="Ara">
      <Search className="size-4" />
    </Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button leftIcon={<Map className="size-4" />}>Türkiye Haritası</Button>
    <Button variant="outline" rightIcon={<ArrowRight className="size-4" />}>
      Devam Et
    </Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Kaydet</Button>
    <Button variant="outline" disabled>
      Önceki
    </Button>
  </div>
);
