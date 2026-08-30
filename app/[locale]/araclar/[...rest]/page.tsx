import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale; rest: string[] }>;
}

/**
 * The tool tier's 404 BOUNDARY, not a tool (fix round, İRİS post-merge live-audit finding
 * A1). `/araclar` has exactly three static children (`tool-registry.ts`, Atlas ruling V-1 —
 * four static routes rather than one `[slug]` route, specifically so no page ever has to
 * "remember" to call `notFound()`). That ruling's own reasoning had an unmeasured premise:
 * with no dynamic segment anywhere under `/araclar`, an unknown path there matched NO route
 * at all, so Next never reached ANY `not-found.tsx` boundary — not even the branded,
 * locale-aware one this repo already ships at `app/[locale]/not-found.tsx` — and fell to
 * Next's own unstyled, unlocalized default 404 instead (confirmed empirically: curled HTML
 * carried `<html>` with no `lang` attribute, no header/footer/Terra chrome, and the literal
 * string "This page could not be found." even on the TR route). Next's docs are explicit that
 * only a ROOT `app/not-found.js` (this repo has none — `app/[locale]/layout.tsx` IS the root
 * layout in this next-intl setup, so adding a true root-level one would mean inventing a
 * second, parallel `<html>/<body>` shell the site has never needed) handles a genuinely
 * unmatched URL; a NESTED `not-found.tsx` like the one this repo already has only fires when
 * `notFound()` is thrown from within a MATCHED segment.
 *
 * This catch-all is exactly that missing matched segment — the same shape
 * `/turkiye/[slug]` and `/dunya/[slug]` already use for an unknown slug — so any path under
 * `/araclar/*` that is not one of the three real tools now matches HERE, calls `notFound()`,
 * and bubbles to the SAME existing branded `app/[locale]/not-found.tsx`, correctly localized
 * (`setRequestLocale` below is what makes that boundary's locale-less `getTranslations()` call
 * resolve the right language — the exact mechanism `turkiye/[slug]`'s own unknown-slug path
 * already relies on, copied here rather than invented).
 *
 * Next's router always prefers a more specific (static) segment over a catch-all one, so this
 * does not shadow `/araclar/mesafe-olcme`, `/araclar/koordinat-bulma` or
 * `/araclar/alan-hesaplama` — proven by keeping every existing tool-tier test green, not
 * merely assumed.
 *
 * No `generateStaticParams`: this route legitimately has no finite set of valid params (every
 * value it can ever receive is invalid by definition), so it is intentionally left dynamic —
 * `dynamicParams` defaults to `true`, exactly like the unknown-slug branch of `/turkiye/[slug]`
 * and `/dunya/[slug]`, which also carry no entry for an invalid slug. A 404 response is never
 * indexed, so this costs nothing against the SSG/CWV budget (`ENGINEERING.md` §3).
 *
 * `lib/tools/tool-registry.test.ts` and `lib/tools/tool-sitemap.test.ts` both discover tool
 * pages by scanning `app/[locale]/araclar/` — both now explicitly skip this directory (it is a
 * dynamic segment, never a tool: no real tool pathname is anything but
 * `[a-z0-9-]+`, `tool-registry.test.ts`'s own transliteration guard).
 */
export default async function ToolsCatchAll({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
