import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import styles from "./en-work-in-progress-notice.module.css";

/**
 * The visible "this English page is not finished" notice (→ DEC 2026-08-04i §4).
 *
 * ## Which pages get it, and why exactly those
 *
 * It belongs on the `"trNarrative"` surface and nowhere else — today `/en/turkiye/[slug]`,
 * `/en/dunya/[slug]` and `/en/sea` (`lib/seo/indexing.ts` defines the set and the reason).
 * Those are the pages whose SUBSTANCE exists in Turkish only: the api's narrative fields and
 * the hand-written marine explainers are all TR, so the English rendering is chrome around a
 * fact sheet. The UX tour measured the gap rather than guessing at it — EN Rize is ~59 KB of
 * text against TR Van's ~103 KB, with all five narrative sections and the climate chart
 * absent (B5).
 *
 * It is deliberately NOT on `/en` or `/en/about`, which are `"localized"`: those carry real,
 * hand-written English copy, and telling a reader that a finished page is unfinished is its
 * own kind of dishonesty. `/en/about` being thin is a separate content question (tour Ö4),
 * not a translation-status question.
 *
 * ## Why a notice rather than hiding the locale
 *
 * The ruling is explicit that the switcher stays and is not hidden. These pages are already
 * `noindex, follow` (the scaled-content guard, same file), so the notice is not an SEO
 * device — it is the honest thing to tell the reader who is standing on the page. It renders
 * as server HTML like everything else; no client island, no layout shift.
 *
 * Returns `null` on Turkish, so every call site is one unconditional line.
 */
export async function EnWorkInProgressNotice({ locale }: { locale: Locale }) {
  if (locale !== "en") return null;

  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    // `lang` is NOT set: the surrounding document is already `lang="en"` on these pages, and
    // re-declaring it would be noise. The role is a plain note, not an `alert` — nothing has
    // gone wrong and nothing changed dynamically, so interrupting AT would be wrong (the
    // PR #3 lesson about iconography reading as an unintended signal, applied to roles).
    <p className={styles.notice}>{t("enWorkInProgress")}</p>
  );
}
