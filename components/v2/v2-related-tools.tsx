import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  AREA_TOOL,
  COORDINATE_TOOL,
  DISTANCE_TOOL,
  TOOL_HUB_PATHNAME,
  TOOL_REGISTRY,
} from "@/lib/tools/tool-registry";

/**
 * The "other tools" exit every tool page carries.
 *
 * ## Why it exists
 *
 * Without it a tool page is a dead end: the reader finishes a measurement and the only way on
 * is the browser's back button (`ENGINEERING.md` §4 #10, `SEO-POLICY.md` §B8 8.5). V1 closed
 * that on all three pages; the V2 rewrite dropped it, and T-032 PR3 made the omission matter
 * more by moving these pages onto the canonical URLs and restoring their indexable surface —
 * three published, internally unlinked pages.
 *
 * ## Both locales, deliberately
 *
 * The tool pages gate their Turkish prose on the locale. This block is NOT gated: the labels
 * are already bilingual (`Tools.hub.*Name`, `Breadcrumb.araclar`), and an English reader was as
 * stuck as a Turkish one. V1's own comment made the same point, and the V1 structure test
 * existed specifically to stop this block drifting back inside a prose gate.
 *
 * ## Register-driven
 *
 * The list is derived from `TOOL_REGISTRY` minus the current page, so a fourth tool appears on
 * the other three pages the day it is registered, rather than on whichever ones someone
 * remembered to edit.
 */

const TOOL_NAME_KEY: Record<string, "mesafeName" | "koordinatName" | "alanName"> = {
  [DISTANCE_TOOL.pathname]: "mesafeName",
  [COORDINATE_TOOL.pathname]: "koordinatName",
  [AREA_TOOL.pathname]: "alanName",
};

interface V2RelatedToolsProps {
  /** The page rendering this block — excluded from its own list. */
  current: (typeof TOOL_REGISTRY)[number]["pathname"];
}

export async function V2RelatedTools({ current }: V2RelatedToolsProps) {
  const tHub = await getTranslations("Tools.hub");
  const tBreadcrumb = await getTranslations("Breadcrumb");

  const others = TOOL_REGISTRY.filter((tool) => tool.pathname !== current);

  return (
    <section
      aria-labelledby="v2-other-tools-heading"
      className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4"
    >
      <h2 id="v2-other-tools-heading" className="font-heading text-xl font-bold text-foreground">
        {tHub("otherToolsHeading")}
      </h2>
      <ul role="list" className="grid gap-3 sm:grid-cols-3">
        {others.map((tool) => (
          <li key={tool.pathname}>
            <Link
              href={tool.pathname}
              className="block rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {tHub(TOOL_NAME_KEY[tool.pathname]!)}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={TOOL_HUB_PATHNAME}
            className="block rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {tBreadcrumb("araclar")}
          </Link>
        </li>
      </ul>
    </section>
  );
}
