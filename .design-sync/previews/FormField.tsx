import { FormField } from "cografya_web";

export const States = () => (
  <div className="max-w-sm space-y-4">
    <FormField id="ds-ff-1" label="E-posta" type="email" placeholder="ornek@site.com" />
    <FormField
      id="ds-ff-2"
      label="Rakım"
      type="number"
      helper="Metre cinsinden, deniz seviyesinden."
    />
    <FormField
      id="ds-ff-3"
      label="E-posta"
      type="email"
      defaultValue="gecersiz"
      error="Geçerli bir e-posta adresi gir."
    />
    <FormField id="ds-ff-4" label="Devre dışı" defaultValue="Değiştirilemez" disabled />
  </div>
);
