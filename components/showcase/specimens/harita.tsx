import { MapAttribution } from "@/components/patterns/map-attribution";
import { Specimen } from "../specimen";

/**
 * ONE specimen since T-042. `MapLegend` was deleted with `Callout` and `EmptyState`: all three
 * were reachable only from this route, and a component the design system maintains for the
 * design system's sake costs the same review, token audit and dark-mode sweep as one that ships
 * (`components/ui/orphan.test.ts`). The data-token rule its two specimens illustrated —
 * `docs/design.md`'s brand != data — is stated there and enforced by the data-viz suite, not by
 * a swatch nobody renders.
 *
 * `MapAttribution` is the opposite case and is why this category survives: the same T-042 move
 * replaced the orphan of that name with the component TEN live map surfaces render, so the
 * specimen now shows the real thing, per layer.
 */
export function HaritaSpecimens() {
  return (
    <>
      <Specimen
        name="MapAttribution"
        description="Bu bir stil kuralı değil, lisans uyumu. docs/design.md her haritanın yanında atıf istiyor ve V1'in turkey-map-section'ı taşıyordu; ölçüldü, V2'nin YEDİ harita bileşeninin hiçbirinde yoktu. ODbL türev veritabanı veya üretilmiş eser için atıf şart koşuyor. Belge akışında gerçek bir paragraf — ekran görüntüsünde, baskıda ve haritanın üzerine hiç gelmeyen okurda da duruyor. Katman başına açılır: yüzey neyi çiziyorsa onu, ne eksik ne fazla."
      >
        <div className="max-w-md space-y-3">
          <div className="flex h-24 items-center justify-center rounded-xl border border-border bg-muted text-xs text-muted-foreground">
            harita
          </div>
          <MapAttribution />
          <MapAttribution inlandWater context />
          <MapAttribution boundaries={false} world />
        </div>
      </Specimen>
    </>
  );
}
