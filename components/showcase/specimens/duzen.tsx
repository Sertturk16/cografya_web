"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardVariant,
  type CardSpace,
  type CardElevation,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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
  SheetFooter,
  SheetClose,
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
import { Home } from "lucide-react";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { BreadcrumbsNav } from "@/components/patterns/breadcrumbs-nav";
import { Specimen, SpecimenRow } from "../specimen";

const RHYTHMS = ["band", "tight", "default", "loose"] as const;

/**
 * Every `Card` surface at a representative rhythm, plus the elevations the panel actually ships
 * at. The pairs are the ones the product writes: `panel`/`space="4"` is 13 adopted sites,
 * `glass`/`space="1"` all 12, `feature` with no rhythm all 13.
 */
const CARD_SURFACE_SPECIMENS = [
  ["panel", "4", "Bölüm paneli — 52 site."],
  ["glass", "1", "Hero şeridi, kendi degrade bandının üstünde — 12 site."],
  ["feature", "none", "Hub hero levhası, PageHero'yu taşır — 13 site."],
] as const satisfies ReadonlyArray<readonly [CardVariant, CardSpace, string]>;

const CARD_ELEVATION_SPECIMENS = ["xs", "sm", "xl"] as const satisfies readonly CardElevation[];

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

/**
 * The Sheet specimen's layer toggles.
 *
 * Local to this file on purpose. T-036 deleted `components/ui/switch.tsx` because the two
 * places in the product that want a toggle want switch SEMANTICS, not a rail and a thumb, and
 * both already write them by hand — `components/book/video-progress-controls.tsx` and
 * `components/v2/v2-favorite-button.tsx`. This is the same shape, so the Sheet demo shows the
 * pattern the repo actually uses instead of advertising a primitive nothing imports.
 */
function LayerToggle({ id, defaultOn }: { readonly id: string; readonly defaultOn: boolean }) {
  const [on, setOn] = React.useState(defaultOn);
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={on}
      aria-labelledby={`${id}-label`}
      onClick={() => setOn((value) => !value)}
      className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-foreground"
    >
      {on ? "Açık" : "Kapalı"}
    </button>
  );
}

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

      <Specimen
        name="Card — yüzeyler, gölge ve ritim"
        description="Sitenin ölçülen kart dili: yüzey (variant), gölge (elevation) ve dikey ritim (space) ayrı eksenler. className kapalı — her site aynı sarmalayıcıyı yazmak yerine bu eksenleri seçer."
      >
        <div className="space-y-4">
          {CARD_SURFACE_SPECIMENS.map(([variant, space, note]) => (
            <Card key={`${variant}-${space}`} variant={variant} space={space}>
              <p className="font-heading text-sm font-bold text-foreground">
                variant=&quot;{variant}&quot; space=&quot;{space}&quot;
              </p>
              <p className="text-sm text-muted-foreground">{note}</p>
            </Card>
          ))}
          {CARD_ELEVATION_SPECIMENS.map((elevation) => (
            <Card key={elevation} variant="panel" elevation={elevation} space="3">
              <p className="font-heading text-sm font-bold text-foreground">
                variant=&quot;panel&quot; elevation=&quot;{elevation}&quot; space=&quot;3&quot;
              </p>
              <p className="text-sm text-muted-foreground">
                Aynı yüzey, ölçülen farklı yükseklik ayarı.
              </p>
            </Card>
          ))}
        </div>
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

      <Specimen
        name="Accordion"
        description="Base UI accordion'u. `type`/`collapsible` yoktur; gerçek denetim `multiple` boolean'ı ve dizi biçimli `defaultValue`'dur. Kapalı panel DOM'dan silinmez, `hidden` ile gizlenir — bu yüzden tarayıcı içi arama metni bulup paneli açabilir ve kapalı cevap sunucu HTML'inde kalır."
      >
        <Accordion className="max-w-md" defaultValue={["a"]}>
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
        description="Drawer olarak da bu bileşen kullanılır; ayrı bir Drawer yok. Filtre paneli en doğal V2 kullanımı: başlık, gövde ve kapanış eylemleri bir arada."
      >
        <Sheet>
          <SheetTrigger render={<Button variant="outline">Filtreler</Button>} />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Katman ayarları</SheetTitle>
              <SheetDescription>Haritada hangi katmanların görüneceğini seçin.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-2">
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Katmanlar
                </p>
                {[
                  ["sheet-layer-provinces", "İl sınırları", true],
                  ["sheet-layer-water", "Göller ve barajlar", true],
                  ["sheet-layer-faults", "Fay hatları", false],
                  ["sheet-layer-relief", "Yükselti gölgelemesi", false],
                ].map(([id, label, on]) => (
                  <div key={id as string} className="flex items-center justify-between gap-3">
                    <span id={`${id as string}-label`} className="text-sm text-foreground">
                      {label as string}
                    </span>
                    <LayerToggle id={id as string} defaultOn={on as boolean} />
                  </div>
                ))}
              </div>

              {/* A border ON the next group, not a standalone rule between two of them
                  (T-036): this is what `border-t border-border` is for, and it is why the
                  Separator primitive had nothing to replace in this repo. */}
              <div className="space-y-2 border-t border-border pt-5">
                <Label htmlFor="sheet-magnitude" className="text-xs font-bold">
                  En düşük büyüklük
                </Label>
                <Select id="sheet-magnitude" defaultValue="4">
                  <option value="3">3,0 ve üzeri</option>
                  <option value="4">4,0 ve üzeri</option>
                  <option value="5">5,0 ve üzeri</option>
                </Select>
              </div>
            </div>
            <SheetFooter>
              <SheetClose render={<Button variant="ghost">Temizle</Button>} />
              <SheetClose render={<Button variant="primary">Uygula</Button>} />
            </SheetFooter>
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
        name="BreadcrumbsNav"
        description="`components/patterns/breadcrumbs-nav.tsx`: aynı diziden `aria-current` taşıyan son kırıntıyı üretir, ilk kırıntının `icon`'u `aria-hidden` sarmalanır. `components/patterns/breadcrumbs.tsx`'in `Breadcrumbs`'ı bunun üstüne eşleşen `BreadcrumbList` JSON-LD'sini ekleyen bir SUNUCU bileşeni (`lib/seo/json-ld`'nin `server-only` koruması yüzünden) — bu vitrin sayfası gibi bir Client Component'ten render edilemez, ayrı bir dosyada olması da bundan: aynı dosyada iki export olarak dursaydı `pnpm build` yine kırılırdı (Turbopack sınırı export değil dosya bazlı çalışıyor). Görünen çıktısı birebir aynı olduğundan bu tek örnek hem `breadcrumbs-nav` hem `breadcrumbs` kayıtlarını karşılar."
      >
        <BreadcrumbsNav
          items={[
            { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
            { label: "Türkiye", href: "/turkiye", path: "/turkiye" },
            { label: "Çanakkale", path: "/turkiye/canakkale" },
          ]}
        />
      </Specimen>

      <Specimen
        name="PageContainer — ritimler"
        description="`band` sayfa dikey dolgusu taşımaz; sayfanın kendi `py-10 sm:py-14` bandının içine oturur. Diğer üçü `pt-6 pb-20 sm:pt-10` üstüne kendi `space-y` değerini ekler."
      >
        <div className="w-full space-y-6">
          {RHYTHMS.map((space) => (
            <div
              key={space}
              className="overflow-hidden rounded-md border border-dashed border-border"
            >
              <p className="border-b border-dashed border-border bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                space=&quot;{space}&quot;
              </p>
              <PageContainer space={space}>
                <div className="rounded-md bg-card p-4 text-sm text-foreground">Blok 1</div>
                <div className="rounded-md bg-card p-4 text-sm text-foreground">Blok 2</div>
              </PageContainer>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        name="PageHero — iki kademe"
        description="Sayfa başlığının ölçülmüş biçimi: 14 hub kahramanının beşi de aynı sırayı yazıyor — rozetler, tek h1, yerel uyarı, lede, kuyruk. `tier` yalnızca başlığı seçer: hub kademesi terracotta ve `text-[1.9rem] sm:text-5xl` (1.9rem alt sınırı korunur, sayfaların `text-3xl`'i değil), detay kademesi nötr ve `text-4xl sm:text-6xl`. `className` yok ve `breadcrumbs` prop'u da yok: 17 sayfanın hepsinde kırıntılar kahramanın içinde değil, `PageContainer` düzeyinde kardeş olarak duruyor."
      >
        <div className="w-full space-y-6">
          <div className="overflow-hidden rounded-md border border-dashed border-border p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              tier=&quot;hub&quot;
            </p>
            <PageHero
              tier="hub"
              heading="CBS Harita & Jeodezik Ölçüm Laboratuvarı"
              badges={
                <>
                  <Badge variant="primary" size="sm">
                    Coğrafi Bilgi Sistemleri
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    3&apos;ü 1 Arada
                  </Badge>
                </>
              }
              lede="Harita üzerinde dilediğiniz noktaları işaretleyerek gerçek jeodezik mesafeyi, enlem/boylam koordinatlarını ve küresel çokgen yüzölçümünü anında hesaplayın."
            >
              <Button size="sm">Ölçüme başla</Button>
            </PageHero>
          </div>

          <div className="overflow-hidden rounded-md border border-dashed border-border p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              tier=&quot;detail&quot;
            </p>
            <PageHero
              tier="detail"
              heading="Çanakkale"
              badges={
                <Badge variant="outline" size="sm">
                  Marmara Bölgesi
                </Badge>
              }
              lede="İl künyesi, iklim sınıfı ve nüfus göstergeleri; detay kademesi aynı lede biçimini kullanır, farkı yalnızca başlıktadır."
            />
          </div>
        </div>
      </Specimen>
    </>
  );
}
