"use client";

import * as React from "react";
import { magnitudeBucket, magnitudeBucketToken } from "@/lib/earthquake/magnitude";
import {
  Search,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  MapPin,
  Compass,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Flame,
  Globe,
  Settings,
  Heart,
  Share2,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  MoreVertical,
  Maximize2,
  PanelRight,
  PanelLeft,
  PanelBottom,
  Download,
  Filter,
  Check,
  ChevronRight,
  Trash2,
  Info,
  ExternalLink,
  BookOpen,
  Map,
  BarChart3,
  Waves,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
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
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableEmpty,
  TableSkeleton,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarBadge,
  AvatarGroup,
} from "@/components/ui/avatar";
import { toast } from "sonner";

interface SampleEarthquake {
  id: string;
  location: string;
  province: string;
  magnitude: number;
  depth: string;
  time: string;
  status: "verified" | "preliminary" | "critical";
}

const mockEarthquakes: SampleEarthquake[] = [
  {
    id: "EQ-8941",
    location: "Marmara Ereğlisi Açıkları",
    province: "Tekirdağ",
    magnitude: 4.2,
    depth: "11.4 km",
    time: "10 dk önce",
    status: "verified",
  },
  {
    id: "EQ-8940",
    location: "Göksun Merkez",
    province: "Kahramanmaraş",
    magnitude: 3.6,
    depth: "7.2 km",
    time: "28 dk önce",
    status: "verified",
  },
  {
    id: "EQ-8939",
    location: "Sındırgı Kırsalı",
    province: "Balıkesir",
    magnitude: 2.8,
    depth: "5.0 km",
    time: "45 dk önce",
    status: "preliminary",
  },
  {
    id: "EQ-8938",
    location: "Kuşadası Körfezi",
    province: "İzmir",
    magnitude: 5.1,
    depth: "9.8 km",
    time: "1 saat önce",
    status: "critical",
  },
  {
    id: "EQ-8937",
    location: "Pütürge",
    province: "Malatya",
    magnitude: 2.1,
    depth: "6.4 km",
    time: "2 saat önce",
    status: "verified",
  },
];

export default function DesignSystemPage() {
  const [btnLoading, setBtnLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [demoSwitch, setDemoSwitch] = React.useState(true);
  const [demoCheckbox, setDemoCheckbox] = React.useState(true);
  const [tableState, setTableState] = React.useState<"data" | "loading" | "empty">("data");
  const [selectedEarthquakes, setSelectedEarthquakes] = React.useState<string[]>(["EQ-8941"]);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = React.useState(false);
  const [showAlert, setShowAlert] = React.useState(true);

  const toggleSelectAll = () => {
    if (selectedEarthquakes.length === mockEarthquakes.length) {
      setSelectedEarthquakes([]);
    } else {
      setSelectedEarthquakes(mockEarthquakes.map((e) => e.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedEarthquakes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  /**
   * The magnitude ramp is a DATA token set, and both halves of it are owned elsewhere:
   * `magnitudeBucket()` owns the boundaries (<3 · 3–3.9 · 4–4.9 · 5–5.9 · 6+) and
   * `magnitudeBucketToken()` owns the custom-property name, both in
   * `lib/earthquake/magnitude.ts`; the five values live once, in `app/globals.css`'s `:root`.
   * This helper derives from them and holds no copy of either.
   *
   * It replaces a hand-written ladder that duplicated the boundaries WRONGLY (it bucketed on
   * `>= 2/3/4/5`, a full bucket off across the whole range, so all five mock rows below
   * rendered a different colour from the shipped `MagnitudeBadge` on `/deprem`) and carried a
   * ColorBrewer RdYlBu *diverging* fallback hex set — the exact red-orange-yellow hazard
   * convention the ramp's own token block says this sequential ramp must not be mistaken for
   * (`DESIGN.md` §6.1 rule 4, §6.2; `ENGINEERING.md` §10).
   *
   * White text unconditionally, matching `components/earthquake/earthquake.module.css`'s
   * `.badge`: the `globals.css` token block records that white clears 4.5:1 against every
   * bucket, bucket 1 included.
   */
  const magnitudeBadgeStyle = (mag: number): React.CSSProperties => ({
    backgroundColor: `var(${magnitudeBucketToken(magnitudeBucket(mag))})`,
  });

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-14">
        {/* Header & Hero */}
        <header className="border-b border-border pb-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" size="sm" icon={<Sparkles className="size-3" />}>
                  Terra Design System v3.0
                </Badge>
                <Badge variant="outline" size="sm">
                  Tailwind CSS v4 + Radix UI + shadcn/ui
                </Badge>
              </div>
              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)]">
                Coğrafya Tasarım & Bileşen Sistemi
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-3xl mt-2">
                Coğrafya Gurmesi platformunun tüm atomik, moleküler ve organizma seviyesindeki
                arayüz bileşenlerinin interaktif gösterim ve test vitrini.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                leftIcon={<RefreshCw className="size-4" />}
                onClick={() => {
                  toast("Tasarım vitrini tazelendi", {
                    description: "Tüm durumlar ve veriler güncel.",
                  });
                }}
              >
                Yenile
              </Button>
              <Button
                variant="primary"
                leftIcon={<Sliders className="size-4" />}
                onClick={() => {
                  setBtnLoading(true);
                  toast.info("Asenkron test başlatıldı...", {
                    description: "Sistem bileşenleri doğrulanıyor.",
                  });
                  setTimeout(() => {
                    setBtnLoading(false);
                    toast.success("Doğrulama başarılı!", {
                      description: "Tüm UI reaktif durumları sağlıklı çalışıyor.",
                    });
                  }, 1500);
                }}
                isLoading={btnLoading}
              >
                Canlı Test
              </Button>
            </div>
          </div>

          {/* Color Tokens Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="p-3 rounded-xl border border-border bg-card flex flex-col gap-1 shadow-2xs">
              <div className="h-6 w-full rounded-md bg-[var(--color-primary,#b0522e)]" />
              <span className="text-xs font-semibold">Terracotta</span>
              <span className="text-[10px] text-muted-foreground font-mono">#b0522e</span>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card flex flex-col gap-1 shadow-2xs">
              <div className="h-6 w-full rounded-md bg-[var(--color-primary-dark,#7e3a1e)]" />
              <span className="text-xs font-semibold">Primary Dark</span>
              <span className="text-[10px] text-muted-foreground font-mono">#7e3a1e</span>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card flex flex-col gap-1 shadow-2xs">
              <div className="h-6 w-full rounded-md bg-[var(--color-secondary,#4f6d30)]" />
              <span className="text-xs font-semibold">Olive</span>
              <span className="text-[10px] text-muted-foreground font-mono">#4f6d30</span>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card flex flex-col gap-1 shadow-2xs">
              <div className="h-6 w-full rounded-md bg-[var(--color-accent,#276b70)]" />
              <span className="text-xs font-semibold">Water Teal</span>
              <span className="text-[10px] text-muted-foreground font-mono">#276b70</span>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card flex flex-col gap-1 shadow-2xs">
              <div className="h-6 w-full rounded-md bg-[var(--color-surface,#f1e9de)]" />
              <span className="text-xs font-semibold">Stone Surface</span>
              <span className="text-[10px] text-muted-foreground font-mono">#f1e9de</span>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card flex flex-col gap-1 shadow-2xs">
              <div className="h-6 w-full rounded-md bg-[var(--color-bg,#fbf8f3)] border border-border" />
              <span className="text-xs font-semibold">Parchment BG</span>
              <span className="text-[10px] text-muted-foreground font-mono">#fbf8f3</span>
            </div>
          </div>
        </header>

        {/* SECTION 1: MODAL / DIALOG & DRAWER / SHEET */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] flex items-center gap-2">
                <Maximize2 className="size-6 text-primary" />
                1. Modal / Dialog & Drawer / Sheet
              </h2>
              <p className="text-sm text-muted-foreground">
                Backdrop blur efektli, erişilebilir odak tuzaklı diyaloglar ve çok yönlü kayar
                çekmeceler.
              </p>
            </div>
            <Badge variant="outline">Katmanlı UI</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dialog / Modal Showcase */}
            <Card>
              <CardHeader>
                <CardTitle>Dialog / Modal Boyutları</CardTitle>
                <CardDescription>
                  Farklı içerik genişliklerine uygun `sm`, `md`, `lg` ve `xl` diyalog pencereleri.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {/* Small Dialog */}
                <Dialog>
                  <DialogTrigger render={<Button variant="outline" size="sm" />}>
                    Küçük Modal (sm)
                  </DialogTrigger>
                  <DialogContent size="sm">
                    <DialogHeader>
                      <DialogTitle>Önbelleği Temizle</DialogTitle>
                      <DialogDescription>
                        Yerel harita ve katman verilerini sıfırlamak istediğinize emin misiniz?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 text-xs text-muted-foreground">
                      Bu işlem geri alınamaz ve çevrimdışı veriler yeniden indirilir.
                    </div>
                    <DialogFooter>
                      <DialogClose render={<Button variant="ghost" />}>Vazgeç</DialogClose>
                      <Button
                        variant="destructive"
                        onClick={() => toast.success("Önbellek temizlendi")}
                      >
                        Temizle
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Medium Dialog */}
                <Dialog>
                  <DialogTrigger render={<Button variant="primary" />}>
                    Standart Form Modal (md)
                  </DialogTrigger>
                  <DialogContent size="md">
                    <DialogHeader>
                      <DialogTitle>Yeni Gözlem Noktası Ekle</DialogTitle>
                      <DialogDescription>
                        Harita üzerine kaydedilecek yeni koordinat ve detay bilgilerini giriniz.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="dlg-title" required>
                          Nokta Adı
                        </Label>
                        <Input id="dlg-title" placeholder="Örn: Uludağ Zirve İstasyonu" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="dlg-lat">Enlem</Label>
                          <Input id="dlg-lat" placeholder="40.0694" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="dlg-lng">Boylam</Label>
                          <Input id="dlg-lng" placeholder="29.2217" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dlg-type">Gözlem Türü</Label>
                        <Select
                          id="dlg-type"
                          options={[
                            { label: "Meteoroloji İstasyonu", value: "met" },
                            { label: "Sismik Sensör", value: "seismic" },
                            { label: "Su Seviye Ölçeri", value: "water" },
                          ]}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>İptal</DialogClose>
                      <Button
                        variant="primary"
                        onClick={() => {
                          toast.success("Gözlem noktası kaydedildi!", {
                            description: "Yeni istasyon haritaya eklendi.",
                          });
                        }}
                      >
                        Noktayı Kaydet
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Large / Detailed Dialog */}
                <Dialog>
                  <DialogTrigger render={<Button variant="secondary" />}>
                    Geniş Analiz Modal (lg)
                  </DialogTrigger>
                  <DialogContent size="lg">
                    <DialogHeader>
                      <DialogTitle>Türkiye İklim Bölge Raporu</DialogTitle>
                      <DialogDescription>
                        Karasal, Akdeniz ve Karadeniz iklim kuşaklarının aylık sıcaklık/yağış özeti.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                      <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-sm">Yıllık Ortalama Sıcaklık</h4>
                          <p className="text-xs text-muted-foreground">Marmara Havzası Verisi</p>
                        </div>
                        <span className="font-heading text-2xl font-bold text-primary">
                          15.4 °C
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border border-border bg-card text-center">
                          <span className="text-xs text-muted-foreground block">Max Sıcaklık</span>
                          <span className="font-bold text-base text-foreground">38.2 °C</span>
                        </div>
                        <div className="p-3 rounded-lg border border-border bg-card text-center">
                          <span className="text-xs text-muted-foreground block">Min Sıcaklık</span>
                          <span className="font-bold text-base text-foreground">-4.1 °C</span>
                        </div>
                        <div className="p-3 rounded-lg border border-border bg-card text-center">
                          <span className="text-xs text-muted-foreground block">Yıllık Yağış</span>
                          <span className="font-bold text-base text-foreground">690 mm</span>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        leftIcon={<Download className="size-4" />}
                        onClick={() => toast("Rapor PDF olarak indiriliyor...")}
                      >
                        PDF İndir
                      </Button>
                      <DialogClose render={<Button variant="primary" />}>Tamam</DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Sheet / Drawer Showcase */}
            <Card>
              <CardHeader>
                <CardTitle>Drawer / Sheet Panelleri</CardTitle>
                <CardDescription>
                  Mobil menü, harita katmanları ve filtreleme çekmeceleri.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {/* Right Sheet */}
                <Sheet>
                  <SheetTrigger
                    render={
                      <Button variant="outline" leftIcon={<PanelRight className="size-4" />} />
                    }
                  >
                    Sağdan Panel (Filtreler)
                  </SheetTrigger>
                  <SheetContent side="right">
                    <SheetHeader>
                      <SheetTitle>Harita Katman Ayarları</SheetTitle>
                      <SheetDescription>
                        Aktif katmanları, şeffaflığı ve veri kaynaklarını yönetin.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="p-5 space-y-6 flex-1 overflow-y-auto">
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Temel Katmanlar
                        </h4>
                        <Switch
                          id="sh-1"
                          label="Fay Hatları (MTA)"
                          description="Ana kırık hatlarını çizer."
                          defaultChecked
                        />
                        <Switch
                          id="sh-2"
                          label="Göl ve Nehirler"
                          description="İç su kaynakları geometrisi."
                          defaultChecked
                        />
                        <Switch
                          id="sh-3"
                          label="Topografik Rölyef"
                          description="Yükselti gölgelendirmesi."
                        />
                      </div>

                      <div className="space-y-3 border-t border-border pt-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Deprem Büyüklük Eşiği
                        </h4>
                        <Select
                          id="sh-mag"
                          options={[
                            { label: "M 2.0 ve Üzeri", value: "2.0" },
                            { label: "M 3.0 ve Üzeri", value: "3.0" },
                            { label: "M 4.5 ve Üzeri", value: "4.5" },
                          ]}
                        />
                      </div>
                    </div>
                    <SheetFooter>
                      <Button
                        variant="primary"
                        onClick={() => {
                          toast.success("Filtreler haritaya uygulandı");
                        }}
                      >
                        Uygula
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {/* Left Sheet */}
                <Sheet>
                  <SheetTrigger
                    render={
                      <Button variant="outline" leftIcon={<PanelLeft className="size-4" />} />
                    }
                  >
                    Soldan Menü
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle>Platform Gezintisi</SheetTitle>
                      <SheetDescription>Hızlı erişim ve coğrafya modülleri.</SheetDescription>
                    </SheetHeader>
                    <div className="p-5 space-y-2 flex-1">
                      <a
                        href="#table-section"
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted font-medium text-sm"
                      >
                        <Map className="size-4 text-primary" /> Türkiye İller Kataloğu
                      </a>
                      <a
                        href="#table-section"
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted font-medium text-sm"
                      >
                        <Globe className="size-4 text-primary" /> Dünya Ülkeleri Atlası
                      </a>
                      <a
                        href="#table-section"
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted font-medium text-sm"
                      >
                        <Flame className="size-4 text-primary" /> Canlı Deprem Portalı
                      </a>
                      <a
                        href="#table-section"
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted font-medium text-sm"
                      >
                        <Waves className="size-4 text-primary" /> Deniz Durumu & Dalga
                      </a>
                      <a
                        href="#table-section"
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted font-medium text-sm"
                      >
                        <BookOpen className="size-4 text-primary" /> Kitap & Video Çözüm
                      </a>
                    </div>
                    <SheetFooter>
                      <p className="text-xs text-muted-foreground text-center">Coğrafya Gurmesi</p>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {/* Bottom Sheet */}
                <Sheet>
                  <SheetTrigger
                    render={
                      <Button variant="ghost" leftIcon={<PanelBottom className="size-4" />} />
                    }
                  >
                    Alttan Çekmece
                  </SheetTrigger>
                  <SheetContent side="bottom">
                    <SheetHeader>
                      <SheetTitle>Mobil Detay Paneli</SheetTitle>
                      <SheetDescription>Seçili lokasyon hakkında özet bilgiler.</SheetDescription>
                    </SheetHeader>
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                        <span className="text-xs text-muted-foreground block">Rakım</span>
                        <span className="font-bold text-lg">1.120 m</span>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                        <span className="text-xs text-muted-foreground block">Hava Kalitesi</span>
                        <span className="font-bold text-lg text-emerald-600">İyi (PM2.5: 8)</span>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                        <span className="text-xs text-muted-foreground block">Rüzgar</span>
                        <span className="font-bold text-lg">14 km/s KB</span>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                        <span className="text-xs text-muted-foreground block">Son Deprem</span>
                        <span className="font-bold text-lg">M 2.4 (3g)</span>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 2: DATA TABLE / LIST */}
        <section id="table-section" className="space-y-6">
          <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] flex items-center gap-2">
                <BarChart3 className="size-6 text-primary" />
                2. Table & Data List (Veri Tablosu)
              </h2>
              <p className="text-sm text-muted-foreground">
                Hover efektli satırlar, durum badge&apos;leri, satır bazlı aksiyon menüsü, skeleton
                loading ve empty state.
              </p>
            </div>

            {/* Table State Switcher */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-muted border border-border">
              <Button
                variant={tableState === "data" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setTableState("data")}
              >
                Normal Veri ({mockEarthquakes.length})
              </Button>
              <Button
                variant={tableState === "loading" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setTableState("loading")}
              >
                Skeleton Yükleme
              </Button>
              <Button
                variant={tableState === "empty" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setTableState("empty")}
              >
                Boş Durum
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-eq"
                  checked={selectedEarthquakes.length === mockEarthquakes.length}
                  indeterminate={
                    selectedEarthquakes.length > 0 &&
                    selectedEarthquakes.length < mockEarthquakes.length
                  }
                  onChange={toggleSelectAll}
                  label={`${selectedEarthquakes.length} kayıt seçildi`}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="size-3.5" />}
                  onClick={() => toast.success("Seçili kayıtlar CSV olarak aktarıldı")}
                  disabled={selectedEarthquakes.length === 0}
                >
                  Dışa Aktar
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Büyüklük</TableHead>
                  <TableHead>Konum / Merkezüssü</TableHead>
                  <TableHead>İl / Bölge</TableHead>
                  <TableHead>Derinlik</TableHead>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Doğrulama</TableHead>
                  <TableHead className="w-16 text-right">Eylemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableState === "loading" ? (
                  <TableSkeleton colSpan={8} rowCount={5} />
                ) : tableState === "empty" ? (
                  <TableEmpty
                    colSpan={8}
                    title="Seçili Filtrede Deprem Bulunamadı"
                    description="Son 24 saatte belirlenen parametrelere uyan sismik aktivite kaydedilmedi."
                    action={
                      <Button variant="outline" size="sm" onClick={() => setTableState("data")}>
                        Filtreleri Sıfırla
                      </Button>
                    }
                  />
                ) : (
                  mockEarthquakes.map((eq) => {
                    const isSelected = selectedEarthquakes.includes(eq.id);
                    return (
                      <TableRow
                        key={eq.id}
                        data-state={isSelected ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => toggleSelect(eq.id)}
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelect(eq.id)}
                            aria-label={`Seç ${eq.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-md text-xs shadow-2xs text-white"
                            style={magnitudeBadgeStyle(eq.magnitude)}
                          >
                            M {eq.magnitude.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {eq.location}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{eq.province}</TableCell>
                        <TableCell>{eq.depth}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{eq.time}</TableCell>
                        <TableCell>
                          {eq.status === "verified" ? (
                            <Badge variant="success" size="sm" dot>
                              Çözümlendi
                            </Badge>
                          ) : eq.status === "critical" ? (
                            <Badge
                              variant="destructive"
                              size="sm"
                              dot
                              icon={<Flame className="size-3" />}
                            >
                              Kritik
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm" dot>
                              Ön Değerlendirme
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Aksiyon menüsü"
                                />
                              }
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => toast.info(`${eq.location} haritada açılıyor...`)}
                              >
                                <Compass className="size-4 mr-2" /> Haritada Odakla
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toast.success(`${eq.location} favorilere eklendi.`)}
                              >
                                <Heart className="size-4 mr-2" /> Takibe Al
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toast("Bağlantı kopyalandı", {
                                    description: `${eq.location} için paylaşım linki panoya alındı.`,
                                  })
                                }
                              >
                                <Share2 className="size-4 mr-2" /> Paylaş
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => toast.error(`${eq.id} listeden gizlendi.`)}
                              >
                                <Trash2 className="size-4 mr-2" /> Listeden Gizle
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* SECTION 3: CARDS & SURFACE HIERARCHY */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] flex items-center gap-2">
                <Layers className="size-6 text-primary" />
                3. Cards & Surface Grid (Kart Sistemleri)
              </h2>
              <p className="text-sm text-muted-foreground">
                Header, title, description, content ve footer bileşenleriyle yapılandırılmış temiz
                kart hiyerarşisi.
              </p>
            </div>
            <Badge variant="secondary">3 Farklı Tip</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Province Card */}
            <Card className="hover:border-primary/50 transition-all duration-200 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="secondary" size="sm">
                    Marmara Bölgesi
                  </Badge>
                  <span className="text-xs font-bold text-muted-foreground font-mono">TR-16</span>
                </div>
                <CardTitle className="text-xl">Bursa</CardTitle>
                <CardDescription>Yeşil Bursa · Sanayi & Tarih Merkezi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Nüfus</span>
                    <span className="font-bold text-foreground">3.214.571</span>
                  </div>
                  <div className="p-2 rounded bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Yüzölçümü</span>
                    <span className="font-bold text-foreground">10.813 km²</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Uludağ kış turizmi ve otomotiv sanayisi ile Marmara havzasının önde gelen
                  merkezlerinden biri.
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3.5 text-primary" /> 17 İlçe
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ChevronRight className="size-3.5" />}
                  onClick={() => toast.info("İl detay sayfasına yönlendiriliyor...")}
                >
                  İncele
                </Button>
              </CardFooter>
            </Card>

            {/* Country Card */}
            <Card className="hover:border-primary/50 transition-all duration-200 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" size="sm">
                    Güney Avrupa
                  </Badge>
                  <span className="text-xs font-bold text-muted-foreground font-mono">ISO: IT</span>
                </div>
                <CardTitle className="text-xl">İtalya</CardTitle>
                <CardDescription>İtalya Cumhuriyeti · Roma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Başkent</span>
                    <span className="font-bold text-foreground">Roma</span>
                  </div>
                  <div className="p-2 rounded bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Para Birimi</span>
                    <span className="font-bold text-foreground">Euro (€)</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Akdeniz havzası çizme yarımadası, Alpler ve zengin kültürel miras merkezleri.
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="size-3.5 text-primary" /> 20 Bölge
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ChevronRight className="size-3.5" />}
                  onClick={() => toast.info("Ülke atlasına yönlendiriliyor...")}
                >
                  Atlas
                </Button>
              </CardFooter>
            </Card>

            {/* Live Station Card */}
            <Card className="border-primary/30 bg-card hover:shadow-md transition-all duration-200">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="success" size="sm" dot>
                    Canlı İstasyon
                  </Badge>
                  <span className="text-xs text-muted-foreground">08:45 Güncel</span>
                </div>
                <CardTitle className="text-xl">Çanakkale Boğazı</CardTitle>
                <CardDescription>Copernicus Marine Deniz Gözlemi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Su Sıcaklığı</span>
                    <span className="font-bold text-base text-primary">23.4 °C</span>
                  </div>
                  <div className="p-2 rounded bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Dalga Yüksekliği</span>
                    <span className="font-bold text-base text-foreground">0.6 m</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Radio className="size-3.5 text-emerald-600 animate-pulse" />
                  ECMWF Open Data telemetrisi bağlı.
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast("Grafikler yenileniyor...")}
                >
                  Tazele
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ExternalLink className="size-3.5" />}
                  onClick={() => toast.info("Tüm deniz durumu sayfasına gidiliyor...")}
                >
                  Denizler
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* SECTION 4: TOAST & ALERT NOTIFICATIONS */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] flex items-center gap-2">
                <AlertCircle className="size-6 text-primary" />
                4. Toast & Alert Notifications (Bildirimler)
              </h2>
              <p className="text-sm text-muted-foreground">
                Sayfa içi uyarı kutuları (Alert) ve anlık açılan köşe bildirimleri (Sonner Toast).
              </p>
            </div>
            <Badge variant="outline">Geri Bildirim</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Toast Triggers Card */}
            <Card>
              <CardHeader>
                <CardTitle>Sonner Toast Tetikleyicileri</CardTitle>
                <CardDescription>
                  Farklı bildirim türleri ve zengin eylem destekli toast&apos;lar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="primary"
                    onClick={() =>
                      toast.success("Ölçüm Kaydedildi!", {
                        description: "Kuş uçuşu mesafe listenize başarıyla eklendi.",
                      })
                    }
                  >
                    Başarılı Toast
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      toast.error("Bağlantı Hatası!", {
                        description: "Sismik veri sunucusuna ulaşılamadı. Tekrar deneyin.",
                      })
                    }
                  >
                    Hatalı Toast
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      toast.warning("Yetki Uyarısı", {
                        description: "Bu işlemi gerçekleştirmek için üye girişi yapmalısınız.",
                      })
                    }
                  >
                    Uyarı Toast
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.info("Yeni Veri Mevcut", {
                        description: "Copernicus atmosfer modeli saatlik güncellemesi geldi.",
                      })
                    }
                  >
                    Bilgi Toast
                  </Button>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const promise = new Promise<{ name: string }>((resolve) =>
                        setTimeout(() => resolve({ name: "Türkiye Haritası" }), 2000),
                      );
                      toast.promise(promise, {
                        loading: "Vektör harita yolları derleniyor...",
                        success: (data: { name: string }) =>
                          `${data.name} başarıyla render edildi!`,
                        error: "Harita yüklenemedi.",
                      });
                    }}
                  >
                    Promise / Async Yükleme Toast&apos;ı
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Inline Alerts Card */}
            <Card>
              <CardHeader>
                <CardTitle>Sayfa İçi Alert Kutuları</CardTitle>
                <CardDescription>
                  Kullanıcıya önemli durumları bildiren statik veya kapatılabilir mesaj blokları.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {showAlert && (
                  <Alert
                    variant="warning"
                    onDismiss={() => {
                      setShowAlert(false);
                      toast("Uyarı gizlendi");
                    }}
                  >
                    <AlertTitle>Canlı Veri Gecikmesi</AlertTitle>
                    <AlertDescription>
                      Copernicus uydu geçişinde yaşanan gecikme nedeniyle hava kalitesi verileri 15
                      dakika rötarlıdır.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert variant="success">
                  <AlertTitle>Sistem Güncel</AlertTitle>
                  <AlertDescription>
                    AFAD ve Kandilli rasathanesi veri entegrasyonu kesintisiz çalışmaktadır.
                  </AlertDescription>
                </Alert>

                <Alert variant="destructive">
                  <AlertTitle>Sismik Aktivite Uyarısı</AlertTitle>
                  <AlertDescription>
                    Ege Denizi açıklarında M 5.0 üzeri sarsıntı kaydedildi.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 5: TABS & AVATAR ECOSYSTEM */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[var(--color-primary-dark,#7e3a1e)] flex items-center gap-2">
                <BookOpen className="size-6 text-primary" />
                5. Tabs & Avatar (Sekmeler ve Profil)
              </h2>
              <p className="text-sm text-muted-foreground">
                Radix tabanlı erişilebilir sekmeler ve çevrimiçi durum göstergeli avatar
                koleksiyonu.
              </p>
            </div>
            <Badge variant="outline">Gezinti & Kullanıcı</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tabs Example */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Etkileşimli Sekme Yapısı (Tabs)</CardTitle>
                  <CardDescription>
                    Bölge ve içerik detayları için modüler sekmeler.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview">
                    <TabsList className="w-full justify-start overflow-x-auto">
                      <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                      <TabsTrigger value="geo">Fiziki Coğrafya</TabsTrigger>
                      <TabsTrigger value="climate">İklim & Bitki</TabsTrigger>
                      <TabsTrigger value="economy">Ekonomi & Sanayi</TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="overview"
                      className="p-4 rounded-xl bg-muted/20 border border-border mt-3 space-y-2"
                    >
                      <h4 className="font-heading font-semibold text-base">İç Anadolu Bölgesi</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Türkiye&apos;nin merkezinde yer alan bölge, yüksek platolar ve etrafını
                        çevreleyen sıradağlar ile karasal iklimin en belirgin yaşandığı coğrafi
                        alandır.
                      </p>
                    </TabsContent>
                    <TabsContent
                      value="geo"
                      className="p-4 rounded-xl bg-muted/20 border border-border mt-3 space-y-2"
                    >
                      <h4 className="font-heading font-semibold text-base">Yeryüzü Şekilleri</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Tuz Gölü havzası, Erciyes ve Hasan Dağı volkanik kütleleri ve Kızılırmak yay
                        çizerek Karadeniz&apos;e dökülür.
                      </p>
                    </TabsContent>
                    <TabsContent
                      value="climate"
                      className="p-4 rounded-xl bg-muted/20 border border-border mt-3 space-y-2"
                    >
                      <h4 className="font-heading font-semibold text-base">Bozkır İklimi (Step)</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Yazları sıcak ve kurak, kışları soğuk ve kar yağışlıdır. En fazla yağış
                        ilkbaharda konveksiyonel (kırkikindi) olarak düşer.
                      </p>
                    </TabsContent>
                    <TabsContent
                      value="economy"
                      className="p-4 rounded-xl bg-muted/20 border border-border mt-3 space-y-2"
                    >
                      <h4 className="font-heading font-semibold text-base">Tahıl Ambarı</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Konya Ovası buğday ve şeker pancarı üretiminde Türkiye&apos;nin öncüsüdür.
                        Savunma sanayisi ve havacılık Ankara&apos;da yoğunlaşmıştır.
                      </p>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Avatar & User Profile */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Kullanıcı Avatarları</CardTitle>
                  <CardDescription>Boyutlar ve canlı durum göstergeleri</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar size="lg">
                        <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                          ST
                        </AvatarFallback>
                        <AvatarBadge className="bg-emerald-500" />
                      </Avatar>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Serttürk Hoca</h4>
                      <p className="text-xs text-muted-foreground">Baş Coğrafya Editörü</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Avatar Boyutları & Grup
                    </span>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>SM</AvatarFallback>
                      </Avatar>
                      <Avatar size="default">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          MD
                        </AvatarFallback>
                      </Avatar>
                      <Avatar size="lg">
                        <AvatarFallback className="bg-[var(--color-primary-dark,#7e3a1e)] text-white">
                          LG
                        </AvatarFallback>
                      </Avatar>
                      <AvatarGroup>
                        <Avatar size="sm">
                          <AvatarFallback className="bg-primary text-white">A</AvatarFallback>
                        </Avatar>
                        <Avatar size="sm">
                          <AvatarFallback className="bg-secondary text-white">B</AvatarFallback>
                        </Avatar>
                        <Avatar size="sm">
                          <AvatarFallback className="bg-accent text-white">C</AvatarFallback>
                        </Avatar>
                      </AvatarGroup>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
