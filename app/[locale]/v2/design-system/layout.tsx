import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/v2/theme-toggle";
import { CATEGORIES } from "@/components/showcase/registry";

export const metadata: Metadata = {
  // Internal tooling. The V1 page this replaces had no generateMetadata at all and was
  // therefore technically indexable; that is fixed here.
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
        <nav aria-label="Tasarım sistemi bölümleri" className="lg:w-56 lg:shrink-0">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={"/v2/design-system" as never}
              className="font-heading text-lg font-bold text-foreground"
            >
              Terra
            </Link>
            <ThemeToggle />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Tasarım sistemi</p>
          <ul role="list" className="mt-4 space-y-1">
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/v2/design-system/${category.slug}` as never}
                  className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {category.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* A plain div, not <main>: `app/[locale]/layout.tsx` already wraps children in
            `<main id="main-content">`, and nesting a second one is invalid HTML and breaks
            the skip link's landmark. T-032 consolidates that root layout; until then,
            nothing under it may add a second <main>. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
