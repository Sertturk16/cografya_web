import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES } from "@/components/showcase/registry";
import { ArrowRight } from "lucide-react";

interface PageProps {
  readonly params: Promise<{ locale: Locale }>;
}

export default async function DesignSystemIndexPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
          Terra tasarım sistemi
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Her bileşen iki temada yan yana gösterilir. Sağdaki panel bir{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.dark</code> sarmalayıcısının
          içindedir, yani tema düğmesine dokunmadan koyu hâli görülebilir.
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">
          İçeriğini <code className="rounded bg-muted px-1 py-0.5 text-xs">document.body</code>
          &apos;ye taşıyan bileşenler (Dialog, Sheet, Popover, Tooltip, toast) bu sarmalayıcının
          dışında render olur ve sayfanın genel temasını alır; onlar için tema düğmesini kullanın.
          İlgili örneklerin altında bu not ayrıca yazar.
        </p>
      </header>

      <ul role="list" className="grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/v2/design-system/${category.slug}` as never}
              className="group flex h-full flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
            >
              <div className="space-y-1.5">
                <h2 className="font-heading text-lg font-bold text-foreground">{category.title}</h2>
                <p className="text-sm text-muted-foreground">{category.blurb}</p>
              </div>
              <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                {category.components.length} bileşen
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
