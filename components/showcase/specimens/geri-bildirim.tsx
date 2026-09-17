"use client";

import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Callout } from "@/components/patterns/callout";
import { EmptyState } from "@/components/patterns/empty-state";
import { MapPinOff } from "lucide-react";
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
        name="Callout — editoryal yan not"
        description="Alert DEĞİL, ve fark yük taşıyor. Alert bir OLAY bildirir ve tam bu yüzden role çözer. Callout'un rolü YOKTUR: pedagojik bir notu Alert olarak dizmek, hiçbir şey olmamışken yardımcı teknolojiyi böler ve 'bir şey bozuldu' görsel dilini sıradan ders materyaline yapıştırır. Hata sessiz ve tek yönlüdür — ekranda iyi görünür, yalnızca onu göremeyen okur için bozulur."
      >
        <div className="space-y-3">
          <Callout variant="note" title="Tanım">
            Coğrafi bölge, idari bir birim değildir; iklim, yer şekilleri ve beşerî özelliklere göre
            yapılmış bir sınıflandırmadır.
          </Callout>
          <Callout variant="tip" title="İpucu">
            Haritada bir ile tıklayarak o ilin iklim grafiğine doğrudan geçebilirsiniz.
          </Callout>
          <Callout variant="caution" title="Sık karıştırılır">
            Magnitüd olayın enerjisini, şiddet ise belirli bir noktadaki etkisini anlatır.
            Birbirinin yerine kullanılamaz.
          </Callout>
          <Callout variant="source" title="Kaynak">
            Sıcaklık değerleri ERA5-Land yeniden analizinden, 1991-2020 normalleri.
          </Callout>
        </div>
      </Specimen>

      <Specimen
        name="EmptyState"
        description="İçerik olsaydı duracağı yerde durur. role=status değil: boş durum, mevcut filtre için sayfanın olağan içeriğidir, bir olay değil — ilk boyamada oradadır ve okur ona okuyarak ulaşır."
      >
        <EmptyState
          icon={<MapPinOff className="size-8" />}
          title="Bu filtreye uyan il yok"
          description="Seçili bölge ve iklim tipi birlikte hiçbir ili kapsamıyor. Filtrelerden birini genişletmeyi deneyin."
          action={
            <Button variant="outline" size="sm">
              Filtreleri sıfırla
            </Button>
          }
        />
      </Specimen>
    </>
  );
}
