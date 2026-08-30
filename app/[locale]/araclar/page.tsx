import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
import { AreaIcon, CoordinateIcon, DistanceIcon } from "@/components/tools/tool-icons";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { ContentSurface } from "@/lib/seo/indexing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  AREA_TOOL,
  COORDINATE_TOOL,
  DISTANCE_TOOL,
  TOOL_HUB_PATHNAME,
} from "@/lib/tools/tool-registry";
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
 * `SEO-POLICY.md` §B12.2.d ("Hub sayfası kendi başına değer taşıyor mu, yoksa sadece link
 * listesi mi?") is UYARI-level, not BLOCKER — and the BLOCKER rows above it are both already
 * satisfied: 12.2.a (does the searcher find what they came for here) and 12.2.b (does the
 * page exist only to make you click elsewhere). The hub names three tools, says what each
 * does, is a real IA node with a header-nav entry and a homepage band, and is not a generated
 * funnel.
 *
 * The repo already has an owner-ruled precedent for exactly this shape: `/oyun` is a heading,
 * one subtitle sentence and three cards, and its own docblock records the trade in the
 * owner's name (→ DEC 2026-07-30p/30q/30r) — "this is now a thin page by word count… an
 * owner-ruled trade." This hub is the same genre in the same system, now that the taxonomy
 * paragraph that used to sit here is gone: it enumerated the same three tools the cards
 * already enumerate, in prose, directly above them, and nothing real was lost by cutting it
 * (`Owner's Inbox/araclar-production-ready/SPEC.md` §5.1).
 *
 * What the hub still carries that a bare link list does not: the shared-map /
 * no-registration / PNG-export fact in `introP1` — true of all three tools at once, which is
 * exactly what no single card can say — the three tool icons, and its own H1 + metadata.
 *
 * ## Three cards, and the count in the copy was never a description of the plan
 *
 * A card landed only when its page did: a card for an unbuilt tool is a link to a 404, and
 * `SEO-POLICY.md` A4/3 rates a dead link a BLOCKER — outranking `plan-web.md` §2.1's four-row
 * route table, which describes the finished tier
 * (→ `Owner's Inbox/cbs-p2/pr-b/TASK-CONTEXT.md` md.7). There was never a "coming soon" card
 * either: an announcement of what is missing is exactly what `CONTENT-STYLE.md` §22's
 * eksik-vurgusu rule removes.
 *
 * The intro moved with the card grid the whole way. PR-B narrowed NOVA's three-tool paragraph
 * to the one tool that was live, PR-C restored its second half for two (`md.7.1`), and PR-D
 * returns it to NOVA's own three-tool text now that the tier is complete. The count in the copy
 * tracks what ships, because a hub that announces three tools and shows two is the
 * eksik-vurgusu rule broken from the other side.
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
      Icon: DistanceIcon,
    },
    {
      pathname: COORDINATE_TOOL.pathname,
      name: t("koordinatName"),
      body: t("koordinatBody"),
      Icon: CoordinateIcon,
    },
    {
      pathname: AREA_TOOL.pathname,
      name: t("alanName"),
      body: t("alanBody"),
      Icon: AreaIcon,
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
        </div>
      )}

      {/* `role="list"` because `list-style: none` drops list semantics in Safari/VoiceOver —
          the repo's settled treatment on every card grid it already ships. */}
      <ul className={styles.toolGrid} role="list">
        {tools.map((tool) => (
          <li key={tool.pathname} className={`card ${styles.toolCard}`}>
            {/* Decorative: the point/line/area distinction it shows at a glance is also said
                in words by the card's own name and body below, so nothing here is information
                carried by a symbol alone (`DESIGN.md` §6.1). */}
            <p className={styles.toolBadge} aria-hidden="true">
              <tool.Icon size={24} />
            </p>
            {/* The card's own name is the link: the anchor text names the destination, which
                is what §B8 8.3 asks for and what a repeated "Aç" button cannot give. The
                whole card is the click target (`tools.module.css` `.toolName a::after`); this
                text stays the accessible name and the SEO anchor text either way. */}
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
