import { Input, Label } from "cografya_web";

export const WithControl = () => (
  <div className="max-w-sm space-y-1.5">
    <Label htmlFor="ds-label-city">İl adı</Label>
    <Input id="ds-label-city" placeholder="Örn. Rize" />
  </div>
);

export const Required = () => (
  <div className="max-w-sm space-y-1.5">
    <Label htmlFor="ds-label-mail" required>
      E-posta
    </Label>
    <Input id="ds-label-mail" type="email" placeholder="ornek@site.com" />
  </div>
);
