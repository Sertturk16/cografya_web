import { Separator } from "@/components/ui/separator";
import { Specimen } from "../specimen";

/**
 * Every swatch reads a BRIDGE token through a Tailwind class — never a hex, never a
 * `var(--color-*, #fallback)` escape. That is the point of the page: if a swatch looks
 * wrong in the dark panel, the token is wrong, not the swatch.
 */
const SURFACES = [
  { name: "background", className: "bg-background", note: "Sayfa zemini" },
  { name: "card", className: "bg-card", note: "Kart ve panel" },
  { name: "muted", className: "bg-muted", note: "İkincil yüzey" },
  { name: "border", className: "bg-border", note: "Kenarlık" },
] as const;

const BRAND = [
  { name: "primary", className: "bg-primary", fg: "text-primary-foreground" },
  { name: "secondary", className: "bg-secondary", fg: "text-secondary-foreground" },
  { name: "accent", className: "bg-accent", fg: "text-accent-foreground" },
  { name: "destructive", className: "bg-destructive", fg: "text-white" },
] as const;

const TEXT = [
  { name: "foreground", className: "text-foreground" },
  { name: "muted-foreground", className: "text-muted-foreground" },
  { name: "primary", className: "text-primary" },
] as const;

function Swatch({
  label,
  note,
  className,
  fg,
}: {
  readonly label: string;
  readonly note?: string;
  readonly className: string;
  readonly fg?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className={`flex h-16 items-end rounded-lg border border-border p-2 ${className} ${fg ?? ""}`}
      >
        <span className="text-[11px] font-bold">{label}</span>
      </div>
      {note !== undefined ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function TemellerSpecimens() {
  return (
    <>
      <Specimen
        name="Yüzey token'ları"
        description="Sağdaki panel .dark sarmalayıcısının içinde. Buradaki her kutu bir köprü token'ı okuyor; iki panel arasındaki fark tam olarak .dark bloğunun yaptığı şeydir."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SURFACES.map((s) => (
            <Swatch key={s.name} label={s.name} note={s.note} className={s.className} />
          ))}
        </div>
      </Specimen>

      <Specimen name="Marka token'ları">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BRAND.map((s) => (
            <Swatch key={s.name} label={s.name} className={s.className} fg={s.fg} />
          ))}
        </div>
      </Specimen>

      <Specimen name="Metin token'ları">
        <div className="space-y-2">
          {TEXT.map((t) => (
            <p key={t.name} className={`text-sm font-semibold ${t.className}`}>
              {t.name} — Coğrafya, yeryüzünü ve insanın onunla ilişkisini inceler.
            </p>
          ))}
        </div>
      </Specimen>

      <Specimen
        name="Separator"
        description="24 V2 dosyası bunu elle `border-t border-border` olarak çiziyordu. Anlam taşımayan ayırıcılar decorative alır; taşıyanlar role=separator ile duyurulur."
      >
        <div className="max-w-sm space-y-4">
          <p className="text-sm text-foreground">Yatay, anlamlı</p>
          <Separator />
          <p className="text-sm text-foreground">Yatay, dekoratif</p>
          <Separator decorative />
          <div className="flex h-10 items-center gap-3 text-sm text-foreground">
            <span>Marmara</span>
            <Separator orientation="vertical" />
            <span>Ege</span>
            <Separator orientation="vertical" />
            <span>Akdeniz</span>
          </div>
        </div>
      </Specimen>

      <Specimen
        name="Tipografi ölçeği"
        description="Başlıklar Fraunces, gövde Nunito Sans. h1 alt sınırı 1.9rem ve docs/design.md'ye göre hiçbir yerde düşürülmez."
      >
        <div className="space-y-3">
          <h1 className="font-heading text-[clamp(1.9rem,1.2rem+2.6vw,2.6rem)] font-bold leading-tight text-foreground">
            h1 — Türkiye&apos;nin coğrafyası
          </h1>
          <h2 className="font-heading text-[clamp(1.4rem,1rem+1.4vw,1.8rem)] font-semibold text-primary">
            h2 — Coğrafi bölgeler
          </h2>
          <h3 className="font-heading text-xl font-bold text-foreground">h3 — Marmara Bölgesi</h3>
          <p className="max-w-prose text-foreground">
            Gövde metni 16px ve 1.6 satır yüksekliğinde. Uzun bir paragraf okunurken satır
            uzunluğunun 60-75 karakteri aşmaması hedeflenir.
          </p>
          <p className="text-sm text-muted-foreground">
            Küçük metin — kaynak künyesi, yardımcı açıklama.
          </p>
        </div>
      </Specimen>
    </>
  );
}
