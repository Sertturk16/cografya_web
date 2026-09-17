import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { H1, H2, Lede } from "@/components/patterns/typography";

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

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20">
        <Breadcrumb className="text-xs">
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/" />}>
                <Home className="size-3.5" aria-hidden="true" />
                <span>{tb("home")}</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold">{t("heading")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

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
            <p className="max-w-prose leading-relaxed">{t("aboutCurriculum")}</p>
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
              href="mailto:info.cografyagurmesi@gmail.com"
              className="inline-flex max-w-full items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-muted"
            >
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-all">info.cografyagurmesi@gmail.com</span>
            </a>
          </section>

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
        </article>
      </div>
    </>
  );
}
