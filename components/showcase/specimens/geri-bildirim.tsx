"use client";

import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { Specimen, SpecimenRow } from "../specimen";

const ALERT_VARIANTS = ["default", "success", "warning", "destructive", "info"] as const;

export function GeriBildirimSpecimens() {
  return (
    <>
      <Specimen
        name="Alert — sistem durumu"
        description="Alert bir OLAY bildirir: istek başarısız oldu, e-posta doğrulanmadı, bayrak kapalı. Eğitimsel bir yan not için Callout kullanın — Alert'in role=alert/status semantiği, olay olmayan bir şey için yardımcı teknolojiyi böler."
      >
        <div className="space-y-3">
          {ALERT_VARIANTS.map((variant) => (
            <Alert key={variant} variant={variant}>
              <AlertTitle>{variant}</AlertTitle>
              <AlertDescription>
                Bu varyantın rengi artık köprü token&apos;ından geliyor, kaçıştan değil.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </Specimen>

      <Specimen name="Alert — kapatılabilir">
        <Alert variant="info" onDismiss={() => undefined}>
          <AlertTitle>Katman güncellendi</AlertTitle>
          <AlertDescription>Deniz yüzeyi sıcaklığı verisi yenilendi.</AlertDescription>
        </Alert>
      </Specimen>

      <Specimen
        name="Toast"
        portals
        description="Sonner ekranın köşesine render eder, yani her iki panel de sayfanın genel temasını gösterir."
      >
        <SpecimenRow>
          <Button variant="outline" size="sm" onClick={() => toast.success("Tur kaydedildi")}>
            success
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Veri yenilendi")}>
            info
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.warning("Bağlantı yavaş")}>
            warning
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.error("Kaydedilemedi")}>
            error
          </Button>
        </SpecimenRow>
      </Specimen>

      <Specimen name="Skeleton">
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </Specimen>

      <Specimen
        name="Tooltip"
        portals
        description="8 V2 dosyası bunun yerine title= kullanıyordu. title klavye odağında görünmez, dokunmada hiç görünmez ve stillenemez — yani bir erişilebilirlik düzeltmesi, süs değil."
      >
        <TooltipProvider>
          <SpecimenRow>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="sm">
                    M 4.5
                  </Button>
                }
              />
              <TooltipContent>Magnitüd 4,5 ve üzeri olaylar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="sm">
                    ODbL
                  </Button>
                }
              />
              <TooltipContent>Open Database License</TooltipContent>
            </Tooltip>
          </SpecimenRow>
        </TooltipProvider>
      </Specimen>

      <Specimen
        name="Popover"
        portals
        description="Tooltip'ten farkı içeriğin zengin ve odaklanabilir olabilmesi: harita üzerinde bir noktanın künyesi, bir lejant açıklaması."
      >
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                Kaynak künyesi
              </Button>
            }
          />
          <PopoverContent className="max-w-xs">
            <PopoverHeader>
              <PopoverTitle>ERA5-Land</PopoverTitle>
              <PopoverDescription>
                Copernicus İklim Değişikliği Servisi tarafından üretilen yeniden analiz verisi.
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </Specimen>
    </>
  );
}
