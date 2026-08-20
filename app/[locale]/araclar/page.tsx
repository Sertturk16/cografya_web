import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { ContentSurface } from "@/lib/seo/indexing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { COORDINATE_TOOL, DISTANCE_TOOL, TOOL_HUB_PATHNAME } from "@/lib/tools/tool-registry";
import styles from "./tools.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/**
 * `/araclar` is TR-indexable and `/en/tools` is `noindex, follow` — the existing
 * `"trNarrative"` policy (→ DEC 2026-08-19a md.6, the `/deniz` pattern), not a new mechanism.
 * The tools themselves are locale-independent, but what makes a tool page more than a canvas
 * is its Turkish explanatory text (SPEC §4.3), and that text is deliberately not machine
 * translated (`SEO-POLICY.md` §B14). Declared once and passed to `buildMetadata`, so the head
 * and the sitemap can never disagree.
 */
const TOOLS_SURFACE: ContentSurface = "trNarrative";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Tools.hub" });

  return buildMetadata({
    locale,
    hrefForLocale: () => TOOL_HUB_PATHNAME,
    title: t("metaTitle"),
    description: t("metaDescription"),
    surface: TOOLS_SURFACE,
  });
}

/**
 * `/araclar` ↔ `/en/tools` — the CBS tool hub (→ DEC 2026-08-19a md.3/md.4).
 *
 * ## Not a link list (§B12.2.d)
 *
 * The intro answers "which tool, and when" from the curriculum's own division of spatial data
 * into point, line and area layers, so the hub carries an idea a card grid cannot. It is a
 * UYARI-level item rather than a BLOCKER, and it is also the difference between a hub worth
 * indexing and a doorway.
 *
 * ## Two cards today, and that is a rule rather than a gap
 *
 * Area calculation is written, planned and unbuilt. A card for it would be a link to a 404,
 * and `SEO-POLICY.md` A4/3 rates a dead link a BLOCKER — outranking `plan-web.md` §2.1's
 * four-row route table, which describes the finished tier
 * (→ `Owner's Inbox/cbs-p2/pr-b/TASK-CONTEXT.md` md.7). No "coming soon" card either: an
 * announcement of what is missing is exactly what `CONTENT-STYLE.md` §22's eksik-vurgusu rule
 * removes.
 *
 * The intro moves with the card grid. PR-B narrowed NOVA's three-tool paragraph to the one
 * tool that was live; this PR restores its second half (`md.7.1`) for the two that now are.
 * The count in the copy tracks what ships, because a hub that announces three tools and shows
 * two is the eksik-vurgusu rule broken from the other side.
 *
 * ## Rendering
 *
 * SSG, no api read, no client island: a hub of static cards is server HTML in the first
 * response (`ENGINEERING.md` §3, §4 #1).
 */
export default async function ToolsHubPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Tools.hub");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: TOOL_HUB_PATHNAME });

  // An explicit tuple, not a key built from the registry: next-intl types message keys and a
  // template-assembled key opts out of that check silently (the `/oyun` hub records the same
  // reasoning). The registry supplies the parts a literal cannot carry — the route.
  const tools = [
    {
      pathname: DISTANCE_TOOL.pathname,
      name: t("mesafeName"),
      body: t("mesafeBody"),
    },
    {
      pathname: COORDINATE_TOOL.pathname,
      name: t("koordinatName"),
      body: t("koordinatBody"),
    },
  ] as const;

  const rendersIntro = locale === routing.defaultLocale;

  return (
    <div className="container page">
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: t("heading"),
            description: t("metaDescription"),
            path,
            locale,
          }),
          // Only tools that HAVE a page are enumerated — an `ItemList` position pointing at a
          // 404 is the §B5 5.8 / §B8 8.8 failure in structured-data form.
          itemListJsonLd({
            name: t("heading"),
            items: tools.map((tool) => ({
              name: tool.name,
              path: getPathname({ locale, href: tool.pathname }),
            })),
          }),
        ]}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("araclar"), href: TOOL_HUB_PATHNAME },
        ]}
      />

      <h1>{t("heading")}</h1>
      <EnWorkInProgressNotice locale={locale} />

      {rendersIntro && (
        <div className={styles.intro}>
          <p className="lede">{t("introP1")}</p>
          <p>{t("introP2")}</p>
        </div>
      )}

      {/* `role="list"` because `list-style: none` drops list semantics in Safari/VoiceOver —
          the repo's settled treatment on every card grid it already ships. */}
      <ul className={styles.toolGrid} role="list">
        {tools.map((tool) => (
          <li key={tool.pathname} className={`card ${styles.toolCard}`}>
            {/* The card's own name is the link: the anchor text names the destination, which
                is what §B8 8.3 asks for and what a repeated "Aç" button cannot give. */}
            <h2 className={styles.toolName}>
              <Link href={tool.pathname}>{tool.name}</Link>
            </h2>
            <p className={styles.toolBody}>{tool.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
