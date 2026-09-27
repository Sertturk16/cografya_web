import { Tabs, TabsContent, TabsList, TabsTrigger } from "cografya_web";

export const Pills = () => (
  <Tabs defaultValue="iklim" className="max-w-md">
    <TabsList>
      <TabsTrigger value="iklim">İklim</TabsTrigger>
      <TabsTrigger value="nufus">Nüfus</TabsTrigger>
      <TabsTrigger value="deprem">Deprem</TabsTrigger>
    </TabsList>
    <TabsContent value="iklim" className="pt-4 text-sm text-muted-foreground">
      Akdeniz iklimi; yazlar sıcak ve kurak, kışlar ılık ve yağışlı.
    </TabsContent>
    <TabsContent value="nufus" className="pt-4 text-sm text-muted-foreground">
      TÜİK nüfus verisi.
    </TabsContent>
    <TabsContent value="deprem" className="pt-4 text-sm text-muted-foreground">
      AFAD son olaylar.
    </TabsContent>
  </Tabs>
);

export const Line = () => (
  <Tabs defaultValue="iklim" variant="line" className="max-w-md">
    <TabsList>
      <TabsTrigger value="iklim">İklim</TabsTrigger>
      <TabsTrigger value="nufus">Nüfus</TabsTrigger>
      <TabsTrigger value="deprem">Deprem</TabsTrigger>
    </TabsList>
    <TabsContent value="iklim" className="pt-4 text-sm text-muted-foreground">
      Sayfa içi gezinme için alt çizgili sekmeler.
    </TabsContent>
    <TabsContent value="nufus" className="pt-4 text-sm text-muted-foreground">
      TÜİK nüfus verisi.
    </TabsContent>
    <TabsContent value="deprem" className="pt-4 text-sm text-muted-foreground">
      AFAD son olaylar.
    </TabsContent>
  </Tabs>
);
