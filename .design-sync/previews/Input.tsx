import { Input, Label } from "cografya_web";
import { Search } from "lucide-react";

export const States = () => (
  <div className="max-w-sm space-y-4">
    <div className="space-y-1.5">
      <Label htmlFor="ds-input">İl adı</Label>
      <Input id="ds-input" placeholder="Örn. Çanakkale" />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="ds-input-err">E-posta</Label>
      <Input id="ds-input-err" type="email" defaultValue="gecersiz" isError aria-invalid />
      <p className="text-xs font-semibold text-destructive">Geçerli bir e-posta adresi gir.</p>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="ds-input-off">Devre dışı</Label>
      <Input id="ds-input-off" defaultValue="Değiştirilemez" disabled />
    </div>
  </div>
);

export const WithIconAndSuffix = () => (
  <div className="max-w-sm space-y-4">
    <Input placeholder="İl, ülke veya deniz ara" leftIcon={<Search className="size-4" />} />
    <Input type="number" defaultValue="938" suffix="m" aria-label="Rakım" />
  </div>
);

export const Sizes = () => (
  <div className="max-w-sm space-y-3">
    <Input inputSize="sm" placeholder="Küçük" />
    <Input inputSize="md" placeholder="Orta" />
    <Input inputSize="lg" placeholder="Büyük" />
  </div>
);
