import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { EN_CONTENT_READY } from "@/lib/seo/indexing";

/**
 * The honesty notice V1 shows English readers on its Turkish-substance pages, ported to V2.
 *
 * GATED ON `EN_CONTENT_READY`, not only on the locale. That flag already decides whether a
 * `trNarrative` surface is indexable in English (`lib/seo/indexing.ts`); binding the notice to
 * the same flag means the claim the page makes to a reader and the claim it makes to a crawler
 * cannot disagree, and flipping the flag retires the notice everywhere at once instead of
 * leaving seven call sites to be found by hand.
 *
 * `role` is deliberately absent: nothing has gone wrong and nothing changed dynamically, so an
 * alert role would interrupt assistive technology for a plain note. `lang` is not set either —
 * the surrounding document is already `lang="en"` on every page that renders this.
 *
 * Returns `null` on Turkish and once EN ships, so every call site stays one unconditional line.
 */
export async function V2EnWorkInProgressNotice({ locale }: { readonly locale: Locale }) {
  if (locale !== "en" || EN_CONTENT_READY) return null;

  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{t("enWorkInProgress")}</span>
    </p>
  );
}
