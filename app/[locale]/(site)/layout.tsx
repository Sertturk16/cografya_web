import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2AuthDialog } from "@/components/v2/v2-auth-dialog";

// No `readonly` and no local `Locale`: Next.js 16 generates a global `LayoutProps<"/route">`
// whose `children` is mutable and whose `locale` is a plain `string`. A stricter local shape
// fails the generated constraint — the same reason `app/[locale]/layout.tsx` uses this form.
interface SiteLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * The chrome every reading surface shares.
 *
 * Header, footer, the skip link and the single `<main>` live here rather than in 30 page
 * files. Before this, `V2Header` and `V2Footer` — which take no props — were copied into 37
 * and 35 pages respectively; two omitted the footer by apparent oversight, and 24 rendered
 * their own `<main>` inside the root layout's, nesting the landmark. A page can no longer
 * ship without the chrome, and it can no longer ship with two of it.
 *
 * The three fullscreen game screens opt out by living in the sibling `(play)` group — a
 * structural choice of directory, not an omitted import somebody has to remember. The design
 * system showcase is in neither group: it is internal tooling that brings its own full-page
 * chrome, so it sits directly under `[locale]` and takes only the document shell.
 */
export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Common");

  return (
    <div className="flex min-h-screen flex-col justify-between bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:font-semibold focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>
      <div>
        <V2Header />
        {/* tabIndex={-1} makes the skip-link target programmatically focusable so AT focus
            actually moves here on activation — Safari/VoiceOver do not focus a plain id
            target otherwise. Carried over from the V1 root layout unchanged. */}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <V2Footer />
      {/* Mounted once for the whole reading surface; renders nothing until a gated action
          opens it. It does not belong in the root layout, because the play screens have no
          auth affordances to open it from. */}
      <V2AuthDialog />
    </div>
  );
}
