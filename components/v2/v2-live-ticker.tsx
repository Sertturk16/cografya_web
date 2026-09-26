"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Flame, Waves, MapPin, Layers } from "lucide-react";
import { tr } from "@/lib/text/format-number";

export interface EarthquakeTickerData {
  readonly magnitude: number;
  readonly location: string;
  readonly timeAgo: string;
}

export interface MarineTickerData {
  readonly sst: number;
  readonly wave: number;
}

export function extractEarthquakeTickerData(
  item:
    | {
        magnitude?: number;
        placeNameTr?: string;
        location?: string;
        occurredAtUtc?: string;
      }
    | null
    | undefined,
  now = Date.now(),
): EarthquakeTickerData | null {
  if (!item || typeof item.magnitude !== "number" || !item.occurredAtUtc) return null;
  const diffMinutes = Math.max(
    1,
    Math.round((now - new Date(item.occurredAtUtc).getTime()) / 60000),
  );
  const timeAgo =
    diffMinutes < 60 ? `${diffMinutes} dk önce` : `${Math.round(diffMinutes / 60)} sa önce`;
  return {
    magnitude: item.magnitude,
    location: item.placeNameTr ?? item.location ?? "Türkiye",
    timeAgo,
  };
}

export function extractMarineTickerData(
  points:
    | Array<{
        point?: { basin?: string; seaBasin?: string; nameTr?: string };
        seaSurfaceTemperature?: { value?: number };
        waveHeight?: { value?: number };
      }>
    | null
    | undefined,
): { marmara: MarineTickerData | null; akdeniz: MarineTickerData | null } {
  if (!Array.isArray(points)) return { marmara: null, akdeniz: null };

  let marmara: MarineTickerData | null = null;
  let akdeniz: MarineTickerData | null = null;

  const marmaraPt = points.find(
    (p) => p.point?.seaBasin === "marmara" || p.point?.basin === "marmara",
  );
  if (marmaraPt && typeof marmaraPt.seaSurfaceTemperature?.value === "number") {
    marmara = {
      sst: marmaraPt.seaSurfaceTemperature.value,
      wave: marmaraPt.waveHeight?.value ?? 0,
    };
  }

  const akdenizPt = points.find(
    (p) =>
      p.point?.seaBasin === "mediterranean" ||
      p.point?.seaBasin === "akdeniz" ||
      p.point?.basin === "akdeniz",
  );
  if (akdenizPt && typeof akdenizPt.seaSurfaceTemperature?.value === "number") {
    akdeniz = {
      sst: akdenizPt.seaSurfaceTemperature.value,
      wave: akdenizPt.waveHeight?.value ?? 0,
    };
  }

  return { marmara, akdeniz };
}

/*
 * The ticker's figures, as the reader sees them. The strip is Turkish chrome on every route
 * (its labels are hard-written Turkish), so the figures take the Turkish decimal comma: `M 2,9`,
 * `21,5 °C`. Rounding to one decimal happens here, at the point of display, not in the
 * extractors above, so the data stays the feed's own number.
 */
export function earthquakeTickerText(eq: EarthquakeTickerData): string {
  return `M ${tr(eq.magnitude, 1)} ${eq.location}`;
}

export function marineTickerText(sea: MarineTickerData): string {
  return `${tr(sea.sst, 1)} °C (Dalga: ${tr(sea.wave, 1)} m)`;
}

/*
 * Each value carries its source beside it, inside its own link: AFAD for the earthquake,
 * Copernicus Marine and ECMWF for the sea values (the wave field falls back to ECMWF where the
 * regional model has no coverage). `docs/design.md`: source notes are footnotes, visible without
 * a click. The full notice, disclaimer and licence link are on the page each value links to
 * (`/deprem`, `/deniz`), and the licence text itself is on `/hakkimizda`. Plain text, never a
 * link: the whole item is already one.
 */
export const EARTHQUAKE_TICKER_SOURCE = "AFAD";
export const MARINE_TICKER_SOURCE = "Copernicus, ECMWF";

function TickerSource({ children }: { readonly children: string }) {
  return <span className="text-[10px] text-muted-foreground">· {children}</span>;
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
          const eqData = extractEarthquakeTickerData(eqResult.value.items[0]);
          if (eqData) setEarthquake(eqData);
        }

        if (marineResult.status === "fulfilled" && Array.isArray(marineResult.value?.points)) {
          const marineData = extractMarineTickerData(marineResult.value.points);
          if (marineData.marmara) setMarmara(marineData.marmara);
          if (marineData.akdeniz) setAkdeniz(marineData.akdeniz);
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
      aria-label="Son deprem ve deniz durumu"
      aria-live="off"
      className="w-full border-b border-border/70 bg-muted/40 backdrop-blur-md overflow-hidden text-xs py-2 px-4 select-none"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Status Tag */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="primary" size="sm" dot className="shadow-2xs font-mono text-[10px] px-2">
            GÜNCEL
          </Badge>
        </div>

        {/* Ticker Items */}
        <div className="flex-1 min-w-0 flex items-center gap-6 overflow-x-auto scrollbar-none py-0.5 text-muted-foreground text-[11px] sm:text-xs">
          {earthquake && (
            <>
              <Link
                href="/deprem"
                className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
              >
                <Flame className="size-3.5 text-destructive animate-pulse" />
                <span className="font-semibold text-foreground">Son Deprem:</span>
                <span>{earthquakeTickerText(earthquake)}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({earthquake.timeAgo})
                </span>
                <TickerSource>{EARTHQUAKE_TICKER_SOURCE}</TickerSource>
              </Link>
              <span className="text-border">|</span>
            </>
          )}

          {marmara && (
            <>
              <Link
                href="/deniz"
                className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
              >
                <Waves className="size-3.5 text-accent" />
                <span className="font-semibold text-foreground">Marmara:</span>
                <span>{marineTickerText(marmara)}</span>
                <TickerSource>{MARINE_TICKER_SOURCE}</TickerSource>
              </Link>
              <span className="text-border">|</span>
            </>
          )}

          {akdeniz && (
            <>
              <Link
                href="/deniz"
                className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
              >
                <Waves className="size-3.5 text-accent" />
                <span className="font-semibold text-foreground">Akdeniz:</span>
                <span>{marineTickerText(akdeniz)}</span>
                <TickerSource>{MARINE_TICKER_SOURCE}</TickerSource>
              </Link>
              <span className="text-border">|</span>
            </>
          )}

          <Link
            href="/turkiye"
            className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
          >
            <MapPin className="size-3.5 text-secondary" />
            <span className="font-semibold text-foreground">81 il:</span>
            <span>TÜİK nüfusu, yüzölçümü, iklim</span>
          </Link>

          <span className="text-border">|</span>

          <Link
            href="/araclar"
            className="flex items-center gap-1.5 hover:text-foreground shrink-0 transition-colors"
          >
            <Layers className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">Araçlar:</span>
            <span>haritada mesafe ve alan ölç</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
