"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CustomSelect } from "@/components/ui/custom-select";
import { Label } from "@/components/ui/label";
import { FormField, FormErrorSummary } from "@/components/patterns/form-field";
import * as React from "react";
import { Specimen } from "../specimen";

export function FormlarSpecimens() {
  return (
    <>
      <Specimen
        name="Input"
        description="Etiket, yer tutucu, yardımcı metin, hata ve devre dışı durumları."
      >
        {(panel) => (
          <div className="max-w-sm space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={panel.id("ds-input")}>İl adı</Label>
              <Input id={panel.id("ds-input")} placeholder="Örn. Çanakkale" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={panel.id("ds-input-help")}>Rakım</Label>
              <Input id={panel.id("ds-input-help")} type="number" placeholder="0" />
              <p className="text-xs text-muted-foreground">Metre cinsinden, deniz seviyesinden.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={panel.id("ds-input-err")}>E-posta</Label>
              <Input
                id={panel.id("ds-input-err")}
                type="email"
                defaultValue="gecersiz"
                aria-invalid
                aria-describedby={panel.id("ds-input-err-msg")}
                className="border-destructive"
              />
              <p
                id={panel.id("ds-input-err-msg")}
                className="text-xs font-semibold text-destructive"
              >
                Geçerli bir e-posta adresi girin.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={panel.id("ds-input-off")}>Devre dışı</Label>
              <Input id={panel.id("ds-input-off")} defaultValue="Değiştirilemez" disabled />
            </div>
          </div>
        )}
      </Specimen>

      <Specimen name="Select">
        {(panel) => (
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor={panel.id("ds-select")}>Coğrafi bölge</Label>
            <Select id={panel.id("ds-select")} defaultValue="marmara">
              <option value="marmara">Marmara</option>
              <option value="ege">Ege</option>
              <option value="akdeniz">Akdeniz</option>
              <option value="ic-anadolu">İç Anadolu</option>
            </Select>
          </div>
        )}
      </Specimen>

      <Specimen
        name="FormField"
        description="Etiket, kontrol, yardımcı metin ve hata bir arada — bağlantı unutulamayacak şekilde. Yardımcı ve hata BİRBİRİNİ DIŞLAR: ikisini birden göstermek okura hangisinin geçerli olduğunu çözdürür, ekran okuyucu ise ikisini peş peşe okur ve birinin diğerini geçersiz kıldığını hiç belirtmez."
      >
        {(panel) => (
          <div className="max-w-sm space-y-4">
            <FormField
              id={panel.id("ds-ff-1")}
              label="E-posta"
              type="email"
              placeholder="ornek@site.com"
            />
            <FormField
              id={panel.id("ds-ff-2")}
              label="Rakım"
              type="number"
              helper="Metre cinsinden, deniz seviyesinden."
            />
            <FormField
              id={panel.id("ds-ff-3")}
              label="E-posta"
              type="email"
              defaultValue="gecersiz"
              error="Geçerli bir e-posta adresi girin."
            />
            <FormField
              id={panel.id("ds-ff-4")}
              label="Devre dışı"
              defaultValue="Değiştirilemez"
              disabled
            />
          </div>
        )}
      </Specimen>

      <Specimen
        name="FormErrorSummary"
        description="Callout'un aksine bu GERÇEKTEN bir olay: okurun az önce yaptığı şey çalışmadı. role=alert doğru, ve tabIndex=-1 formun odağı buraya taşımasını sağlar — Tab hiç buraya inmez ama gönderim başarısız olunca form odağı getirir."
      >
        {(panel) => <FormErrorSummaryDemo fieldId={panel.id} />}
      </Specimen>

      <Specimen
        name="CustomSelect"
        description="Select DEĞİL: aranabilir, ve her seçeneğin altına bir açıklama satırı alabilir. 81 il arasından seçim yaptıran yerlerde yerli Select'in yapamadığı iş bu. Aramayı kapatınca sade bir listeye döner."
        portals
      >
        {(panel) => <CustomSelectDemo id={panel.id("ds-custom-select")} />}
      </Specimen>
    </>
  );
}

function CustomSelectDemo({ id }: { readonly id: string }) {
  const [value, setValue] = React.useState("marmara");
  return (
    <div className="max-w-sm">
      <Label htmlFor={id} className="mb-1.5 block text-xs font-bold">
        Bölge
      </Label>
      <CustomSelect
        id={id}
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
/** `fieldId` points each panel's links at the FormField specimen's fields in the SAME panel. */
function FormErrorSummaryDemo({ fieldId }: { readonly fieldId: (base: string) => string }) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  return (
    <div className="max-w-sm">
      <FormErrorSummary
        headingRef={headingRef}
        summary="Formda 2 hata var"
        fieldErrors={[
          { id: fieldId("ds-ff-3"), label: "E-posta" },
          { id: fieldId("ds-ff-2"), label: "Rakım" },
        ]}
      />
    </div>
  );
}
