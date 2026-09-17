import { Home } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Specimen } from "../specimen";

/**
 * The REAL `Breadcrumbs` — deliberately a separate file from `duzen.tsx`, and deliberately not
 * `"use client"`.
 *
 * `duzen.tsx`'s own "BreadcrumbsNav" specimen (review round 1's finding) renders
 * `BreadcrumbsNav`, the client-safe half, because `duzen.tsx` is a Client Component and
 * `Breadcrumbs` — the SERVER half, gated JSON-LD included — cannot be rendered from one; that
 * is the whole point of the split. `registry.test.ts`'s "rendered by a specimen" check used to
 * pass for the `"breadcrumbs"` entry anyway, but only because `<BreadcrumbsNav` happens to
 * contain the substring `<Breadcrumbs` — a prefix collision the test could not tell from a real
 * demonstration. `Breadcrumbs` itself was shown nowhere.
 *
 * This closes that gap for real rather than patching the collision alone: `components/showcase/
 * specimens/index.tsx` is a Server Component (no `"use client"`), so it can render the genuine
 * article, JSON-LD included — or, on this route, JSON-LD deliberately absent, which is itself
 * the second half of what this specimen demonstrates. `/design-system` is `surface: "noindex"`
 * end to end (`registry.test.ts`'s own "declares its own noindex surface" assertion on both
 * route files), so `isIndexable(locale, "noindex")` is `false` for every locale
 * (`lib/seo/indexing.ts`) and `Breadcrumbs` emits no `<script type="application/ld+json">` here
 * — proof, on the page itself, that an internal tool does not leak structured data it has no
 * business publishing.
 */
export function BreadcrumbsServerSpecimen({ locale }: { locale: Locale }) {
  return (
    <Specimen
      name="Breadcrumbs"
      description={`\`components/patterns/breadcrumbs.tsx\`'in sunucu bileşeni: \`BreadcrumbsNav\`'ı sarar ve eşleşen \`BreadcrumbList\` JSON-LD'sini \`isIndexable(locale, surface)\` ile kapılar. Bu sayfa uçtan uca \`surface: noindex\` taşıdığından JSON-LD burada HİÇ üretilmez — görünüm \`BreadcrumbsNav\` özeti ile birebir aynıdır, fark sayfa kaynağında <script type="application/ld+json"> etiketinin yokluğudur.`}
    >
      <Breadcrumbs
        items={[
          { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
          { label: "Türkiye", href: "/turkiye", path: "/turkiye" },
          { label: "Çanakkale", path: "/turkiye/canakkale" },
        ]}
        locale={locale}
        surface="noindex"
      />
    </Specimen>
  );
}
