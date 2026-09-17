"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { CustomSelect } from "@/components/ui/custom-select";
import { Label } from "@/components/ui/label";
import { FormField, FormErrorSummary } from "@/components/patterns/form-field";
import * as React from "react";
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

      <Specimen
        name="FormField"
        description="Etiket, kontrol, yardımcı metin ve hata bir arada — bağlantı unutulamayacak şekilde. Yardımcı ve hata BİRBİRİNİ DIŞLAR: ikisini birden göstermek okura hangisinin geçerli olduğunu çözdürür, ekran okuyucu ise ikisini peş peşe okur ve birinin diğerini geçersiz kıldığını hiç belirtmez."
      >
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
            error="Geçerli bir e-posta adresi girin."
          />
          <FormField id="ds-ff-4" label="Devre dışı" defaultValue="Değiştirilemez" disabled />
        </div>
      </Specimen>

      <Specimen
        name="FormErrorSummary"
        description="Callout'un aksine bu GERÇEKTEN bir olay: okurun az önce yaptığı şey çalışmadı. role=alert doğru, ve tabIndex=-1 formun odağı buraya taşımasını sağlar — Tab hiç buraya inmez ama gönderim başarısız olunca form odağı getirir."
      >
        <FormErrorSummaryDemo />
      </Specimen>

      <Specimen
        name="CustomSelect"
        description="Select DEĞİL: aranabilir, ve her seçeneğin altına bir açıklama satırı alabilir. 81 il arasından seçim yaptıran yerlerde yerli Select'in yapamadığı iş bu. Aramayı kapatınca sade bir listeye döner."
        portals
      >
        <CustomSelectDemo />
      </Specimen>
    </>
  );
}

function CustomSelectDemo() {
  const [value, setValue] = React.useState("marmara");
  return (
    <div className="max-w-sm">
      <Label htmlFor="ds-custom-select" className="mb-1.5 block text-xs font-bold">
        Bölge
      </Label>
      <CustomSelect
        id="ds-custom-select"
        searchable
        value={value}
        onChange={setValue}
        options={[
          { value: "marmara", label: "Marmara", description: "11 il · 67.000 km²" },
          { value: "ege", label: "Ege", description: "8 il · 79.000 km²" },
          { value: "akdeniz", label: "Akdeniz", description: "8 il · 122.000 km²" },
          { value: "ic-anadolu", label: "İç Anadolu", description: "13 il · 151.000 km²" },
          { value: "karadeniz", label: "Karadeniz", description: "18 il · 141.000 km²" },
        ]}
      />
    </div>
  );
}
function FormErrorSummaryDemo() {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  return (
    <div className="max-w-sm">
      <FormErrorSummary
        headingRef={headingRef}
        summary="Formda 2 hata var"
        fieldErrors={[
          { id: "ds-ff-3", label: "E-posta" },
          { id: "ds-ff-2", label: "Rakım" },
        ]}
      />
    </div>
  );
}
