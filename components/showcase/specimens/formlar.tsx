import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Specimen, SpecimenRow } from "../specimen";

export function FormlarSpecimens() {
  return (
    <>
      <Specimen
        name="Input"
        description="Etiket, yer tutucu, yardımcı metin, hata ve devre dışı durumları."
      >
        <div className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ds-input">İl adı</Label>
            <Input id="ds-input" placeholder="Örn. Çanakkale" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-input-help">Rakım</Label>
            <Input id="ds-input-help" type="number" placeholder="0" />
            <p className="text-xs text-muted-foreground">Metre cinsinden, deniz seviyesinden.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-input-err">E-posta</Label>
            <Input
              id="ds-input-err"
              type="email"
              defaultValue="gecersiz"
              aria-invalid
              aria-describedby="ds-input-err-msg"
              className="border-destructive"
            />
            <p id="ds-input-err-msg" className="text-xs font-semibold text-destructive">
              Geçerli bir e-posta adresi girin.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-input-off">Devre dışı</Label>
            <Input id="ds-input-off" defaultValue="Değiştirilemez" disabled />
          </div>
        </div>
      </Specimen>

      <Specimen name="Textarea">
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="ds-textarea">Not</Label>
          <Textarea id="ds-textarea" placeholder="Gözlem notunuz…" rows={3} />
        </div>
      </Specimen>

      <Specimen
        name="Checkbox"
        description="İşaretli, işaretsiz, belirsiz (indeterminate) ve devre dışı."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox id="ds-cb-1" />
            <Label htmlFor="ds-cb-1">İşaretsiz</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-cb-2" defaultChecked />
            <Label htmlFor="ds-cb-2">İşaretli</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-cb-3" indeterminate />
            <Label htmlFor="ds-cb-3">Belirsiz</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-cb-4" disabled />
            <Label htmlFor="ds-cb-4">Devre dışı</Label>
          </div>
        </div>
      </Specimen>

      <Specimen name="Switch">
        <SpecimenRow>
          <div className="flex items-center gap-2">
            <Switch id="ds-sw-1" />
            <Label htmlFor="ds-sw-1">Kapalı</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ds-sw-2" defaultChecked />
            <Label htmlFor="ds-sw-2">Açık</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ds-sw-3" disabled />
            <Label htmlFor="ds-sw-3">Devre dışı</Label>
          </div>
        </SpecimenRow>
      </Specimen>

      <Specimen name="Select">
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="ds-select">Coğrafi bölge</Label>
          <Select id="ds-select" defaultValue="marmara">
            <option value="marmara">Marmara</option>
            <option value="ege">Ege</option>
            <option value="akdeniz">Akdeniz</option>
            <option value="ic-anadolu">İç Anadolu</option>
          </Select>
        </div>
      </Specimen>
    </>
  );
}
