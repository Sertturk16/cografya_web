import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2RichProse } from "@/components/v2/v2-rich-prose";
import { V2ContinentLocatorMap } from "@/components/v2/v2-continent-locator-map";
import { PageContainer } from "@/components/patterns/page-container";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getAllContinents, getContinentBySlug } from "@/lib/geo/continents";
import { CONTINENT_META } from "@/lib/map/continent-theme";
import { getCountryMapSummaryResilient } from "@/lib/api/countries";
import { FaqSection } from "@/components/patterns/faq-section";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  Mountain,
  Compass,
  MapPin,
  Users,
  Maximize2,
  Waves,
  Home,
  ChevronRight,
  Boxes,
  Building2,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { tr } from "@/lib/text/format-number";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export function generateStaticParams() {
  const continents = getAllContinents();
  return routing.locales.flatMap((locale) =>
    continents.flatMap((c) => [
      { locale, slug: c.slugTr },
      ...(c.slugEn !== c.slugTr ? [{ locale, slug: c.slugEn }] : []),
    ]),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const continent = getContinentBySlug(slug);
  if (!continent) return {};

  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => ({
      pathname: "/dunya/kita/[slug]",
      params: { slug: locale === "en" ? continent.slugEn : continent.slugTr },
    }),
    title:
      locale === "tr"
        ? // No ` | Coğrafya Gurmesi`: the root layout's `%s · Coğrafya Gurmesi` template adds it,
          // and the EN arm below never carried it — so the brand appeared twice in TR and once
          // in EN, from one title expression.
          `${continent.nameTr} Kıtası: Coğrafi Özellikleri, İklimi, Ülkeleri ve Haritası`
        : `${continent.nameEn} Continent: Geography, Climate, Countries and Map`,
    description:
      locale === "tr"
        ? `${continent.nameTr} kıtası coğrafi rehberi. ${continent.countryCount > 0 ? `${continent.countryCount} bağımsız ülke, ` : ""}${continent.areaFormattedTr} yüzölçümü, ${continent.populationFormattedTr} nüfus, ${continent.highestPoint.name} zirvesi ve fiziki coğrafya analizi.`
        : `${continent.nameEn} continent geography guide. Area, population, highest peaks and countries.`,
    openGraphType: "article",
  });
}

export default async function V2ContinentDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dunya");

  const continent = getContinentBySlug(slug);
  if (!continent) {
    notFound();
  }

  // Fetch all countries and filter for this continent
  const allCountries = await getCountryMapSummaryResilient();
  const continentCountries = allCountries.filter((c) => c.continent === continent.id);

  // Sort countries by population descending
  const sortedCountries = [...continentCountries].sort(
    (a, b) => (b.population ?? 0) - (a.population ?? 0),
  );

  const theme = CONTINENT_META[continent.id] ?? CONTINENT_META.AVRUPA!;
  const path = `/dunya/kita/${continent.slugTr}`;

  return (
    <>
      <V2LiveTicker />

      {/* HERO SECTION */}
      <section
        className={`relative isolate border-b border-border bg-gradient-to-b ${theme.identity.heroGradient} pt-8 pb-14 overflow-hidden`}
      >
        {/* Accent glow backdrop — DECORATION, bounded away from narrow viewports.
            `size-96` is 384px and `blur-3xl` spreads it further, so below `md` it is wider than
            the viewport and lands squarely on the continent badge row below. Unbounded it took
            the seven `--continent-*-text` members under the 4.5:1 floor the `HERO` column of
            `app/globals.css` records, which is the same bug `turkiye/bolge/[slug]`'s hero shipped.
            `hidden md:block` bounds the decoration instead of darkening seven data colours to
            survive it; `components/v2/continent-identity.test.ts` holds the bound.
            PAINTED PIXELS at 320px, badge label against its own backdrop, both themes:
            light 4.80 (Okyanusya) to 4.95 (Avrupa), dark 4.82 (Avrupa)
            to 5.50 (Antarktika). At 768, where the glow IS painted, 4.80-5.00 light and
            4.88-5.49 dark, so the bound is what the narrow widths needed and nothing more. */}
        <div
          className={`hidden md:block absolute -z-10 top-0 right-1/4 size-96 ${theme.identity.glow} rounded-full blur-3xl pointer-events-none`}
        />

        <PageContainer space="band">
          {/* Breadcrumb Navigation */}
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Dünya Atlası", href: "/dunya", path: "/dunya" },
              { label: "Kıtalar Atlası", href: "/dunya/kita", path: "/dunya/kita" },
              { label: `${continent.nameTr} Kıtası`, path },
            ]}
            locale={locale}
            surface="trOnly"
          />

          {/* Title & Badges */}
          <div className="space-y-3 max-w-3xl">
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              {continent.nameTr} Coğrafyası
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {continent.taglineTr}
            </p>
          </div>

          {/* QUICK FACTS GRID (KÜNYE) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Maximize2 className="size-3.5 text-primary" />
                <span>Yüzölçümü</span>
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground font-mono">
                {continent.areaFormattedTr}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Karalardaki payı %{tr(continent.areaSharePercent)}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Users className="size-3.5 text-secondary" />
                <span>Nüfus</span>
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground font-mono">
                {continent.populationFormattedTr}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {continent.populationSharePercent > 0
                  ? `Dünya nüfusundaki payı %${tr(continent.populationSharePercent)}`
                  : "Kalıcı yerleşim yok"}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Boxes className="size-3.5 text-accent" />
                <span>Ülke Sayısı</span>
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground font-mono">
                {continent.countryCount > 0 ? `${continent.countryCount} ülke` : "Ülke yok"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {continent.countryCountNoteTr ?? "Bağımsız devletler"}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Mountain className="size-3.5" />
                <span>En Yüksek Nokta</span>
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
                {continent.highestPoint.name}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {tr(continent.highestPoint.elevationM)} m
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <MapPin className="size-3.5" />
                <span>En Alçak Nokta</span>
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
                {continent.lowestPoint.name}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {tr(continent.lowestPoint.elevationM)} m
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Waves className="size-3.5" />
                <span>En Uzun Akarsu</span>
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
                {continent.longestRiver.name}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {tr(continent.longestRiver.lengthKm)} km
              </div>
            </div>
          </div>

          {/* THE METHODOLOGY NOTE, RE-HOMED. It used to ride into the old sources card as
              `regionalNote`, under a "Bölgesel Metodoloji & Yasal Dayanak" badge, in a block that
              also named five institutions this page cannot trace a figure to. The block is gone;
              the note is not a citation and never was. It says the figures are ours, rounded for
              teaching, and will not match any one institution — which is only useful where the
              reader can see the figures, so it sits directly under the künye grid whose area,
              population, summit and river values it describes, not thirteen sections below it. */}
          <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
            {t("continentFiguresNoteNamed", { name: continent.nameTr })}
          </p>
        </PageContainer>
      </section>

      {/* MAIN BODY CONTENT */}
      {/* `w-full min-w-0` is GONE, not just renamed. It fixed a flex-item bug: this div used to
          be a child of `min-h-screen … flex flex-col` (the page's own copy of the root layout's
          shell), so its default `min-width: auto` let it grow to its widest child's MIN-CONTENT
          width — 831 px, set by the comparison table — instead of the viewport's, and the
          table's own `overflow-x-auto` never engaged. That flex wrapper is deleted (it duplicated
          `(site)/layout.tsx`); `<main>` there is a plain block box, so a block child is never
          stretched to a flex sibling's min-content width in the first place — the bug's
          precondition is gone with the wrapper that caused it. Re-verified at 320 px after the
          change: 305 px document width, table still scrolling inside its own box. */}
      <PageContainer space="loose">
        {/* SECTION 1: INTRO PROSE & LOCATOR MAP */}
        <section id="giris-ve-harita" className="space-y-8">
          {/* Intro Lead */}
          <Card variant="panel" elevation="xs">
            <p className="text-base sm:text-lg text-foreground leading-relaxed font-normal">
              {continent.prose.introTr}
            </p>
          </Card>

          {/* Interactive World Locator Map */}
          <V2ContinentLocatorMap
            continentName={continent.nameTr}
            continentSlug={continent.slugTr}
            countries={continentCountries}
          />
        </section>

        {/* SECTION 2: COĞRAFİ KONUM VE SINIRLAR */}
        <section id="konum-ve-sinirlar" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Coğrafi Konumu ve Sınırları
            </h2>
          </div>

          <Card variant="panel" elevation="xs">
            <V2RichProse text={continent.prose.locationAndBordersTr} />
          </Card>
        </section>

        {/* SECTION 3: YERYÜZÜ ŞEKİLLERİ VE JEOLOJİK YAPI */}
        <section id="yeryuzu-sekilleri" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Yeryüzü Şekilleri ve Jeolojik Yapısı
            </h2>
          </div>

          <Card variant="panel" elevation="xs">
            <V2RichProse text={continent.prose.landformsAndGeologyTr} />
          </Card>
        </section>

        {/* SECTION 4: İKLİM VE DOĞAL BİTKİ ÖRTÜSÜ */}
        <section id="iklim-ve-bitki-ortusu" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              İklim ve Doğal Bitki Örtüsü
            </h2>
          </div>

          <Card variant="panel" elevation="xs">
            <V2RichProse text={continent.prose.climateAndVegetationTr} />
          </Card>
        </section>

        {/* SECTION 5: HİDROGRAFYA (AKARSULAR, GÖLLER VE DENİZLER) */}
        <section id="hidrografya" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Akarsular ve Göller
            </h2>
          </div>

          <Card variant="panel" elevation="xs">
            <V2RichProse text={continent.prose.hydrographyTr} />
          </Card>
        </section>

        {/* SECTION 6: NÜFUS DAĞILIMI VE YERLEŞME */}
        <section id="nufus-ve-yerlesme" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Nüfus ve Yerleşme
            </h2>
          </div>

          <Card variant="panel" elevation="xs">
            <V2RichProse text={continent.prose.populationAndSettlementTr} />
          </Card>
        </section>

        {/* SECTION 7: EKONOMİ VE DOĞAL KAYNAKLAR */}
        <section id="ekonomi-ve-kaynaklar" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {continent.id === "ANTARKTIKA"
                ? "Madencilik Yasağı, Turizm ve Balıkçılık"
                : "Ekonomi ve Doğal Kaynaklar"}
            </h2>
          </div>

          <Card variant="panel" elevation="xs">
            <V2RichProse text={continent.prose.economyAndResourcesTr} />
          </Card>
        </section>

        {/* SECTION 8: ALT BÖLGELER VE ÜLKELER DİZİNİ */}
        <section id="ulkeler-ve-bolgeler" className="space-y-6">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Kıtanın Alt Bölgeleri ve Ülkeleri
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {continent.prose.subregionsIntroTr}
            </p>
          </div>

          {/* Subregions Cards */}
          {continent.subregions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {continent.subregions.map((sub, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card p-5 space-y-2.5 shadow-2xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading font-bold text-base text-foreground">
                      {sub.nameTr}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {sub.descriptionTr}
                  </p>
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                      {continent.id === "ANTARKTIKA" ? "Araştırma üsleri" : "Örnek ülkeler"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sub.sampleCountriesTr.map((sc, i) => (
                        <span
                          key={i}
                          className="inline-block text-[11px] px-2 py-0.5 rounded-md bg-muted text-foreground font-medium"
                        >
                          {sc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All countries interactive directory */}
          {sortedCountries.length > 0 && (
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  <span>
                    {continent.nameTr} Ülkeleri ({sortedCountries.length})
                  </span>
                </h3>
                <span className="text-xs text-muted-foreground">En kalabalıktan başlayarak</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {sortedCountries.map((country) => (
                  <Link
                    key={country.isoCode}
                    href={{
                      pathname: "/dunya/[slug]",
                      params: { slug: country.slugTr },
                    }}
                    className="group rounded-2xl border border-border bg-card p-3 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9 */}
                      <img
                        src={`/flags/${country.isoCode.toUpperCase()}.svg`}
                        alt={`${country.nameTr} bayrağı`}
                        className="w-5 h-3.5 object-cover rounded-xs border border-border shadow-2xs shrink-0"
                      />
                      <span className="font-heading font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                        {country.nameTr}
                      </span>
                    </div>

                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      {country.statusLabelTr ? (
                        <div className="truncate font-medium">{country.statusLabelTr}</div>
                      ) : country.areaKm2 ? (
                        <div className="truncate font-mono">
                          {country.areaIsApproximate ? "≈" : ""}
                          {new Intl.NumberFormat("tr-TR").format(country.areaKm2)} km²
                        </div>
                      ) : null}
                      {country.population ? (
                        <div className="font-mono">
                          {new Intl.NumberFormat("tr-TR").format(country.population)} kişi
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                      <span>İncele</span>
                      <ArrowUpRight className="size-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 9: DOĞAL AFETLER, SİSMİK KUŞAKLAR VE ÇEVRE RİSKLERİ */}
        <section id="dogal-afetler" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Doğal Afetler ve Çevre Sorunları
            </h2>
          </div>

          <Card variant="panel" space="6" elevation="xs">
            <V2RichProse text={continent.prose.disasterAndEnvironmentTr} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-destructive" />
                  <span>Başlıca tehlikeler</span>
                </span>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {continent.disasterProfile.primaryRisks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-destructive font-bold">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Compass className="size-3.5 text-primary" />
                  <span>Faylar ve levha sınırları</span>
                </span>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {continent.disasterProfile.faultLinesOrZones.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 10: TARİHİ VE KÜLTÜREL COĞRAFYA */}
        <section id="tarihi-cografya" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Tarihi ve Kültürel Coğrafya
            </h2>
          </div>

          <Card variant="panel" elevation="xs">
            <V2RichProse text={continent.prose.historicalAndCulturalTr} />
          </Card>
        </section>

        {/* SECTION 11: SIKÇA SORULAN SORULAR (FAQ). Markup and schema from one `continent.faqs`
            identifier, in one place, instead of a `<JsonLd>` at the foot of the file. `"trOnly"`
            is this page's own surface constant.

            TR-ONLY UNTIL T-040 (owner, 2026-09-19). These questions are Turkish literals with no
            English counterpart, so the EN twin was rendering Turkish prose under English chrome.
            `structuredData="trOnly"` already withheld the FAQPage schema there — the markup was
            the gap. Gating the whole component keeps both halves moving together: no component,
            no schema. */}
        {locale === "tr" && (
          <FaqSection
            heading={`${continent.nameTr} Hakkında Sıkça Sorulan Sorular`}
            locale={locale}
            items={continent.faqs}
            structuredData="trOnly"
          />
        )}

        {/* SECTION 12: DİĞER KITALAR GEZİNTİSİ */}
        <section id="diger-kitalar" className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-sm text-foreground">Diğer Kıtalar</span>
            <Link
              href="/dunya/kita"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>Tüm Kıtalar</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {getAllContinents()
              .filter((c) => c.id !== continent.id)
              .map((other) => (
                <Link
                  key={other.id}
                  href={{
                    pathname: "/dunya/kita/[slug]",
                    params: { slug: other.slugTr },
                  }}
                  className="group rounded-2xl border border-border bg-card p-3 hover:border-primary/50 transition-all text-center space-y-1 block"
                >
                  <div className="font-heading font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                    {other.nameTr}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {other.areaFormattedTr}
                  </div>
                </Link>
              ))}
          </div>
        </section>

        {/* NO SOURCES SECTION. The continent figures come from `lib/geo/continents.ts`, a
            hand-written registry; this page reads no api and the one map it draws
            (`V2ContinentLocatorMap`) credits Natural Earth itself, in the line under the map,
            more precisely than a card at the foot of the page could. The other four entries in
            the `dunya` list — the UN & World Bank, the CIA World Factbook, USGS/NASA, IHO
            GEBCO — were traceable to nothing here. T-088 later removed the card site-wide.

            `Dunya.continentFiguresNoteNamed` was the one thing in that block worth keeping and
            was never a citation; it now renders under the künye grid in the hero, beside the
            figures it is about. Still from the catalogue, because `/en/` reaches this surface. */}
      </PageContainer>
    </>
  );
}
