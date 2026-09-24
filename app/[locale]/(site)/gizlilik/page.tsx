import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Home, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import { LEGAL_CONTROLLER } from "@/lib/legal/controller";
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { H1, H2, Lede } from "@/components/patterns/typography";
import { PageContainer } from "@/components/patterns/page-container";
import { LegalControllerIdentity } from "@/components/v2/legal-controller-identity";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";

interface PrivacyPageProps {
  params: Promise<{ locale: Locale }>;
}

interface Recipient {
  readonly name: string;
  readonly role: string;
  readonly location: string;
}

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/gizlilik",
    title: t("metaTitle"),
    description: t("metaDescription"),
    surface: "trOnly",
  });
}

/**
 * `/gizlilik` · `/en/privacy` (T-101) — the KVKK aydınlatma metni, on its own page. Structure
 * follows Rehber Matematik's `/kvkk`; the marketing-consent wording follows Ferrum's privacy
 * policy (owner ruling). Every fact is this site's: the retention periods are the table in
 * `cografya_api/docs/architecture.md` "Data retention", and change with it.
 *
 * The controller block renders `LEGAL_CONTROLLER`, which omits fields the owner has not filled
 * yet, so this page never states a placeholder as an address.
 *
 * `surface: "trOnly"` for the reason the terms page records: a Turkish legal text with an
 * English rendering for reading, not an indexable translation. No `JsonLd`, likewise.
 */
export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  const tb = await getTranslations("Breadcrumb");

  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: tb("home"), href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: t("heading"), path: "/gizlilik" },
  ];

  const list = (key: string) => t.raw(key) as string[];
  const recipients = t.raw("recipients") as Recipient[];

  return (
    <PageContainer space="tight">
      <Breadcrumbs items={breadcrumbItems} locale={locale} surface="trOnly" />

      <article className="mt-8 max-w-3xl space-y-12">
        <header className="space-y-4">
          <H1>{t("heading")}</H1>
          <Lede>{t("lede")}</Lede>
          <p className="text-sm text-muted-foreground">{t("updated")}</p>
          <V2EnWorkInProgressNotice locale={locale} />
          {locale === "en" && (
            <p className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t("authoritative")}
            </p>
          )}
        </header>

        <section className="space-y-4">
          <H2>{t("controllerHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("controllerBody")}</p>
          <LegalControllerIdentity
            labels={{
              siteName: t("controllerLabels.siteName"),
              legalName: t("controllerLabels.legalName"),
              address: t("controllerLabels.address"),
              phone: t("controllerLabels.phone"),
              email: t("controllerLabels.email"),
            }}
          />
        </section>

        <section className="space-y-4">
          <H2>{t("dataHeading")}</H2>
          <BulletList items={list("dataItems")} />
        </section>

        <section className="space-y-4">
          <H2>{t("methodHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("methodBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("purposesHeading")}</H2>
          <BulletList items={list("purposesItems")} />
        </section>

        <section className="space-y-4">
          <H2>{t("legalHeading")}</H2>
          <BulletList items={list("legalItems")} />
        </section>

        <section className="space-y-4">
          <H2>{t("recipientsHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("recipientsIntro")}</p>
          <ul className="max-w-prose space-y-3">
            {recipients.map((recipient) => (
              <li
                key={recipient.name}
                className="rounded-2xl border border-border bg-card px-4 py-3 leading-relaxed"
              >
                <span className="block font-semibold text-foreground">
                  {recipient.name}
                  <span className="font-normal text-muted-foreground"> · {recipient.location}</span>
                </span>
                <span className="block text-sm text-muted-foreground">{recipient.role}</span>
              </li>
            ))}
          </ul>
          <p className="max-w-prose leading-relaxed">{t("recipientsAuthorities")}</p>
          <p className="max-w-prose leading-relaxed">{t("abroadBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("publicHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("publicBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("retentionHeading")}</H2>
          <BulletList items={list("retentionItems")} />
        </section>

        <section className="space-y-4">
          <H2>{t("minorsHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("minorsBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("cookiesHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("cookiesBody")}</p>
        </section>

        <section className="space-y-4">
          <H2>{t("rightsHeading")}</H2>
          <BulletList items={list("rightsItems")} />
        </section>

        <section className="space-y-4">
          <H2>{t("applyHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("applyBody")}</p>
          {/* Same shape and the same 320px rationale as the address on `/hakkimizda`: an
              `inline-flex` box does not shrink, so the span is what breaks. */}
          <a
            href={`mailto:${LEGAL_CONTROLLER.email}`}
            className="inline-flex max-w-full items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-muted"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">{LEGAL_CONTROLLER.email}</span>
          </a>
        </section>

        <section className="space-y-4">
          <H2>{t("selfServiceHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("selfServiceBody")}</p>
          <Link
            href="/hesabim/ayarlar"
            className="inline-block font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {t("settingsLink")}
          </Link>
        </section>

        <section className="space-y-4">
          <H2>{t("changesHeading")}</H2>
          <p className="max-w-prose leading-relaxed">{t("changesBody")}</p>
        </section>
      </article>
    </PageContainer>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="max-w-prose list-disc space-y-2 pl-5 leading-relaxed marker:text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
