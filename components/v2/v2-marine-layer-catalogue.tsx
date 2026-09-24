import type { MarineLayer } from "@/lib/api/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Compass, Wind, Waves, Thermometer } from "lucide-react";

interface V2MarineLayerCatalogueProps {
  layers: MarineLayer[];
}

const LAYER_ICONS: Record<string, React.ReactNode> = {
  sea_surface_temperature: <Thermometer className="size-4" />,
  wave_height: <Waves className="size-4" />,
  wave_direction: <Compass className="size-4" />,
  wind_speed_10m: <Wind className="size-4" />,
  wind_direction_10m: <Compass className="size-4" />,
};

const LAYER_TITLES_TR: Record<string, string> = {
  sea_surface_temperature: "Deniz Suyu Sıcaklığı",
  wave_height: "Belirgin Dalga Yüksekliği",
  wave_direction: "Dalga Geliş Yönü",
  wind_speed_10m: "10 Metrede Rüzgâr Hızı",
  wind_direction_10m: "10 Metrede Rüzgâr Yönü",
};

const LAYER_UNITS_TR: Record<string, string> = {
  sea_surface_temperature: "°C",
  wave_height: "metre",
  wave_direction: "Derece, gerçek kuzeyden",
  wind_speed_10m: "m/s ve km/h",
  wind_direction_10m: "Derece, geldiği yön",
};

const LAYER_SOURCES_TR: Record<string, string> = {
  sea_surface_temperature: "Copernicus Marine (CMEMS)",
  wave_height: "CMEMS / ECMWF Open Data",
  wave_direction: "CMEMS / ECMWF Open Data",
  wind_speed_10m: "ECMWF Open Data",
  wind_direction_10m: "ECMWF Open Data",
};

export function V2MarineLayerCatalogue({ layers: _layers }: V2MarineLayerCatalogueProps) {
  void _layers;
  const layerList = [
    {
      id: "sea_surface_temperature",
      calmThreshold: "—",
      cycle: "Günde 1-2 kez (12:00 / 16:00 UTC)",
      horizon: "10 günlük tahmin",
    },
    {
      id: "wave_height",
      calmThreshold: "0,1 m",
      cycle: "Günde 2 kez (00:00, 12:00 UTC)",
      horizon: "10 günlük tahmin",
    },
    {
      id: "wave_direction",
      calmThreshold: "Dalga 0,1 m altındaysa sakin",
      cycle: "Günde 2 kez (00:00, 12:00 UTC)",
      horizon: "10 günlük tahmin",
    },
    {
      id: "wind_speed_10m",
      calmThreshold: "0,5 m/s (~1,8 km/h)",
      cycle: "Günde 4 kez (00, 06, 12, 18 UTC)",
      horizon: "10 günlük tahmin",
    },
    {
      id: "wind_direction_10m",
      calmThreshold: "Rüzgâr 0,5 m/s altındaysa sakin",
      cycle: "Günde 4 kez (00, 06, 12, 18 UTC)",
      horizon: "10 günlük tahmin",
    },
  ];

  return (
    <section className="space-y-6" aria-labelledby="v2-marine-catalogue-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <h2
            id="v2-marine-catalogue-heading"
            className="font-heading text-2xl sm:text-3xl font-bold text-foreground"
          >
            Ölçüm Kataloğu
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Sayfadaki her değerin birimi, hangi modelden geldiği ve kaynağın onu günde kaç kez
            yenilediği.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-heading font-bold text-xs">Değer</TableHead>
              <TableHead className="font-heading font-bold text-xs">Birim</TableHead>
              <TableHead className="font-heading font-bold text-xs">Sakin Eşiği</TableHead>
              <TableHead className="font-heading font-bold text-xs">Kaynak</TableHead>
              <TableHead className="font-heading font-bold text-xs">Yenilenme</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {layerList.map((layer) => (
              <TableRow key={layer.id} className="hover:bg-muted/20 transition-colors">
                <TableCell className="font-medium text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-muted/60 text-foreground shrink-0">
                      {LAYER_ICONS[layer.id]}
                    </span>
                    <span className="font-semibold text-foreground">
                      {LAYER_TITLES_TR[layer.id]}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {LAYER_UNITS_TR[layer.id]}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {layer.calmThreshold}
                </TableCell>
                <TableCell className="text-xs text-foreground font-medium">
                  {LAYER_SOURCES_TR[layer.id]}
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  <div>
                    <span className="text-foreground font-medium">{layer.cycle}</span>
                    <span className="block text-[10px] text-muted-foreground/80">
                      {layer.horizon}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
