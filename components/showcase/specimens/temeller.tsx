import { H1, H2, H3, H4, Lede, Muted, Kbd } from "@/components/patterns/typography";
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
  { name: "destructive", className: "bg-destructive", fg: "text-destructive-foreground" },
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
        name="Tipografi ölçeği"
        description="docs/design.md ölçeğin sahibi; bu bileşenler onu yeniden üretiyor, yenisini icat etmiyor. h1'in 1.9rem alt sınırı hiçbir genişlikte düşürülmez — bir düzeltme turu bunu bir kez düşürmüş ve o düşürme bir sonraki incelemenin yakaladığı kusur olmuştu."
      >
        <div className="space-y-3">
          <H1>Türkiye&apos;nin coğrafyası</H1>
          <H2>Coğrafi bölgeler</H2>
          <H3>Marmara Bölgesi</H3>
          <H4>İklim özellikleri</H4>
          <Lede>
            Gövde metni 16px ve 1.6 satır yüksekliğinde; lede max-w-prose ile sınırlı, çünkü
            masaüstü genişliğinde tam satır uzunluğu iyi metni bile okunmaz yapar.
          </Lede>
          <Muted>Küçük metin — kaynak künyesi, yardımcı açıklama.</Muted>
        </div>
      </Specimen>

      <Specimen
        name="Kbd"
        description="Ctrl+K ipucunu 3 V2 dosyası elle çiziyordu. <kbd> doğru eleman ve anlamı kendi taşıyor."
      >
        <p className="text-sm text-foreground">
          Aramayı açmak için <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> tuşlayın.
        </p>
      </Specimen>
    </>
  );
}
