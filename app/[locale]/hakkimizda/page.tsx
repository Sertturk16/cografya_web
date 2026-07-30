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
    </div>
  );
}
