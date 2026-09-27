import { Button, Spinner } from "cografya_web";

export const Sizes = () => (
  <div className="flex items-center gap-4">
    <Spinner size="sm" />
    <Spinner />
    <Spinner size="lg" />
    <Spinner size="xl" className="text-primary" />
  </div>
);

export const Labelled = () => (
  <div className="flex items-center gap-4">
    <Spinner label="Harita yükleniyor" className="text-primary" />
    <span className="text-sm text-muted-foreground">Harita yükleniyor</span>
  </div>
);

export const LoadingButton = () => (
  <Button variant="primary" isLoading>
    Kaydediliyor
  </Button>
);
