import { Card, PageContainer } from "cografya_web";

export const Rhythms = () => (
  <div className="w-full space-y-6">
    {(["band", "default"] as const).map((space) => (
      <div key={space} className="overflow-hidden rounded-md border border-dashed border-border">
        <p className="m-0 border-b border-dashed border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
          space="{space}"
        </p>
        <PageContainer space={space}>
          <Card variant="panel" space="3">
            <p className="m-0 text-sm text-foreground">İklim Özeti</p>
          </Card>
          <Card variant="panel" space="3">
            <p className="m-0 text-sm text-foreground">Nüfus</p>
          </Card>
        </PageContainer>
      </div>
    ))}
  </div>
);
