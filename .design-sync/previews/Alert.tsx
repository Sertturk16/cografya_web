import { Alert, AlertDescription, AlertTitle } from "cografya_web";

export const Variants = () => (
  <div className="max-w-xl space-y-3">
    <Alert variant="default">
      <AlertTitle>Katman güncellendi</AlertTitle>
      <AlertDescription>Deniz yüzeyi sıcaklığı verisi yenilendi.</AlertDescription>
    </Alert>
    <Alert variant="success">
      <AlertTitle>Tur kaydedildi</AlertTitle>
      <AlertDescription>Puanın profiline eklendi.</AlertDescription>
    </Alert>
    <Alert variant="warning">
      <AlertTitle>E-postan doğrulanmadı</AlertTitle>
      <AlertDescription>Gelen kutundaki bağlantıya tıkla.</AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <AlertTitle>Kaydedilemedi</AlertTitle>
      <AlertDescription>Bağlantı koptu. Biraz sonra yeniden dene.</AlertDescription>
    </Alert>
    <Alert variant="info">
      <AlertTitle>Veri yenileniyor</AlertTitle>
      <AlertDescription>AFAD son olayları birkaç dakikada bir güncelleniyor.</AlertDescription>
    </Alert>
  </div>
);

export const Dismissible = () => (
  <div className="max-w-xl">
    <Alert variant="info" onDismiss={() => undefined}>
      <AlertTitle>Katman güncellendi</AlertTitle>
      <AlertDescription>Deniz yüzeyi sıcaklığı verisi yenilendi.</AlertDescription>
    </Alert>
  </div>
);
