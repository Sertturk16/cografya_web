import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AREA_TOOL, COORDINATE_TOOL, DISTANCE_TOOL } from "@/lib/tools/tool-registry";
import styles from "./home.module.css";

/**
 * The homepage's tools band — three real cards, replacing a single run-on sentence
 * (finding 7, `Owner's Inbox/anasayfa-yenileme/plan.md` §5.5).
 *
 * ## Zero new copy
 *
 * Every name/body pair is reused verbatim from `Tools.hub` — already bilingual, already
 * classified `BOTH_LOCALE_KEYS` in `lib/tools/messages.test.ts` and already rendered as the
 * SAME three cards on `/araclar` (`app/[locale]/araclar/page.tsx`). This component authors no
 * string of its own.
 *
 * ## Why a new, homepage-owned component rather than editing `/araclar`
 *
 * `/araclar/page.tsx` is out of scope for this task (plan §3) even though its card markup is
 * visually close to what this band needs — the two are left as a deliberate, named
 * duplication (plan §10) rather than a shared refactor that would touch that file.
 *
 * ## Why the card is not a second `<h2>`/`<h3>` tier
 *
 * Same reasoning `FeaturedCards` already states for its own cards (`SEO-POLICY.md` §B3.7):
 * headings are the page's outline, not a type scale, and the section already has its own
 * `<h2>` ("Harita araçları"). Three more headings here would claim three subsections that do
 * not exist. The card's own name is still the link's full text (`SEO-POLICY.md` §B8.3).
 */
export async function ToolCards() {
  const t = await getTranslations("Tools.hub");

  // An explicit tuple, not a key assembled from the registry — the SAME reason
  // `/araclar/page.tsx` gives: next-intl types message keys, and a template-built key
  // (`t(\`${stem}Name\`)`) opts out of that check silently. `TOOL_REGISTRY`'s own order
  // (distance, coordinate, area) is preserved.
  const tools = [
    { pathname: DISTANCE_TOOL.pathname, name: t("mesafeName"), body: t("mesafeBody") },
    { pathname: COORDINATE_TOOL.pathname, name: t("koordinatName"), body: t("koordinatBody") },
    { pathname: AREA_TOOL.pathname, name: t("alanName"), body: t("alanBody") },
  ] as const;

  return (
    <ul role="list" className={styles.cardGrid}>
      {tools.map((tool) => (
        <li key={tool.pathname}>
          {/* `<Link>`, not a plain `<a>`: the registry's `pathname` is an UNLOCALIZED route
              key, and `<Link>` is what resolves it through the routing table — unlike
              `FeaturedCards`, whose `href` arrives already localized via `getPathname` at the
              page level (see that component's own docblock for why the two differ). */}
          <Link className={styles.card} href={tool.pathname}>
            <span className={styles.cardName}>{tool.name}</span>
            <span className={styles.toolCardBody}>{tool.body}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
