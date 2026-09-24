"use client";

import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSkeleton } from "@/components/patterns/page-skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Specimen, SpecimenRow } from "../specimen";

const ALERT_VARIANTS = ["default", "success", "warning", "destructive", "info"] as const;

export function GeriBildirimSpecimens() {
  return (
    <>
      <Specimen
        name="Alert — sistem durumu"
        description="Alert bir OLAY bildirir: istek başarısız oldu, e-posta doğrulanmadı, bayrak kapalı. Eğitimsel bir yan not Alert DEĞİLDİR: role=alert/status semantiği, olay olmayan bir şey için yardımcı teknolojiyi böler. Böyle bir not sıradan dizgiyle yazılır."
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
        name="PageSkeleton"
        description="Bir sayfanın yükleme hâli. loading.tsx ve Suspense fallback'leri bu parçalardan kurulur; içerik gelince hiçbir şey yerinden oynamaz, çünkü parçalar gerçek sayfanın ölçüsünü taşır. Tek role=status, çubuklar aria-hidden."
      >
        <div className="space-y-6">
          <PageSkeleton shape="auth" />
          <PageSkeleton shape="play" />
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
    </>
  );
}
