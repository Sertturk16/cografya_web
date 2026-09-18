import { MapAttribution } from "@/components/patterns/map-attribution";
import { MapLegend } from "@/components/patterns/map-legend";
import { Specimen } from "../specimen";

/**
 * The swatch colours below are read from the DATA token sets in `app/globals.css`
 * (`--eq-mag-*`, `--region-*`) rather than from chrome tokens, which is the point:
 * `docs/design.md`'s first data-viz rule is brand != data. Those sets are deliberately not
 * redefined under `.dark`, so both panels show the same scale — the map they describe does
 * not follow the theme either.
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

      <Specimen
        name="MapLegend — sınıflı"
        description="bins ZORUNLU. docs/design.md veri-görselleştirme kuralı 5: sınıflı haritalar sınırlarını belirtir. Sınırsız bir rampa okura yalnızca 'koyu daha çok' der; haritadan bir değer okuyamaz, oysa harita bunun için var. Zorunlu prop, etiketsiz bir sınıflı lejantın kurulamamasını sağlıyor."
      >
        <MapLegend
          className="max-w-xs"
          variant="classed"
          title="Deprem magnitüdü"
          bins={[
            { color: "var(--eq-mag-1)", from: 0, to: 2.9 },
            { color: "var(--eq-mag-2)", from: 3, to: 3.9 },
            { color: "var(--eq-mag-3)", from: 4, to: 4.9 },
            { color: "var(--eq-mag-4)", from: 5, to: 5.9 },
            { color: "var(--eq-mag-5)", from: 6, to: null },
          ]}
        />
      </Specimen>

      <Specimen
        name="MapLegend — kategorik"
        description="Yedi bölge tinti Okabe-Ito paletinden; renk körlüğü altında ayrılabilirlik için seçilmiş ve beyaz kara üzerinde ölçülmüş. Swatch'lar kenarlık taşır: bu ölçeklerin bazılarında soluk üye var ve soluk bir kare soluk bir kartta kenarlıksız görünmez."
      >
        <MapLegend
          className="max-w-md"
          variant="categorical"
          title="Coğrafi bölgeler"
          categories={[
            { color: "var(--region-marmara)", label: "Marmara" },
            { color: "var(--region-ege)", label: "Ege" },
            { color: "var(--region-akdeniz)", label: "Akdeniz" },
            { color: "var(--region-ic-anadolu)", label: "İç Anadolu" },
            { color: "var(--region-karadeniz)", label: "Karadeniz" },
            { color: "var(--region-dogu-anadolu)", label: "Doğu Anadolu" },
            { color: "var(--region-guneydogu-anadolu)", label: "Güneydoğu Anadolu" },
          ]}
        />
      </Specimen>
    </>
  );
}
