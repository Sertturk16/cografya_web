import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { FeaturedCards, type FeaturedCardItem } from "@/components/home/featured-cards";
import { SeaToday } from "@/components/home/sea-today";
import { MarineAttribution } from "@/components/marine/marine-attribution";
import { getCountryMapSummaryResilient } from "@/lib/api/countries";
import {
  getMarineLayersSafe,
  getMarineOverviewSafe,
  getMarinePointsSafe,
  MARINE_VALUES_REVALIDATE_SECONDS,
} from "@/lib/api/marine";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  featuredPopulationFact,
  pickDailyCountries,
  pickDailyProvinces,
} from "@/lib/home/featured";
import {
  buildMarineHomeSummary,
  marineScope,
  marineSummaryShowsValues,
} from "@/lib/home/marine-summary";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "@/components/home/home.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/**
 * The ISR window, DECLARED rather than inferred (→ PR #46 review CR-FR2-3).
 *
 * Next already derives a route's revalidate period from the shortest fetch in it, so the
 * marine value read's 900 s was this page's window before this line existed — the behaviour is
 * unchanged. What changes is that the page no longer depends on that inference to keep a
 * PROMISE IT MAKES IN COPY: the "Bugün keşfet" headings claim the cards belong to today, and
 * that claim is only true because the window turns over well inside a day. Someone removing
 * the marine section, or swapping it for a longer-cached read, would silently stretch the
 * window and make the heading lie, with nothing failing.
 *
 * Next requires a route segment config export to be a statically analyzable literal, so this
 * cannot BE the constant (importing it into the value position fails the build with "Invalid
 * segment configuration export"). The annotation is the guard instead — it is the shared
 * constant's literal type, so moving `MARINE_VALUES_REVALIDATE_SECONDS` without moving this
 * number is a type error rather than silent drift. Same pattern as
 * `app/api/search-index/[locale]/route.ts`.
 */
export const revalidate: typeof MARINE_VALUES_REVALIDATE_SECONDS = 900;

/**
 * NOTHING BELOW REACHES THE HEAD, AND THAT IS DELIBERATE.
 *
 * The page now carries live sea values, province counts and country counts, and not one of
 * them is interpolated into `<title>` or the meta description. A number baked in at
 * revalidate time sits wrong in the SERP for the rest of the ISR window, and a title that
 * flips between two strings across windows is a worse failure than not being there at all —
 * the same ruling `/deniz` records for the same reason. The head states the site's SUBJECT,
 * which is true in every render.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/",
    title: t("metaTitle"),
    titleAbsolute: true,
    description: t("metaDescription"),
  });
}

/**
 * The homepage — five server-rendered sections, zero client JavaScript
 * (→ DEC 2026-08-04i §1; plan `Owner's Inbox/ux-anasayfa/plan.md`).
 *
 * It used to be an `<h1>`, one sentence and two buttons in front of 81 provinces, ~196
 * countries, 30 marine reference points and a three-mode game — the UX review called it "the
 * product's weakest page and the one that will be seen most". The rebuild puts the substance
 * on it, in the owner's own order: a compressed hero with data-driven scope chips, a band
 * pointing at the two map hubs, today's sea, today's entities, an invitation to the game.
 *
 * ## Two owner rulings from the live walkthrough
 *
 * The second section shipped as a decimated Türkiye thumbnail; the owner removed it
 * (→ DEC 2026-08-05b — visible seams between provinces, no water layer) and kept its copy and
 * its two links, which is why that band is now plain navigation and carries no ODbL chip: the
 * notice is owed wherever the GEOMETRY is shown, and none is shown here any more. The card
 * rows became a DAY-SEEDED draw (→ DEC 2026-08-05a); the mechanism, including why it is not
 * `Math.random`, lives in `lib/home/featured.ts`. `new Date()` is read here and passed in, so
 * the selection function stays pure: the page owns the clock, the library owns the rule. The
 * route's ISR window is 900 s, so the draw turns over within a quarter-hour of Istanbul
 * midnight — the heading says "bugün", not "şu an".
 *
 * ## Rendering: SSG → ISR, still full HTML in the first response
 *
 * This page fetched nothing before; it now makes five reads. Next takes a route's effective
 * revalidate period from its SHORTEST fetch, so the marine value read's 900 s (which mirrors
 * the api's own `s-maxage`) becomes this page's window. That is the known price of publishing
 * live numbers, `/deniz` already pays it, and it costs no SEO: the response is still
 * statically generated HTML with every link, every heading and every number present
 * (`ENGINEERING.md` §3/§4 #1). Zero client islands, so INP is untouched.
 *
 * ## Two resilience postures, on purpose
 *
 * `…Resilient` for provinces and countries: degrade to `[]` at BUILD (web CI has no api), but
 * re-throw at RUNTIME so a transient blip leaves the last good static page in place instead of
 * caching a homepage that lost its cards. `…Safe` for all three marine reads: the sea is an
 * enhancement on a page that is not about the sea, and an external provider chain may never
 * turn the site's front door into a 500. Every section renders its own honest shape when its
 * data is missing — none of them prints an empty skeleton.
 *
 * ## What is deliberately NOT here
 *
 * No `ItemList` for the six daily cards (no rich result exists for it, and it would create
 * a second copy of the visible list to keep in sync forever — `SEO-POLICY.md` §B5.7). No
 * `SearchAction`/sitelinks-searchbox (Google retired it in Nov 2024). No breadcrumb (this is
 * the root). No second search box — the header owns site search, and a duplicate combobox
 * would double both the a11y surface and the INP surface. `WebSite` + `Organization` were
 * already here and are unchanged; no new URL, no new sitemap row, no new schema type.
 */
export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tRegions = await getTranslations("Regions");
  const tContinents = await getTranslations("Continents");
  const tDetail = await getTranslations("ProvinceDetail");
  const format = await getFormatter();

  // Five independent reads, in parallel. Each of the two geo reads serves two jobs at once —
  // the scope chip's count and the daily cards' identity plus population — so the page joins
  // the purpose-built map-summary payloads rather than a list plus a second call each.
  const [provinces, countries, marinePoints, marineOverview, marineLayers] = await Promise.all([
    getMapSummaryResilient(),
    getCountryMapSummaryResilient(),
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
    getMarineLayersSafe(),
  ]);

  const marine = buildMarineHomeSummary(marineOverview, locale);
  const scope = marineScope(marinePoints);
  // ONE signal for the section's shape AND for the licence block below it: the notice travels
  // with the derived material, so it must appear exactly when a value does and never when
  // none does (`components/marine/marine-attribution.tsx`).
  const marineShowsValues = marineSummaryShowsValues(marine);

  /**
   * The card's single fact, rendered.
   *
   * The DECISIONS (null population ⇒ no row; null year ⇒ no year clause) live in
   * `featuredPopulationFact`, where the repo's node-environment harness can pin them; what is
   * left here is the part that genuinely needs the request — translating the key and
   * formatting the number in the render locale. The labels are the `ProvinceDetail` strings,
   * so a card and a detail page name the same number identically.
   */
  const populationFact = (population: number | null, year: number | null) => {
    const fact = featuredPopulationFact(population, year);
    if (fact === null) return undefined;
    return {
      label:
        fact.labelKey === "populationWithYear"
          ? tDetail("populationWithYear", { year: fact.year })
          : tDetail("population"),
      value: format.number(fact.population),
    };
  };

  // ONE instant for both rows, read once: two `new Date()` calls could straddle midnight and
  // put a "bugün" province row and a "bugün" country row from different days on one page.
  const now = new Date();

  const provinceCards: FeaturedCardItem[] = pickDailyProvinces(provinces, locale, now).map(
    (province) => ({
      id: province.plateCode,
      href: getPathname({
        locale,
        href: { pathname: "/turkiye/[slug]", params: { slug: province.slug } },
      }),
      name: province.name,
      meta: tRegions(province.region),
      fact: populationFact(province.population, province.populationYear),
    }),
  );

  const countryCards: FeaturedCardItem[] = pickDailyCountries(countries, locale, now).map(
    (country) => ({
      id: country.isoCode,
      href: getPathname({
        locale,
        href: { pathname: "/dunya/[slug]", params: { slug: country.slug } },
      }),
      name: country.name,
      meta: tContinents(country.continent),
      fact: populationFact(country.population, country.populationYear),
    }),
  );

  return (
    <div className="container page">
      <JsonLd schema={[websiteJsonLd(locale), organizationJsonLd()]} />

      <section className="hero">
        <h1>{t("heading")}</h1>
        <p className="lede">{t("lede")}</p>

        {/* Scope chips. Every number is COUNTED from the payload the page already fetched —
            a hardcoded "81 il" is a geography fact on the web side and would go quietly wrong
            the day the api's set changes. A count that came back zero prints no chip at all,
            and the LIST ITSELF is gated too: with the api unreachable at build all three are
            zero, and this page's rule everywhere else (FeaturedCards, SeaToday) is to render
            nothing rather than an empty shell. */}
        {(provinces.length > 0 || countries.length > 0 || scope.pointCount > 0) && (
          <ul role="list" className={styles.chips}>
            {provinces.length > 0 && (
              <li className="chip">{t("chipProvinces", { count: provinces.length })}</li>
            )}
            {countries.length > 0 && (
              <li className="chip">{t("chipCountries", { count: countries.length })}</li>
            )}
            {scope.pointCount > 0 && (
              <li className="chip">
                {t("chipMarine", { basins: scope.basinCount, points: scope.pointCount })}
              </li>
            )}
          </ul>
        )}

        <div className="hero-actions">
          <Link className="btn btn-primary" href="/turkiye">
            {t("ctaMap")}
          </Link>
          <Link className="btn btn-ghost" href="/hakkimizda">
            {t("ctaAbout")}
          </Link>
        </div>
      </section>

      {/* The two map hubs, as TWO navigational blocks rather than one (owner ruling, → DEC
          2026-08-05e; UX tour B19/Ç2). What is left of the section the Türkiye thumbnail used
          to head (→ DEC 2026-08-05b) used to be a single "Türkiye'nin illeri" heading with
          BOTH hub links stacked under it — so the world link sat under a Turkish-provinces
          title and belonged, as far as a reader could tell, to Türkiye. On a phone the reading
          order made it worse: map → il link → the heading → body → world link. Each corpus now
          owns its own heading, body and link, and the mobile order falls out correct with no
          extra rule.

          Two sibling `<h2>`s, not an `<h2>` + `<h3>`: these are two peer destinations, and the
          heading level is the page's OUTLINE, not a type scale (`SEO-POLICY.md` §B3.7). The
          world block is the quieter of the two — that is spacing, in
          `.exploreBlockSecondary`, not a demoted heading.

          Still inline here rather than a component, for the same reason the game band below
          is: no data, no props, no branch. `<Link>` takes the UNLOCALIZED route and the
          routing table localizes it — these are static hub paths, not slug routes, so nothing
          here needs `getPathname`. */}
      <section className="section" aria-labelledby="home-explore-heading">
        <h2 id="home-explore-heading">{t("mapHeading")}</h2>
        <p className={styles.exploreBody}>{t("mapBody")}</p>
        <p className={styles.exploreLink}>
          <Link href="/turkiye">{t("mapLinkLabel")}</Link>
        </p>
      </section>

      <section className={styles.exploreBlockSecondary} aria-labelledby="home-world-heading">
        <h2 id="home-world-heading">{t("worldHeading")}</h2>
        <p className={styles.exploreBody}>{t("worldBody")}</p>
        <p className={styles.exploreLink}>
          <Link href="/dunya">{t("worldLinkLabel")}</Link>
        </p>
      </section>

      <SeaToday summary={marine} scope={scope} />

      <FeaturedCards
        headingId="home-discover-provinces"
        heading={t("discoverProvinces")}
        items={provinceCards}
      />

      <FeaturedCards
        headingId="home-discover-countries"
        heading={t("discoverCountries")}
        items={countryCards}
      />

      {/* A COMPACT band, deliberately not the big empty card `/turkiye` uses: the UX review
          filed that pattern ("huge empty cards with a single button in them") as a defect, and
          repeating it on the homepage would be shipping a known fault. The game's own brand
          name is the one the game page uses — this surface invents no third name for it. */}
      <section className="section" aria-labelledby="home-game-heading">
        <div className={styles.gameBand}>
          <div>
            <h2 id="home-game-heading" className={styles.gameHeading}>
              {t("gameHeading")}
            </h2>
            <p className={styles.gameBody}>{t("gameBody")}</p>
          </div>
          <Link className="btn btn-primary" href="/oyun">
            {t("gameCta")}
          </Link>
        </div>
      </section>

      {/* The CBS tool hub's static internal link — `SEO-POLICY.md` §B8 8.1 asks every
          indexable page to be reachable from at least one, and the hub also sits in the header
          nav (→ DEC 2026-08-19g md.1). Two entrances rather than one is deliberate: the nav is
          a list of names, and this band is where the tool tier gets a sentence.

          The same `<section>` + `<h2>` + one-link pattern the two map bands above use, so it
          needs no CSS of its own. `<Link>` takes the UNLOCALIZED route and the routing table
          localizes it. */}
      <section className="section" aria-labelledby="home-tools-heading">
        <h2 id="home-tools-heading">{t("toolsHeading")}</h2>
        <p className={styles.exploreBody}>{t("toolsBody")}</p>
        <p className={styles.exploreLink}>
          <Link href="/araclar">{t("toolsCta")}</Link>
        </p>
      </section>

      {/* LAST on the page, and only when a derived value is actually shown above.
          ECMWF's terms say the notice "shall be attached" and offer no "or any similar notice"
          escape, and Copernicus Marine's attribution obligation travels with the derived
          material — so the block is the verbatim one `/deniz` and the 27 coastal province
          pages already render, never a homepage-sized paraphrase of it (inventing a shorter
          notice is a licence breach, not a UX improvement). It sits at the very bottom so the
          page's first impression is the product, not two screens of licence text. Moving this
          burden to a single "Kaynaklar" page is a real and better answer — it is a separate,
          queued editorial decision that must be taken for all three surfaces at once, and this
          page will inherit it. */}
      {marineShowsValues && (
        <MarineAttribution layers={marineLayers} headingId="home-marine-sources" />
      )}
    </div>
  );
}
