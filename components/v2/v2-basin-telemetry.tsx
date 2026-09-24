"use client";

import { Link } from "@/i18n/navigation";
import type { MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { tr } from "@/lib/text/format-number";

type LinkHref = React.ComponentProps<typeof Link>["href"];

interface V2BasinTelemetryProps {
  readonly basinNameTr: string;
  readonly marinePoints: readonly MarinePointData[];
}

/**
 * The per-point value table of a basin page — the ONE part of `V2SeaBasinDetailView` that waits
 * on the API. It left the view so the page can stream it behind a Suspense boundary while the
 * hero, the prose and the FAQ render at once. Markup byte-identical to the section it replaces.
 */
export function V2BasinTelemetry({ basinNameTr, marinePoints }: V2BasinTelemetryProps) {
  const sortedPoints = [...marinePoints].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <section aria-labelledby="basin-telemetry-heading" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <h2
            id="basin-telemetry-heading"
            className="font-heading text-xl sm:text-2xl font-bold text-foreground"
          >
            {basinNameTr} Açığındaki {sortedPoints.length} Nokta
          </h2>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          Değerler: Copernicus Marine ve ECMWF modelleri
        </span>
      </div>

      {sortedPoints.length > 0 ? (
        <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="p-3 sm:p-4">Nokta ve Kıyı</th>
                <th className="p-3 sm:p-4">İl</th>
                <th className="p-3 sm:p-4">Su Sıcaklığı</th>
                <th className="p-3 sm:p-4">Belirgin Dalga Yüksekliği</th>
                <th className="p-3 sm:p-4">10 m&apos;de Rüzgâr</th>
                <th className="p-3 sm:p-4">Geçerlilik Anı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sortedPoints.map((pt) => {
                return (
                  <tr key={pt.slugTr} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 sm:p-4">
                      <div className="font-bold text-foreground text-xs sm:text-sm">
                        {pt.nameTr}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{pt.coastLabelTr}</div>
                    </td>
                    <td className="p-3 sm:p-4">
                      {pt.provinceSlug ? (
                        <Link
                          href={`/turkiye/${pt.provinceSlug}` as LinkHref}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          <span>{pt.provinceName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ({pt.plateCode})
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{pt.provinceName}</span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-bold text-foreground">
                      {pt.sst !== null && pt.sst !== undefined ? `${tr(pt.sst, 1)} °C` : "—"}
                    </td>
                    <td className="p-3 sm:p-4 font-mono text-foreground">
                      {pt.waveHeight !== null && pt.waveHeight !== undefined
                        ? `${tr(pt.waveHeight, 2)} m`
                        : "—"}
                    </td>
                    <td className="p-3 sm:p-4 font-mono text-foreground">
                      {pt.windSpeedKmh !== null && pt.windSpeedKmh !== undefined
                        ? `${tr(pt.windSpeedKmh, 0)} km/h`
                        : "—"}
                    </td>
                    <td className="p-3 sm:p-4 text-[11px] text-muted-foreground font-mono">
                      {/* "—", never "Güncel". The column heading is "Model Zamanı", so a
                          fallback string here is read as an ANSWER to it: the row states a
                          freshness it does not have, and states it in the case where no cycle
                          has been ingested and the platform knows least. The three cells to
                          the left of this one already use the neutral dash; `validAt` was the
                          exception to the table's own convention. */}
                      {pt.validAt || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center rounded-3xl border border-dashed border-border bg-card/40 text-xs text-muted-foreground">
          Bu denizin noktaları şu an alınamadı.
        </div>
      )}
    </section>
  );
}
