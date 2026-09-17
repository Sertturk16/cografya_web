import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES, categoryBySlug } from "@/components/showcase/registry";
import { specimensFor } from "@/components/showcase/specimens";

interface PageProps {
  readonly params: Promise<{ locale: Locale; category: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
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
