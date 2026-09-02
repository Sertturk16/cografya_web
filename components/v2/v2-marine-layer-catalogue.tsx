import type { MarineLayer } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Layers, Database, Compass, Wind, Waves, Thermometer, CheckCircle2 } from "lucide-react";

interface V2MarineLayerCatalogueProps {
  layers: MarineLayer[];
}

const LAYER_ICONS: Record<string, React.ReactNode> = {
  sea_surface_temperature: <Thermometer className="size-4 text-rose-500" />,
  wave_height: <Waves className="size-4 text-cyan-600" />,
  wave_direction: <Compass className="size-4 text-indigo-500" />,
  wind_speed_10m: <Wind className="size-4 text-teal-600" />,
  wind_direction_10m: <Compass className="size-4 text-teal-500" />,
};

const LAYER_TITLES_TR: Record<string, string> = {
  sea_surface_temperature: "Deniz Suyu Sıcaklığı (SST)",
  wave_height: "Belirgin Dalga Yüksekliği (Hs)",
  wave_direction: "Dalga Geliş Yönü",
  wind_speed_10m: "10 Metre Rüzgâr Hızı",
  wind_direction_10m: "10 Metre Rüzgâr Yönü",
};

const LAYER_UNITS_TR: Record<string, string> = {
  sea_surface_temperature: "°C (Santigrat)",
  wave_height: "m (Metre)",
  wave_direction: "Derece (° / Gerçek Kuzey)",
  wind_speed_10m: "m/s & km/h",
  wind_direction_10m: "Derece (° / Geldiği Yön)",
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
      horizon: "10 Günlük Tahmin",
    },
    {
      id: "wave_height",
      calmThreshold: "0.1 m",
      cycle: "Günde 2 kez (00:00, 12:00 UTC)",
      horizon: "10 Günlük Tahmin",
    },
    {
      id: "wave_direction",
      calmThreshold: "— (Dalga < 0.1m iken Sakin)",
      cycle: "Günde 2 kez (00:00, 12:00 UTC)",
      horizon: "10 Günlük Tahmin",
    },
    {
      id: "wind_speed_10m",
      calmThreshold: "0.5 m/s (~1.8 km/h)",
      cycle: "Günde 4 kez (00, 06, 12, 18 UTC)",
      horizon: "10 Günlük Tahmin",
    },
    {
      id: "wind_direction_10m",
      calmThreshold: "— (Rüzgâr < 0.5m/s iken Sakin)",
      cycle: "Günde 4 kez (00, 06, 12, 18 UTC)",
      horizon: "10 Günlük Tahmin",
    },
  ];

  return (
    <section className="space-y-6" aria-labelledby="v2-marine-catalogue-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Layers className="size-3.5" />}>
              Oşinografi Ölçüm Kataloğu
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">Model Parametreleri &amp; Künye</span>
          </div>
          <h2 id="v2-marine-catalogue-heading" className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
            Ölçülen Büyüklükler, Birimler ve Model Çevrimleri
          </h2>
        </div>
        <Badge variant="secondary" size="sm" icon={<Database className="size-3.5" />}>
          Copernicus &amp; ECMWF
        </Badge>
      </div>

      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-heading font-bold text-xs">Fiziksel Büyüklük</TableHead>
              <TableHead className="font-heading font-bold text-xs">Birim</TableHead>
              <TableHead className="font-heading font-bold text-xs">Sakin Eşiği</TableHead>
              <TableHead className="font-heading font-bold text-xs">Veri Kaynağı</TableHead>
              <TableHead className="font-heading font-bold text-xs">Model Çevrimi &amp; Ufuk</TableHead>
              <TableHead className="font-heading font-bold text-xs text-right">Durum</TableHead>
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
                    <span className="block text-[10px] text-muted-foreground/80">{layer.horizon}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" size="sm" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                    <CheckCircle2 className="size-2.5 mr-1 text-emerald-600" />
                    Yayında
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
