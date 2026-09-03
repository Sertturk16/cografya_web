"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Flame, Waves, MapPin, Clock, Layers } from "lucide-react";

interface EarthquakeTickerData {
  readonly magnitude: number;
  readonly location: string;
  readonly timeAgo: string;
}

interface MarineTickerData {
  readonly sst: number;
  readonly wave: number;
}

export function V2LiveTicker() {
  const [earthquake, setEarthquake] = React.useState<EarthquakeTickerData | null>(null);
  const [marmara, setMarmara] = React.useState<MarineTickerData | null>(null);
  const [akdeniz, setAkdeniz] = React.useState<MarineTickerData | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadTelemetry() {
      try {
        const [eqResult, marineResult] = await Promise.allSettled([
          fetch("/api/earthquakes?pageSize=1", { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/marine/overview", { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        if (!active) return;

        if (eqResult.status === "fulfilled" && eqResult.value?.items?.[0]) {
          const item = eqResult.value.items[0];
          const diffMinutes = Math.max(
            1,
            Math.round((Date.now() - new Date(item.occurredAtUtc).getTime()) / 60000),
          );
          const timeAgo =
            diffMinutes < 60 ? `${diffMinutes} dk önce` : `${Math.round(diffMinutes / 60)} sa önce`;
          setEarthquake({
            magnitude: item.magnitude,
            location: item.location,
            timeAgo,
          });
        }

        if (marineResult.status === "fulfilled" && Array.isArray(marineResult.value?.points)) {
          const points: Array<{
            point?: { basin?: string; nameTr?: string };
            seaSurfaceTemperature?: { value?: number };
            waveHeight?: { value?: number };
          }> = marineResult.value.points;

          const marmaraPt = points.find((p) => p.point?.basin === "marmara");
          if (marmaraPt && typeof marmaraPt.seaSurfaceTemperature?.value === "number") {
            setMarmara({
              sst: Number(marmaraPt.seaSurfaceTemperature.value.toFixed(1)),
              wave: Number((marmaraPt.waveHeight?.value ?? 0).toFixed(1)),
            });
          }

          const akdenizPt = points.find((p) => p.point?.basin === "akdeniz");
          if (akdenizPt && typeof akdenizPt.seaSurfaceTemperature?.value === "number") {
            setAkdeniz({
              sst: Number(akdenizPt.seaSurfaceTemperature.value.toFixed(1)),
              wave: Number((akdenizPt.waveHeight?.value ?? 0).toFixed(1)),
            });
          }
        }
      } catch {
        // Safe degrade
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    loadTelemetry();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Graceful collapse if telemetry feeds are unavailable or empty
  if (loaded && !earthquake && !marmara && !akdeniz) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Canlı Telemetri ve Afet Akışı"
      aria-live="off"
      className="w-full border-b border-border/70 bg-muted/40 backdrop-blur-md overflow-hidden text-xs py-2 px-4 select-none"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Status Tag */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="primary"
            size="sm"
            dot
            className="bg-[var(--color-primary,#b0522e)] text-white shadow-2xs font-mono text-[10px] px-2"
          >
            CANLI TELEMETRİ
          </Badge>
          <span className="hidden md:inline-flex text-muted-foreground text-[11px]">
            Copernicus &amp; AFAD Aktif
          </span>
        </div>

        {/* Ticker Items */}
        <div className="flex-1 min-w-0 flex items-center gap-6 overflow-x-auto scrollbar-none py-0.5 text-muted-foreground text-[11px] sm:text-xs">
          {earthquake && (
            <>
              <Link
                href="/v2/deprem"
                className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
              >
                <Flame className="size-3.5 text-destructive animate-pulse" />
                <span className="font-semibold text-foreground">Son Deprem:</span>
                <span>
                  M {earthquake.magnitude.toFixed(1)} {earthquake.location}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({earthquake.timeAgo})
                </span>
              </Link>
              <span className="text-border">|</span>
            </>
          )}

          {marmara && (
            <>
              <Link
                href="/v2/deniz"
                className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
              >
                <Waves className="size-3.5 text-accent" />
                <span className="font-semibold text-foreground">Marmara:</span>
                <span>
                  {marmara.sst} °C (Dalga: {marmara.wave}m)
                </span>
              </Link>
              <span className="text-border">|</span>
            </>
          )}

          {akdeniz && (
            <>
              <Link
                href="/v2/deniz"
                className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
              >
                <Waves className="size-3.5 text-accent" />
                <span className="font-semibold text-foreground">Akdeniz:</span>
                <span>
                  {akdeniz.sst} °C (Dalga: {akdeniz.wave}m)
                </span>
              </Link>
              <span className="text-border">|</span>
            </>
          )}

          <Link
            href="/v2/turkiye"
            className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
          >
            <MapPin className="size-3.5 text-secondary" />
            <span className="font-semibold text-foreground">81 İl Atlası:</span>
            <span>Resmî TÜİK &amp; Harita Verisi</span>
          </Link>

          <span className="text-border">|</span>

          <Link
            href="/v2/araclar"
            className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
          >
            <Layers className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">CBS Araçları:</span>
            <span>WGS84 Jeodezik Hesaplama</span>
          </Link>
        </div>

        {/* Right Timestamp */}
        <div className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-muted-foreground shrink-0">
          <Clock className="size-3 text-muted-foreground" />
          <span>CANLI UTC+3</span>
        </div>
      </div>
    </aside>
  );
}
