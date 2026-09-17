import "./globals.css";

/**
 * ROOT 404 — the boundary for a URL that matches no route at all.
 *
 * Next resolves an unmatched URL against the ROOT not-found only; a nested
 * `app/[locale]/not-found.tsx` fires exclusively when `notFound()` is thrown from inside a
 * MATCHED segment. Without this file such a URL falls to Next's own unstyled, unlocalized
 * default page — the defect `app/[locale]/araclar/[...rest]/page.tsx` was added to work
 * around for one subtree. This file replaces that pattern for every subtree at once.
 *
 * It renders outside `app/[locale]/layout.tsx`, so it supplies its own `<html>`/`<body>`.
 *
 * DELIBERATELY BILINGUAL AND STATIC. Resolving a locale here means a request read, which in
 * this SSG setup flips the statically-prerendered route that threw `notFound()` from static
 * to dynamic at runtime and 500s instead of returning 404 — the regression
 * `app/[locale]/not-found.tsx` already documents. Showing both languages is the honest
 * alternative and costs nothing at build time.
 *
 * The fonts are NOT loaded here. `lib/fonts.ts` attaches its CSS variables through the locale
 * layout, which never runs for this page; the body stack falls back to the system sans in
 * `--font-body`, which is correct rather than a missing feature.
 */
export default function RootNotFound() {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/*
         * The theme class, applied before first paint.
         *
         * `ThemeProvider` is mounted by the locale layout, which never runs for this page, so
         * without this the 404 would always render light — a white flash for every reader who
         * chose dark, on the one page that is already a small unpleasant surprise.
         *
         * This reads the SAME `storageKey` next-themes is configured with and mirrors its
         * `defaultTheme="system"`. The duplication is deliberate and bounded: pulling in the
         * provider would make this page a client component and give it a request-reading
         * dependency, which is exactly what the docblock above says it must not have. The two
         * copies cannot drift unnoticed — `components/root-not-found.test.ts` pins the key
         * against `components/theme-provider.tsx`.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      {/*
       * PLAIN ANCHORS, DELIBERATELY. `@next/next/no-html-link-for-pages` wants `next/link`
       * here, and `CLAUDE.md` forbids importing `Link` from there — every link in this repo
       * comes from `@/i18n/navigation`. Neither is usable on this page: it renders outside
       * `app/[locale]/layout.tsx`, so the routing-aware `Link` has no next-intl config to
       * read, and a client-side transition has nothing to transition from. A full navigation
       * is what a 404 wants anyway.
       */}
      {/* eslint-disable @next/next/no-html-link-for-pages */}
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-5 py-16">
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">404</p>
            <h1 className="font-heading text-3xl font-bold">Sayfa bulunamadı</h1>
            <p className="text-muted-foreground">
              Aradığınız adres taşınmış veya hiç var olmamış olabilir.
            </p>
            <a
              href="/"
              className="inline-block font-semibold text-primary underline underline-offset-4"
            >
              Ana sayfaya dön
            </a>
          </div>

          <hr className="border-border" />

          <div className="space-y-3">
            <h2 className="font-heading text-2xl font-bold">Page not found</h2>
            <p className="text-muted-foreground">
              The address you requested may have moved, or may never have existed.
            </p>
            <a
              href="/en"
              className="inline-block font-semibold text-primary underline underline-offset-4"
            >
              Back to the homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
