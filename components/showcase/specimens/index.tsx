import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { TemellerSpecimens } from "./temeller";
import { AksiyonlarSpecimens } from "./aksiyonlar";
import { FormlarSpecimens } from "./formlar";
import { VeriSpecimens } from "./veri";
import { GeriBildirimSpecimens } from "./geri-bildirim";
import { DuzenSpecimens } from "./duzen";
import { BreadcrumbsServerSpecimen } from "./breadcrumbs-server";
import { FaqSectionServerSpecimen } from "./faq-section-server";
import { HaritaSpecimens } from "./harita";

/**
 * Maps a category slug to its specimens.
 *
 * A component's specimen is written in the task that builds the component, not here —
 * `harita` has no entry yet because `MapAttribution` and `MapLegend` are Phase D.
 * `components/showcase/registry.test.ts` is what notices the gap.
 *
 * `locale` is threaded through only for `"duzen"`, which is the one category with Server
 * Component specimens (`BreadcrumbsServerSpecimen` and `FaqSectionServerSpecimen` — the real
 * `Breadcrumbs` and `FaqSection`, each of which needs a `locale` to gate its JSON-LD on; see
 * those files' own docblocks). This file itself carries no
 * `"use client"`, so rendering it here — a server import, in a server module, next to the
 * client `DuzenSpecimens` — is the ordinary Server-Component-renders-Client-Component
 * direction, not the reverse this branch's whole regression was about.
 */
export function specimensFor(slug: string, locale: Locale): ReactNode {
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
      return (
        <>
          <BreadcrumbsServerSpecimen locale={locale} />
          <FaqSectionServerSpecimen locale={locale} />
          <DuzenSpecimens />
        </>
      );
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
