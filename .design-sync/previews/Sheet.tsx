import {
  Button,
  Label,
  Select,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "cografya_web";

export const Filters = () => (
  <Sheet defaultOpen>
    <SheetTrigger render={<Button variant="outline">Filtreler</Button>} />
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Katman ayarları</SheetTitle>
        <SheetDescription>Haritada hangi katmanların görüneceğini seç.</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-2">
        <div className="space-y-3">
          {["İl sınırları", "Göller ve barajlar", "Fay hatları"].map((label) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">{label}</span>
              <span className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-bold text-foreground">
                Açık
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-border pt-5">
          <Label htmlFor="ds-sheet-mag" className="text-xs font-bold">
            En düşük büyüklük
          </Label>
          <Select id="ds-sheet-mag" defaultValue="4">
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
);
