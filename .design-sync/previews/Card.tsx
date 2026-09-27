import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "cografya_web";

export const Panel = () => (
  <Card variant="panel" space="4">
    <h2 className="m-0 font-heading text-xl font-bold text-primary-strong">İklim Özeti</h2>
    <p className="m-0 text-sm text-muted-foreground">
      Ankara'da karasal iklim görülür: yazlar sıcak ve kurak, kışlar soğuk ve karlıdır. Yıllık yağış
      yaklaşık 400 mm'dir.
    </p>
  </Card>
);

export const Glass = () => (
  <div className="bg-gradient-to-b from-primary/10 to-background p-6">
    <Card variant="glass" space="3">
      <p className="m-0 text-xs font-semibold text-muted-foreground">Nüfus (TÜİK, 2025)</p>
      <p className="m-0 font-heading text-2xl font-bold text-foreground">5.864.049</p>
    </Card>
  </div>
);

export const Composed = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>AYT Coğrafya Branş Denemeleri</CardTitle>
      <CardDescription>30 deneme, 180 soru çözümü</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex gap-2">
        <Badge variant="primary">AYT</Badge>
        <Badge variant="outline">Deneme</Badge>
      </div>
    </CardContent>
    <CardFooter>
      <Button size="sm">Çözümlere Git</Button>
    </CardFooter>
  </Card>
);
