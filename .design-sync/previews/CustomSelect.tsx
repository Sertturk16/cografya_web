import { CustomSelect, Label } from "cografya_web";
import * as React from "react";

const REGIONS = [
  { value: "marmara", label: "Marmara", description: "11 il, yaklaşık 67.000 km²" },
  { value: "ege", label: "Ege", description: "8 il, yaklaşık 79.000 km²" },
  { value: "akdeniz", label: "Akdeniz", description: "8 il, yaklaşık 122.000 km²" },
  { value: "ic-anadolu", label: "İç Anadolu", description: "13 il, yaklaşık 151.000 km²" },
  { value: "karadeniz", label: "Karadeniz", description: "18 il, yaklaşık 141.000 km²" },
];

/** Opened on mount through the component's own trigger, so the searchable, described list —
 *  what sets CustomSelect apart from the native Select — is what the card shows. */
export const Open = () => {
  const [value, setValue] = React.useState("marmara");
  React.useEffect(() => {
    document.getElementById("ds-custom-select")?.click();
  }, []);
  return (
    <div className="max-w-sm pb-72">
      <Label htmlFor="ds-custom-select" className="mb-1.5 block text-xs font-bold">
        Bölge
      </Label>
      <CustomSelect
        id="ds-custom-select"
        searchable
        searchPlaceholder="Bölge ara"
        value={value}
        onChange={setValue}
        options={REGIONS}
      />
    </div>
  );
};
