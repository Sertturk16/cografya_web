import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

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

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <div className="container page">
      <JsonLd schema={[websiteJsonLd(locale), organizationJsonLd()]} />

      <section className="hero">
        <h1>{t("heading")}</h1>
        <p className="lede">{t("lede")}</p>
        {/* The map now lives ONLY on the dedicated `/turkiye` hub (IA restructure →
            DEC 2026-07-13). The hero's primary button is the SINGLE in-page path there
            — a second CTA to the identical destination was cut as redundant (PR#10
            review M2, owner-confirmed). */}
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/turkiye">
            {t("ctaMap")}
          </Link>
          <Link className="btn btn-ghost" href="/hakkimizda">
            {t("ctaAbout")}
          </Link>
        </div>
      </section>
    </div>
  );
}
