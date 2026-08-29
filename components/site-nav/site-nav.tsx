import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "../locale-switcher";
import { NavDisclosure } from "./nav-disclosure";
import { NavGroupDisclosure } from "./nav-group-disclosure";
import { ToolsNavGroup } from "./tools-nav-group";
import styles from "./site-nav.module.css";

/**
 * The header's primary navigation. Server half: it resolves the `Nav` namespace's labels and
 * hands the finished `<nav>` — real `<a href>` elements, some flat and some grouped under a
 * per-group dropdown (finding 8b, → `Owner's Inbox/anasayfa-yenileme/plan.md` §5.7b) — plus the
 * header's auth links and the locale switcher, to the client disclosure as children. The island
 * never sees a route or a label, only a subtree it may show or hide, which is what keeps the
 * link graph identical at every viewport (`SEO-POLICY.md` §B8.1/8.2). Grouping does not change
 * that invariant: `NavGroupDisclosure` carries the exact same never-gate-behind-open-state
 * contract as the top-level `NavDisclosure`, one level down (see its own docblock).
 *
 * The full set of links this component builds is named in exactly ONE place — here — and
 * deliberately NOT counted or re-listed in `nav-disclosure.tsx`'s or this file's own comments
 * (→ PR #62 review `CODE62-M1`: a stale enumerated count is precisely the mistake that finding
 * caught once already, and repeating it is the one thing this docblock is written to avoid).
 *
 * The auth nav and the locale switcher both travel with the primary nav into the mobile panel.
 * They are the whole of today's header that moves, so nothing a reader had at 390px is lost —
 * it is the same set of controls, one tap away instead of several wrapped rows tall.
 */
export async function SiteNav() {
  const t = await getTranslations("Nav");

  return (
    <NavDisclosure>
      <nav aria-label={t("label")} className={styles.nav}>
        <Link href="/">{t("home")}</Link>
        {/* Grouped under "Haritalar" (finding 8, → plan §5.7b): the owner's live-tour finding
            named "Deniz" as a meaningless singular item sitting alone at the top level. It
            gets its meaning from sitting inside this explicit group instead — the concrete
            mechanism behind the fix, not just a relabel. The three link labels are unchanged,
            reused verbatim from the same `Nav` keys the flat links used before. */}
        <NavGroupDisclosure label={t("haritalar")}>
          <Link href="/turkiye" className={styles.groupLink}>
            {t("turkiye")}
          </Link>
          <Link href="/dunya" className={styles.groupLink}>
            {t("dunya")}
          </Link>
          {/* The marine hub sits with the two map hubs, not under `/turkiye`: it spans 27
              provinces and four seas, so no single province owns it. A nav link is also
              what keeps it from being an orphan page (`SEO-POLICY.md` §B8) — the second
              entry point is the cross-link on `/turkiye` (owner answer S8: both). */}
          <Link href="/deniz" className={styles.groupLink}>
            {t("deniz")}
          </Link>
        </NavGroupDisclosure>
        {/* The game is a primary surface, not a sub-page of the map hub (owner answer
            S4, → DEC 2026-07-30c) — so it sits in the top nav, after the map group and
            before the site-info link. */}
        <Link href="/oyun">{t("game")}</Link>
        {/* The book hub (owner ruling V-6, → DEC 2026-08-15g). It sits here rather than
            being reached only from the home page because §B8 8.1 wants every indexable page
            behind at least one static internal link, and a nav link is the one entry point
            that exists on every page. */}
        <Link href="/kitaplar">{t("kitaplar")}</Link>
        {/* Grouped under "Araçlar" (finding 8, → plan §5.7b): the CBS tool hub (owner ruling
            O-1, → DEC 2026-08-19g md.1) was a flat top-level link before this change. Its
            three tools now sit as named links inside this group, plus a "Tüm araçlar" see-all
            row pointing back at the hub itself — which is also what keeps `/araclar` reachable
            from a static internal link in the primary nav (`SEO-POLICY.md` §B8.1) now that no
            single top-level link points at it directly. `ToolsNavGroup` lives in its own file
            for a namespace-purity reason its own docblock explains, not a structural one — it
            renders the identical `NavGroupDisclosure` shape "Haritalar" uses above. */}
        <ToolsNavGroup label={t("araclar")} allToolsLabel={t("allTools")} />
        <Link href="/hakkimizda">{t("about")}</Link>
      </nav>
      {/* The header's auth entry points (finding 8c, → plan §5.7c/§5.8). A second `<nav>`
          landmark, mirroring `site-footer.tsx`'s own identical pattern: real server-rendered
          links to the confirmed existing routes (`i18n/routing.ts`), no new auth flow. Styled
          with the existing global ghost/filled button pair (`app/globals.css` `.btn`/
          `.btn-ghost`/`.btn-primary`) — the same pairing this exact page's own hero CTAs
          already use — so this adds zero new button CSS (plan §5.8). These links were
          previously footer-only by deliberate ruling (`DEC 2026-08-20g` md.5, reasoned against
          an eight-link flat nav with no spare width, `DESIGN.md` §4's own history). This
          plan's own header regrouping changes that premise before adding these links, and it
          is the owner's fresh live-tour finding that authorizes acting on the changed premise
          (plan §2) — the footer's own pair stays untouched; redundant entry points across
          header and footer are normal and were not asked to be removed. */}
      <nav aria-label={t("authLabel")} className={styles.authNav}>
        <Link href="/giris" className="btn btn-ghost">
          {t("login")}
        </Link>
        <Link href="/kayit" className="btn btn-primary">
          {t("register")}
        </Link>
      </nav>
      <LocaleSwitcher />
    </NavDisclosure>
  );
}
