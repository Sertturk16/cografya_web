import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home, Mail } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { H1, H2, Lede } from "@/components/patterns/typography";
import { PageContainer } from "@/components/patterns/page-container";
import { MarineAttribution } from "@/components/marine/marine-attribution";
import { ClimateAttribution } from "@/components/climate/climate-attribution";
import { getMarineLayersSafe } from "@/lib/api/marine";
import { MARINE_SOURCES_FRAGMENT } from "@/lib/marine/attribution-anchor";
import { env } from "@/lib/env";

interface V2AboutPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/hakkimizda",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/**
 * `/hakkimizda` · `/en/about`, rebuilt in the V2 language.
 *
 * THE COPY IS VERBATIM; ONLY THE LAYOUT IS NEW. Every string still comes from the `About`
 * namespace under the key the V1 page used, because most of this page is not editorial prose
 * that can be reworded — it is licence text. `docs/design.md` and the source ledger both
 * treat these as untouchable, and the V1 page carries long rationales for each. The three
 * that constrain THIS file's markup, restated so they survive the port:
 *
 * 1. The JRC citation and the `flag-icons` MIT notice are IDENTICAL in both catalogues and
 *    carry `lang="en"`. A citation is a key, not prose; translating one breaks the thing it
 *    exists to do, and a Turkish-voice screen reader reading English with Turkish phonetics
 *    is a WCAG 3.1.2 regression that was fixed once already. Bare product names inside
 *    Turkish prose (OpenStreetMap, Natural Earth, ODbL) are deliberately NOT wrapped.
 * 2. The full stop after each of those two spans sits OUTSIDE it: the sibling bullets end in
 *    one, and the wording inside is the licence's own — punctuation is not ours to add to it.
 * 3. The sources heading names MAPS and FLAGS and nothing else. It deliberately excludes the
 *    climate, marine and statistical sources; a heading promising them would be a
 *    completeness claim this section cannot honour.
 *
 * THIS PAGE IS NOW THE CENTRAL ATTRIBUTION SURFACE FOR THE MARINE AND CLIMATE LICENCES. ECMWF Open Data is
 * CC BY 4.0, and §3(a)(2) permits the required information to be carried by "a URI or hyperlink
 * to a resource that includes" it; the owner took that option. So the full ECMWF and Copernicus
 * Marine notices are published HERE, exactly once, and the seven surfaces that publish a derived
 * value carry `MarineDataNotice` — the safety disclaimer plus a link to this section — instead of
 * a second copy of the licence text. The licence blocks themselves are still
 * `MarineAttribution`, reading the same single-sourced `Marine.attribution.*` keys: there is one
 * copy of each verbatim string in the repository and that has not changed.
 *
 * The anchor `#veri-kaynaklari` is load-bearing in the licence sense — it is the hyperlink that
 * DISCHARGES the attribution — so the fragment is the shared constant
 * `MARINE_SOURCES_FRAGMENT`, not a string written out here, and
 * `components/marine/marine-attribution-coverage.test.ts` checks that this page still renders it.
 *
 * The C3S / ERA5-Land notice took the same route: `ClimateAttribution` renders it verbatim under
 * its own anchor (`#iklim-verisi`, `lib/climate/attribution-anchor.ts`), and every province
 * page's climate source line links there. The PM2.5 (ACAG) caveat did NOT move: its text arrives
 * per province in the API payload, so it stays beside the values it comes with.
 *
 * The marine block is a SIBLING of the map/flag colophon rather than more bullets inside it, and
 * deliberately so: rationale 3 above is that `dataHeading` names MAPS and FLAGS and nothing else
 * because a heading may not promise more than its section carries. Marine sources under that
 * heading would break exactly that rule, and broadening the heading would then promise the
 * climate and statistical sources this page still does not list.
 *
 * The V1 markup used `.wrap-long-tokens`, a one-declaration global utility added so the
 * repository address in the ODbL §4.6 offer could break at 320 px instead of widening the
 * document. T-032 PR4 deletes that class along with the rest of the V1 CSS, so the same job
 * is done here by Tailwind's `wrap-break-word` — the identical `overflow-wrap: break-word`,
 * with no global to leave behind.
 */
export default async function V2AboutPage({ params }: V2AboutPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");
  const tb = await getTranslations("Breadcrumb");

  // The catalogue, for `MarineAttribution` below: it is where ECMWF's required copyright YEAR is
  // derived from (the ingested cycle's own year — `lib/marine/attribution.ts`). `…Safe` returns
  // `[]` when the API is unreachable or `MARINE_ENABLED` is off, and the component then omits the
  // copyright LINE and still publishes the notice, which is the only correct behaviour: a year
  // invented to fill a template is the one thing an attribution may not do.
  const marineLayers = await getMarineLayersSafe();

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: tb("home"), href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: t("heading"), path: "/hakkimizda" },
  ];

  return (
    <PageContainer space="tight">
      <Breadcrumbs items={breadcrumbItems} locale={locale} surface="localized" />

      <article className="mt-8 max-w-3xl space-y-12">
        <header className="space-y-4">
          <H1>{t("heading")}</H1>
          <Lede>{t("body1")}</Lede>
          <p className="max-w-prose text-muted-foreground">{t("sourcing")}</p>
        </header>

        <section className="space-y-4">
          <H2>{t("aboutHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("aboutBody1")}</p>
          <p className="max-w-prose leading-relaxed">{t("aboutBody2")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("contactHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("contactBody")}</p>
          {/* A real `mailto:`, so it stays a plain anchor rather than a routed Link. It
              is the page's one action, which is why it gets a surface of its own. */}
          {/* `max-w-full` plus a breakable span, not `wrap-break-word` on the anchor.
              An `inline-flex` box sizes to its content and does not shrink, so the
              overflow-wrap never got a chance: at 320px this address pushed the document
              to 318px against a 305px viewport. The span is what is allowed to break. */}
          <a
            href={`mailto:${env.NEXT_PUBLIC_CONTACT_EMAIL}`}
            className="inline-flex max-w-full items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-muted"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">{env.NEXT_PUBLIC_CONTACT_EMAIL}</span>
          </a>
        </section>

        {/* THE SITE'S DATA-SOURCE COLOPHON, and the target of the footer's source badges and
            of every marine value surface's notice. `scroll-mt-*` so the sticky header does
            not cover the heading the reader was sent to. */}
        <div id={MARINE_SOURCES_FRAGMENT} className="scroll-mt-24 space-y-6">
          {/* The licence colophon. A muted surface rather than a card: it is a legal
              obligation the page carries, not a feature it advertises, and the visual
              separation is what stops it reading as more editorial prose. */}
          <section className="space-y-4 rounded-2xl border border-border bg-muted p-5 sm:p-6">
            <H2 className="text-xl">{t("dataHeading")}</H2>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {t("dataIntro")}
            </p>
            <ul role="list" className="space-y-2 text-sm wrap-break-word text-muted-foreground">
              <li>{t("dataOsm")}</li>
              <li>{t("dataOsmOffer")}</li>
              <li>{t("dataNaturalEarth")}</li>
              <li>
                {t("dataJrcLabel")} <span lang="en">{t("dataJrcEnglish")}</span>.
              </li>
              <li>
                {t("dataFlagsLabel")} <span lang="en">{t("dataFlagsCredit")}</span>.
              </li>
            </ul>
            <p className="text-sm leading-relaxed wrap-break-word text-muted-foreground">
              {t("dataJrcCitationIntro")}{" "}
              <span lang="en">
                {t("dataJrcCitation")}{" "}
                <a
                  href={t("dataJrcDoi")}
                  rel="noopener noreferrer"
                  className="text-primary-strong underline underline-offset-2"
                >
                  {t("dataJrcDoi")}
                </a>
              </span>
            </p>
          </section>

          {/* THE MARINE LICENCE TEXT, IN ITS ONE PLACE. Same component and the same
              single-sourced `Marine.attribution.*` keys the value surfaces used to render
              inline — only the number of render sites changed, from seven to one. Its
              `lang="en"` blocks are what keep a Turkish-voice screen reader from reading the
              English notices with Turkish phonetics (WCAG 3.1.2), exactly as the JRC citation
              above does. The heading is this page's own, not `/deniz`'s "Kaynaklar ve
              kullanım": it sits under a colophon that already names other sources. */}
          <MarineAttribution
            layers={marineLayers}
            headingId="veri-kaynaklari-deniz"
            heading={t("marineDataHeading")}
          />

          {/* THE C3S / ERA5-LAND LICENCE NOTICE, in its one place, under its own anchor
              (`#iklim-verisi`) — the target of every climate section's "Lisans" link. A
              sibling block for the same reason the marine one is: `dataHeading` names maps
              and flags only. */}
          <ClimateAttribution heading={t("climateDataHeading")} />
        </div>
      </article>
    </PageContainer>
  );
}
