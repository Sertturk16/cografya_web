import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  AREA_TOOL,
  COORDINATE_TOOL,
  DISTANCE_TOOL,
  TOOL_HUB_PATHNAME,
} from "@/lib/tools/tool-registry";
import { NavGroupDisclosure } from "./nav-group-disclosure";
import styles from "./site-nav.module.css";

/**
 * The header nav's "Araçlar" dropdown group (finding 8b, `Owner's Inbox/anasayfa-yenileme/
 * plan.md` §5.7b) — a SEPARATE small server component from `site-nav.tsx`, not a section of
 * it, and that split is deliberate rather than incidental.
 *
 * ## Why this is its own file
 *
 * The three tool names are reused VERBATIM from `Tools.hub.mesafeName`/`koordinatName`/
 * `alanName` — already bilingual, already the exact strings `/araclar` and the homepage's own
 * `components/home/tool-cards.tsx` render for the same three tools, so no new copy is
 * authored for them. But `components/site-nav/messages.test.ts` enforces that any file which
 * opens the `Nav` namespace opens ONLY `Nav` (`toEqual(["Nav"])`) — a real, load-bearing
 * invariant that stops a typo'd second namespace request from silently resolving to a literal
 * key path in the header's primary landmark. `site-nav.tsx` needs `Nav` for the group's
 * trigger label and the "Tüm araçlar" / "All tools" see-all text; this file needs `Tools.hub`
 * for the three tool names. Keeping the two in separate files — with the already-translated
 * `label` and `allToolsLabel` strings handed down as props rather than re-resolved here —
 * satisfies both namespace-purity invariants (this file's own `Tools.hub`-only usage is
 * exactly what the added `lib/tools/messages.test.ts` `CONSUMER_ROOTS` line for
 * `components/site-nav` now scans) instead of duplicating the three tool names under new
 * `Nav.*` keys, which would create a second place to keep them in sync.
 */
export async function ToolsNavGroup({
  label,
  allToolsLabel,
}: {
  label: string;
  allToolsLabel: string;
}) {
  const t = await getTranslations("Tools.hub");

  return (
    <NavGroupDisclosure label={label}>
      <Link href={DISTANCE_TOOL.pathname} className={styles.groupLink}>
        {t("mesafeName")}
      </Link>
      <Link href={COORDINATE_TOOL.pathname} className={styles.groupLink}>
        {t("koordinatName")}
      </Link>
      <Link href={AREA_TOOL.pathname} className={styles.groupLink}>
        {t("alanName")}
      </Link>
      <Link href={TOOL_HUB_PATHNAME} className={`${styles.groupLink} ${styles.groupLinkAll}`}>
        {allToolsLabel}
      </Link>
    </NavGroupDisclosure>
  );
}
