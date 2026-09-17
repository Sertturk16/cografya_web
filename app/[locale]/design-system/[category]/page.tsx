import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import { CATEGORIES, categoryBySlug } from "@/components/showcase/registry";
import { specimensFor } from "@/components/showcase/specimens";

interface PageProps {
  readonly params: Promise<{ locale: Locale; category: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

/**
 * A distinct `<title>` per category, and an explicit `noindex`.
 *
 * ## The title
 *
 * All eight routes used to share the generic site title, so eight tabs were indistinguishable
 * from one another — in a tool whose entire purpose is comparing things side by side. The
 * category name already exists in the registry; nothing here is hand-maintained.
 *
 * ## The robots directive, and why it is stated twice
 *
 * The parent layout already exports `robots: { index: false }`, and Next merges layout
 * metadata with a page's. Relying on that merge is fragile in one specific way that matters
 * right now: T-032 PR3 removes the V2 layout's blanket `noindex` and replaces it with the rule
 * "a route that must stay out of the index carries its own `surface: noindex`". A showcase of
 * internal tooling is not public content. Saying it per-route is what makes this route a
 * member of that rule rather than something that happens to inherit a directive.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const category = categoryBySlug(slug);
  if (category === undefined) return {};

  return buildMetadata({
    locale,
    surface: "noindex",
    // The object form, not the literal string: the string one would put "[category]" in the
    // canonical verbatim. The slug is identical in both locales, so no per-locale lookup.
    hrefForLocale: () => ({
      pathname: "/design-system/[category]",
      params: { category: slug },
    }),
    title: `${category.title} — Terra tasarım sistemi`,
    description: category.blurb,
  });
}

export default async function DesignSystemCategoryPage({ params }: PageProps) {
  const { locale, category: slug } = await params;
  setRequestLocale(locale);

  const category = categoryBySlug(slug);
  if (category === undefined) notFound();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-bold text-foreground">{category.title}</h1>
        <p className="max-w-prose text-muted-foreground">{category.blurb}</p>
      </header>
      <div className="space-y-12">{specimensFor(slug)}</div>
    </div>
  );
}
