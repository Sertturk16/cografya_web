import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/hakkimizda",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");
  const tb = await getTranslations("Breadcrumb");

  return (
    <div className="container page">
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: t("heading"), href: "/hakkimizda" },
        ]}
      />
      <h1>{t("heading")}</h1>
      {/* The old second paragraph ("Platform geliştirme aşamasındadır. Bu sayfa, çok
          dilli mimarinin ve SEO altyapısının bir örneğidir…") was removed by the
          site-wide frame-copy trim (→ DEC 2026-07-30t/u, CONTENT-STYLE §22): it leaked
          internal project state to the reader and described the page as a demo of its
          own infrastructure. What the platform is and how it sources content stays —
          but as TWO paragraphs, not one: §22 caps a page sub-line at one sentence /
          120 characters, so the lede carries the definition and the sourcing sentence
          drops to a normal paragraph (PR #29 review, CR-M2). */}
      <p className="lede">{t("body1")}</p>
      <p>{t("sourcing")}</p>

      {/* MAP DATA SOURCES — a licence obligation, not a colophon.
          JRC Global Surface Water's terms require crediting "datasets AND the journal
          article", and one line under a map cannot carry a bibliographic citation. This
          section is its home (→ DEC 2026-08-03c, Q2 = a): the route already exists, so it
          costs no new SEO surface — no metadata, canonical, hreflang, sitemap entry or
          localized slug — while adding indexable text to a thin page.

          Deliberately scoped to the MAPS, and the heading says so. A site-wide
          /veri-kaynaklari page collecting every dataset (ECMWF, CMEMS, …) is a real SEO
          surface and a separate task; promising completeness under this heading would be
          the only way to get this wrong.

          `dataJrcCitation` is IDENTICAL in tr and en, unaccented "Jean-Francois" and a plain
          hyphen in "418-422", because that is how the article is indexed — a citation is a
          key, not prose, and translating one breaks the thing it exists to do.

          Both untranslated blocks therefore carry `lang="en"`, the same way
          `components/marine/marine-attribution.tsx` marks the ECMWF and CMEMS notices: a
          Turkish-voice screen reader reading an English citation with Turkish phonetics is
          the regression that fix already closed once (WCAG 3.1.2). The bare proper nouns in
          the list above (OpenStreetMap, Natural Earth, ODbL) are deliberately NOT wrapped —
          a product name inside Turkish prose is not a foreign-language passage. */}
      <h2>{t("dataHeading")}</h2>
      <p>{t("dataIntro")}</p>
      <ul>
        <li>{t("dataOsm")}</li>
        {/* L1 — ODbL §4.6's OFFER (→ DEC 2026-08-08c md.5). The chain closes through §4.4(c):
            once a Produced Work made from an OSM-derived database is used publicly, the
            derivative database counts as publicly used too, and §4.6 then asks for an offer of
            it. The locator mini-map is what triggered this; the data itself was never the
            missing piece (the repo is public and carries the snapshot, the generator and the
            produced paths) — what was missing was a discoverable offer, which is this line.
            Its home is this existing section, so it costs no new SEO surface: no route, no
            metadata, no canonical, no hreflang, no sitemap entry.

            It is licence text (CONTENT-STYLE §22 "dokunulmaz"), so it keeps the formal
            register the rest of the list uses and is NOT trimmed to the interface-copy caps.
            The repo path fragments are keys, not prose — they are identical in both
            catalogues on purpose. */}
        <li>{t("dataOsmOffer")}</li>
        <li>{t("dataNaturalEarth")}</li>
        <li>
          {/* The full stop sits OUTSIDE the span: the sibling bullets end in one, and the
              English string inside is the licence's own wording — punctuation is not ours
              to add to it. */}
          {t("dataJrcLabel")} <span lang="en">{t("dataJrcEnglish")}</span>.
        </li>
      </ul>
      <p>
        {t("dataJrcCitationIntro")}{" "}
        <span lang="en">
          {t("dataJrcCitation")}{" "}
          <a href={t("dataJrcDoi")} rel="noopener noreferrer">
            {t("dataJrcDoi")}
          </a>
        </span>
      </p>
    </div>
  );
}
