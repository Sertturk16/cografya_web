import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";

// Same `LayoutProps` shape as `(site)/layout.tsx`: no `readonly`, `locale` a plain string.
interface EmbedLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Header-only chrome for pages whose whole body is one embedded third-party surface.
 *
 * The header, the skip link and the single `<main>` live here; there is no footer, because
 * the frame is meant to fill everything under the header. The page is exactly one viewport
 * tall (`h-dvh`) and `<main>` takes what the header leaves, so the frame never makes the
 * document scroll and the embedded app keeps its own gestures (drag, pinch) to itself.
 *
 * Membership is a matter of directory, the same way `(site)` and `(play)` work: a page in
 * here gets this chrome without importing it.
 */
export default async function EmbedLayout({ children, params }: EmbedLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Common");

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:font-semibold focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>
      <V2Header />
      <main id="main-content" tabIndex={-1} className="relative min-h-0 flex-1">
        {children}
      </main>
    </div>
  );
}
