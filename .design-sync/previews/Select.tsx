import { Label, Select } from "cografya_web";

export const Default = () => (
  <div className="max-w-sm space-y-1.5">
    <Label htmlFor="ds-select">Coğrafi bölge</Label>
    <Select id="ds-select" defaultValue="marmara">
      <option value="marmara">Marmara</option>
      <option value="ege">Ege</option>
      <option value="akdeniz">Akdeniz</option>
      <option value="ic-anadolu">İç Anadolu</option>
    </Select>
  </div>
);

export const FromOptions = () => (
  <div className="max-w-sm space-y-1.5">
    <Label htmlFor="ds-select-mag">En düşük büyüklük</Label>
    <Select
      id="ds-select-mag"
      defaultValue="4"
      options={[
        { value: "3", label: "3,0 ve üzeri" },
        { value: "4", label: "4,0 ve üzeri" },
        { value: "5", label: "5,0 ve üzeri" },
      ]}
    />
  </div>
);

export const Error = () => (
  <div className="max-w-sm space-y-1.5">
    <Label htmlFor="ds-select-err">Sınıf</Label>
    <Select id="ds-select-err" isError placeholder="Sınıfını seç" defaultValue="">
      <option value="9">9. sınıf</option>
      <option value="10">10. sınıf</option>
    </Select>
    <p className="text-xs font-semibold text-destructive">Bir sınıf seç.</p>
  </div>
);
