import { getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MARINE_SOURCES_ANCHOR } from "@/lib/marine/attribution-anchor";

/**
 * The notice that travels WITH a published marine value — and the smaller half of a split.
 *
 * `MarineAttribution` used to render two different kinds of thing in one block, and only one
 * of them is a licence:
 *
 *  1. LICENCE NOTICES — ECMWF's copyright line, its "shall be attached" attribution and
 *     liability wording, and Copernicus Marine's required sentence. CC BY 4.0 §3(a)(2) says in
 *     terms that these may be satisfied "by providing a URI or hyperlink to a resource that
 *     includes the required information", so they are published ONCE, on `/hakkimizda`, and
 *     every value surface links there. That is the owner decision this component exists for.
 *  2. A SAFETY DISCLAIMER — `Marine.disclaimer.educationalOnly`. It is not a licence notice and
 *     no licence clause governs where it goes. A reader looking at a sea temperature and a wave
 *     height has to see it NEXT TO THE NUMBERS, so it did not move and it may not move.
 *
 * So this block carries (2) in full and a link to (1). It is the ONE thing rendered on every
 * page that publishes a CMEMS/ECMWF-derived value, and
 * `components/marine/marine-attribution-coverage.test.ts` derives that page list from source
 * rather than trusting anyone's memory of it.
 *
 * THERE IS NO PROP THAT TURNS ANY OF THIS OFF, and there must not be one — not a
 * `hideDisclaimer`, not a `compact`, not a `variant` whose quiet member drops the sentence.
 * `components/attribution-not-optional.test.ts` fails the build over the shapes such a prop
 * would take; it was written after `ClimateSection` and `AirPollutionSection` each shipped a
 * `hideAttribution` that delegated a mandated notice to a `<details>` nobody opens. This
 * component takes NO props at all, which is the cheapest possible way to keep that true.
 *
 * Server component, like every call site: the disclaimer string is read with
 * `getTranslations` from `next-intl/server`, and nothing here is interactive.
 */
export async function MarineDataNotice() {
  const t = await getTranslations("Marine");

  return (
    <aside
      aria-label={t("notice.label")}
      className="rounded-2xl border border-border bg-muted/40 px-4 py-3.5 sm:px-5 sm:py-4"
    >
      <div className="flex max-w-[70ch] gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden="true" />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm leading-relaxed text-foreground">
            {t("disclaimer.educationalOnly")}
          </p>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            <Link
              href={MARINE_SOURCES_ANCHOR}
              className="text-primary-strong underline underline-offset-2 hover:no-underline"
            >
              {t("notice.licenceLink")}
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
