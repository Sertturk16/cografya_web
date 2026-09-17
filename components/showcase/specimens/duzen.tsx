"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarBadge, AvatarGroup } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Specimen, SpecimenRow } from "../specimen";

const BADGE_VARIANTS = [
  "default",
  "primary",
  "secondary",
  "success",
  "warning",
  "destructive",
  "outline",
  "info",
  "chip",
] as const;

export function DuzenSpecimens() {
  return (
    <>
      <Specimen name="Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Çanakkale</CardTitle>
            <CardDescription>Marmara Bölgesi · Plaka 17</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Boğazın iki yakasına yayılan tek il; Avrupa ve Asya kıtalarında toprağı bulunur.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              İl sayfasına git
            </Button>
          </CardFooter>
        </Card>
      </Specimen>

      <Specimen name="Badge — varyantlar">
        <SpecimenRow>
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </SpecimenRow>
      </Specimen>

      <Specimen name="Badge — boyutlar ve nokta">
        <SpecimenRow>
          <Badge size="sm">sm</Badge>
          <Badge size="default">default</Badge>
          <Badge size="lg">lg</Badge>
          <Badge variant="success" dot>
            Canlı
          </Badge>
        </SpecimenRow>
      </Specimen>

      <Specimen
        name="Tabs — pills"
        description="Varyant context üzerinden taşınıyor: TabsList ve TabsTrigger'a ayrı ayrı geçirmek, ikisinin birbirinden sapmasının yoludur."
      >
        <Tabs defaultValue="iklim">
          <TabsList>
            <TabsTrigger value="iklim">İklim</TabsTrigger>
            <TabsTrigger value="nufus">Nüfus</TabsTrigger>
            <TabsTrigger value="deprem">Deprem</TabsTrigger>
          </TabsList>
          <TabsContent value="iklim" className="pt-4 text-sm text-muted-foreground">
            Akdeniz iklimi; yazlar sıcak ve kurak, kışlar ılık ve yağışlı.
          </TabsContent>
          <TabsContent value="nufus" className="pt-4 text-sm text-muted-foreground">
            TÜİK ADNKS verisi.
          </TabsContent>
          <TabsContent value="deprem" className="pt-4 text-sm text-muted-foreground">
            AFAD son olaylar.
          </TabsContent>
        </Tabs>
      </Specimen>

      <Specimen
        name="Tabs — line"
        description="Alt çizgi border değil, iç gölge: tab seçildiğinde bir piksel kaymasın diye."
      >
        <Tabs defaultValue="iklim" variant="line">
          <TabsList>
            <TabsTrigger value="iklim">İklim</TabsTrigger>
            <TabsTrigger value="nufus">Nüfus</TabsTrigger>
            <TabsTrigger value="deprem">Deprem</TabsTrigger>
          </TabsList>
          <TabsContent value="iklim" className="pt-4 text-sm text-muted-foreground">
            Sayfa içi gezinme için; pill grubu bir kontrol gibi okunur, alt çizgi gezinme gibi.
          </TabsContent>
          <TabsContent value="nufus" className="pt-4 text-sm text-muted-foreground">
            TÜİK ADNKS verisi.
          </TabsContent>
          <TabsContent value="deprem" className="pt-4 text-sm text-muted-foreground">
            AFAD son olaylar.
          </TabsContent>
        </Tabs>
      </Specimen>

      <Specimen name="Accordion">
        <Accordion className="max-w-md">
          <AccordionItem value="a">
            <AccordionTrigger>Bölge nedir?</AccordionTrigger>
            <AccordionContent>
              Türkiye yedi coğrafi bölgeye ayrılır; bu ayrım idari değil, coğrafidir.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Magnitüd ile şiddet aynı mı?</AccordionTrigger>
            <AccordionContent>
              Hayır. Magnitüd olayın enerjisini, şiddet ise belirli bir noktadaki etkisini anlatır;
              birbirinin yerine kullanılamaz.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Specimen>

      <Specimen name="Avatar">
        <SpecimenRow>
          <Avatar>
            <AvatarFallback>MÇ</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>MK</AvatarFallback>
            <AvatarBadge />
          </Avatar>
          <AvatarGroup>
            <Avatar>
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>B</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>C</AvatarFallback>
            </Avatar>
          </AvatarGroup>
        </SpecimenRow>
      </Specimen>

      <Specimen
        name="Dialog"
        portals
        description="İçeriği document.body'ye taşındığı için sağdaki panel bunu zorlayamaz."
      >
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Diyaloğu aç</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Turu sıfırla</DialogTitle>
              <DialogDescription>
                Bu turdaki tüm cevaplarınız silinecek. Bu işlem geri alınamaz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Vazgeç</Button>} />
              <DialogClose render={<Button variant="destructive">Sıfırla</Button>} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Specimen>

      <Specimen
        name="Sheet"
        portals
        description="Drawer olarak da bu bileşen kullanılır; ayrı bir Drawer yok."
      >
        <Sheet>
          <SheetTrigger render={<Button variant="outline">Paneli aç</Button>} />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Katman ayarları</SheetTitle>
              <SheetDescription>Haritada hangi katmanların görüneceğini seçin.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </Specimen>

      <Specimen
        name="Breadcrumb"
        description="27 V2 dosyası bunu elle <nav aria-label='Breadcrumb'> olarak yazıyordu. Son kırıntı bir bağlantı değil, aria-current='page' taşıyan bir metindir."
      >
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Ana Sayfa</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Türkiye</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Çanakkale</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Specimen>

      <Specimen
        name="DropdownMenu"
        description="Bir menü, bir seçim listesi değil: her satır bir EYLEM. Seçenek seçtirmek için CustomSelect ya da Select kullanılır. Portal ile açıldığı için sayfanın temasını izler, panelin değil."
        portals
      >
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">İl işlemleri</Button>} />
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Çanakkale</DropdownMenuLabel>
            <DropdownMenuItem>
              Favorilere ekle
              <DropdownMenuShortcut>⌘F</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>Haritada göster</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked>Komşu iller</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem>Deprem katmanı</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Karşılaştırmadan çıkar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Specimen>
    </>
  );
}
