import { Button } from "@/components/ui/button";
import { Specimen, SpecimenRow } from "../specimen";
import { ArrowRight, Download, Trash2 } from "lucide-react";

const VARIANTS = [
  "default",
  "primary",
  "secondary",
  "emerald",
  "sky",
  "teal",
  "amber",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;

const SIZES = ["sm", "md", "default", "lg"] as const;

export function AksiyonlarSpecimens() {
  return (
    <>
      <Specimen
        name="Button — varyantlar"
        description="Her varyant iki temada. emerald, sky, teal ve amber renk adı taşıyan varyantlar; geri kalanı semantik. 34 V2 dosyası bu adları çağırdığı için isimlendirme T-034 kapsamında değiştirilmiyor."
      >
        <SpecimenRow>
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </SpecimenRow>
      </Specimen>

      <Specimen name="Button — boyutlar">
        <SpecimenRow>
          {SIZES.map((size) => (
            <Button key={size} variant="primary" size={size}>
              {size}
            </Button>
          ))}
          <Button variant="primary" size="icon" aria-label="İndir">
            <Download className="size-4" />
          </Button>
          <Button variant="primary" size="icon-sm" aria-label="İndir">
            <Download className="size-3.5" />
          </Button>
          <Button variant="primary" size="icon-lg" aria-label="İndir">
            <Download className="size-5" />
          </Button>
        </SpecimenRow>
      </Specimen>

      <Specimen
        name="Button — durumlar"
        description="isLoading disabled'ı da set eder, ikisini birlikte geçmeyin."
      >
        <SpecimenRow>
          <Button variant="primary">Normal</Button>
          <Button variant="primary" disabled>
            Devre dışı
          </Button>
          <Button variant="primary" isLoading>
            Yükleniyor
          </Button>
          <Button variant="primary" leftIcon={<Download className="size-4" />}>
            Sol ikon
          </Button>
          <Button variant="primary" rightIcon={<ArrowRight className="size-4" />}>
            Sağ ikon
          </Button>
          <Button variant="destructive" leftIcon={<Trash2 className="size-4" />}>
            Sil
          </Button>
        </SpecimenRow>
      </Specimen>
    </>
  );
}
