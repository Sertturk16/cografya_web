import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home, Mail } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { H1, H2, Lede } from "@/components/patterns/typography";
import { PageContainer } from "@/components/patterns/page-container";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";
import { PRIVACY_FRAGMENT } from "@/lib/legal/terms-anchor";

interface TermsPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/kullanim-sartlari",
    title: t("metaTitle"),
    description: t("metaDescription"),
    surface: "trOnly",
  });
}

/**
 * `/kullanim-sartlari` · `/en/terms` (T-073) — the platform's terms of use, with the KVKK
 * section inside them rather than on a page of its own.
 *
 * ONE PAGE, TWO LINKS. The register card's consent line names "Kullanım Şartları" and
 * "Gizlilik Politikası" separately, which is what a reader expects to read, and both land
 * here: the second on {@link PRIVACY_FRAGMENT}. Two routes would mean two legal texts to keep
 * in step, and the privacy half of a platform this size is one section, not a document.
 *
 * `surface: "trOnly"`, and that is a deliberate choice rather than the EN-content default.
 * This is a Turkish legal text governed by Turkish law; the English rendering below exists so
 * an English-reading member can follow what they agreed to, and it says in its own line which
 * of the two binds. An indexable translation of a contract is a claim this project is not in
 * a position to make.
 *
 * NO `JsonLd`. The SEO rule asks for structured data on indexable pages, and a terms page has
 * no schema.org type that says anything true about it — `WebPage` with no distinguishing
 * property is markup for its own sake.
 */
export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Terms");
  const tb = await getTranslations("Breadcrumb");

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: tb("home"), href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: t("heading"), path: "/kullanim-sartlari" },
  ];

  return (
    <PageContainer space="tight">
      <Breadcrumbs items={breadcrumbItems} locale={locale} surface="trOnly" />

      <article className="mt-8 max-w-3xl space-y-12">
        <header className="space-y-4">
          <H1>{t("heading")}</H1>
          <Lede>{t("lede")}</Lede>
          {/* A plain date string, not a formatted `Date`: nothing here is derived from a
              clock, and T-064's whole lesson is that a reader-facing date rendered at runtime
              is a date rendered in the runtime's time zone. */}
          <p className="text-sm text-muted-foreground">{t("updated")}</p>
          <V2EnWorkInProgressNotice locale={locale} />
          {locale === "en" && (
            <p className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t("authoritative")}
            </p>
          )}
        </header>

        <section className="space-y-4">
          <H2>{t("scopeHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("scopeBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("membershipHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("membershipBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("ipHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("ipBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("fairUseHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("fairUseBody")}</p>
        </section>

        {/* `scroll-mt-*` for the same reason `/hakkimizda`'s source colophon carries it: this
            is a link target, and the sticky header would otherwise cover the heading the
            reader was sent to. */}
        <section id={PRIVACY_FRAGMENT} className="scroll-mt-24 space-y-4">
          <H2>{t("kvkkHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("kvkkBody1")}</p>
          <p className="max-w-prose leading-relaxed">{t("kvkkBody2")}</p>
          <p className="max-w-prose leading-relaxed">{t("kvkkBody3")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("changesHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("changesBody")}</p>
          {/* The same address, the same shape and the same 320px rationale as the one on
              `/hakkimizda`: an `inline-flex` box does not shrink, so the span is what breaks. */}
          <a
            href="mailto:info@cografyagurmesi.com"
            className="inline-flex max-w-full items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-muted"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">info@cografyagurmesi.com</span>
          </a>
        </section>
      </article>
    </PageContainer>
  );
}
