import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { CLIMATE_LICENCE_FRAGMENT } from "@/lib/climate/attribution-anchor";

/** Same weights as `MarineAttribution`, its sibling on `/hakkimizda`: one colophon, one voice. */
const BODY = "text-[0.8125rem] leading-relaxed text-muted-foreground";
/**
 * The verbatim licence text, set in a quieter, indented block so a Turkish reader can see where
 * the platform's prose stops and the licence text begins. `wrap-break-word` for the same reason
 * `MarineAttribution` carries it: nothing in a licence string may widen a 320px document.
 */
const LICENCE =
  "my-3 border-l-2 border-border py-0.5 pl-3.5 text-[0.85rem] leading-relaxed text-muted-foreground wrap-break-word";

interface ClimateAttributionProps {
  /** The block's heading — the page's own (`About.climateDataHeading`), like the marine block's. */
  heading: string;
}

/**
 * THE C3S / ERA5-LAND LICENCE NOTICE, IN ITS ONE PLACE.
 *
 * ERA5-Land is CC BY 4.0, and §3(a)(2) lets the required information travel as "a URI or
 * hyperlink to a resource that includes" it — the option the marine notices already take. So the
 * verbatim notice renders here, on `/hakkimizda` under `#iklim-verisi`, and every province page
 * with a climate chart carries a "Lisans" link to it beside its source line (`ClimateSection`).
 *
 * The notice is published VERBATIM, in English, in BOTH locales, marked `lang="en"` so a screen
 * reader on the Turkish page does not read it with Turkish phonemes (WCAG 3.1.2). The Turkish
 * sentence above it EXPLAINS it and never replaces it; shortening, restyling the words or
 * translating any of it is a licence breach. The year inside it is the data's generation year,
 * pinned in the catalogue, never a wall-clock read (`lib/climate/attribution-notice.test.ts`).
 *
 * No prop turns any of it off; the heading is the only thing a caller chooses.
 */
export async function ClimateAttribution({ heading }: ClimateAttributionProps) {
  const t = await getTranslations("Climate");
  const headingId = `${CLIMATE_LICENCE_FRAGMENT}-baslik`;

  return (
    // The anchor sits on a wrapper because a variant `Card` takes no `className`, and the
    // `scroll-mt-*` is what keeps the sticky header off the heading the reader was sent to.
    <div id={CLIMATE_LICENCE_FRAGMENT} className="scroll-mt-24">
      <Card as="section" variant="panel" space="3" aria-labelledby={headingId}>
        <div className="max-w-[70ch] space-y-3">
          <h2 id={headingId} className="font-heading text-lg font-bold text-foreground">
            {heading}
          </h2>
          <p className={BODY}>{t("sourceC3sNoticeIntro")}</p>
          <p className={LICENCE} lang="en">
            {t("attribution.c3sNotice")}
          </p>
        </div>
      </Card>
    </div>
  );
}
