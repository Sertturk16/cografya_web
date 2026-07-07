import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { findProvinceBySlug, placeholderProvinces } from "@/lib/geo/placeholder-provinces";
import { administrativeAreaJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

// SSG the placeholder set; unknown slugs fall through to notFound() (never a
// soft-200), per CONVENTIONS §6 #6. Slug is the LOCALIZED slug per locale.
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    placeholderProvinces.map((province) => ({
      locale,
      slug: province.slug[locale],
    })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const province = findProvinceBySlug(locale, slug);
  if (!province) return {};

  const t = await getTranslations({ locale, namespace: "ProvinceDetail" });
  const name = province.name[locale];

  return buildMetadata({
    locale,
    // localized-slug alternates: slug_tr for tr, slug_en for en.
    hrefForLocale: (l) => ({
      pathname: "/il/[slug]",
      params: { slug: province.slug[l] },
    }),
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
    openGraphType: "article",
  });
}

export default async function ProvinceDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const province = findProvinceBySlug(locale, slug);
  if (!province) {
    notFound();
  }

  const t = await getTranslations("ProvinceDetail");
  const tb = await getTranslations("Breadcrumb");
  const tp = await getTranslations("Provinces");
  const name = province.name[locale];
  const selfHref = {
    pathname: "/il/[slug]",
    params: { slug: province.slug[locale] },
  } as const;
  const path = getPathname({ locale, href: selfHref });

  return (
    <div className="container page">
      <JsonLd schema={administrativeAreaJsonLd({ name, path, locale })} />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tp("heading"), href: "/iller" },
          { label: name, href: selfHref },
        ]}
      />
      <h1>{t("heading", { name })}</h1>
      <p className="placeholder-note">
        <span className="chip">placeholder</span> {t("placeholderBody", { name })}
      </p>
      <p className="section">
        <Link href="/iller">← {t("backToProvinces")}</Link>
      </p>
    </div>
  );
}
