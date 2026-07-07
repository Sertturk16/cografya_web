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
      <p className="lede">{t("body1")}</p>
      <p>{t("body2")}</p>
    </div>
  );
}
