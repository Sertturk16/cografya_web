import type { ReactNode } from "react";
import { TemellerSpecimens } from "./temeller";
import { AksiyonlarSpecimens } from "./aksiyonlar";
import { FormlarSpecimens } from "./formlar";
import { VeriSpecimens } from "./veri";
import { GeriBildirimSpecimens } from "./geri-bildirim";
import { DuzenSpecimens } from "./duzen";
import { HaritaSpecimens } from "./harita";

/**
 * Maps a category slug to its specimens.
 *
 * A component's specimen is written in the task that builds the component, not here —
 * `harita` has no entry yet because `MapAttribution` and `MapLegend` are Phase D.
 * `components/showcase/registry.test.ts` is what notices the gap.
 */
export function specimensFor(slug: string): ReactNode {
  switch (slug) {
    case "temeller":
      return <TemellerSpecimens />;
    case "aksiyonlar":
      return <AksiyonlarSpecimens />;
    case "formlar":
      return <FormlarSpecimens />;
    case "veri":
      return <VeriSpecimens />;
    case "geri-bildirim":
      return <GeriBildirimSpecimens />;
    case "duzen":
      return <DuzenSpecimens />;
    case "harita":
      return <HaritaSpecimens />;
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Bu bölümün bileşenleri henüz yazılmadı (T-034 Faz D).
        </p>
      );
  }
}
