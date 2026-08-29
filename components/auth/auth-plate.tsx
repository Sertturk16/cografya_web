import { useTranslations } from "next-intl";
import styles from "./auth-panel.module.css";

/**
 * The survey plate (uyelik-auth-redesign plan §5.2) — the visual answer to "the auth pages
 * read as scaffolding". Pure presentation, no state, no client hooks: a non-async function
 * component with no `"use client"` directive, so it renders as a plain Server Component when
 * a page imports it directly, and renders identically as part of a Client Component's module
 * graph when the modal's dialog tree includes it — `useTranslations` (unlike `getTranslations`)
 * is usable in a non-async Server Component that carries no interactive features, per
 * next-intl's own environment split, so one component genuinely serves both trees rather than
 * needing two.
 *
 * Reuses `components/home/home.module.css`'s owner-approved "Kadastro" decorative vocabulary
 * (graticule + contour-ring cluster + coordinate label) rather than inventing a second one —
 * see this task's plan §5.0 for why that reuse, not a photograph or a new illustration set, is
 * the deliberate answer here.
 */
export function AuthPlate() {
  const t = useTranslations("Auth");

  return (
    <aside className={styles.plate} aria-labelledby="auth-plate-heading">
      <div className={styles.plateGrid} aria-hidden="true" />
      <div className={styles.plateRings} aria-hidden="true">
        <span className={styles.plateRing1} />
        <span className={styles.plateRing2} />
        <span className={styles.plateRing3} />
        <span className={styles.plateRing4} />
        <span className={styles.plateRing5} />
        <span className={styles.plateRingDot} />
      </div>
      <p className={styles.plateEyebrow}>{t("plate.eyebrow")}</p>
      <h2 id="auth-plate-heading" className={styles.plateHeading}>
        {t("plate.heading")}
      </h2>
      {/* `role="list"` — Safari + VoiceOver drop implicit list semantics from a markerless
          list (`globals.css`'s own documented reason, `.province-grid`'s precedent). */}
      <ul role="list" className={styles.plateList}>
        <li>{t("plate.favorites")}</li>
        <li>{t("plate.video")}</li>
        <li>{t("plate.game")}</li>
        <li>{t("plate.measurement")}</li>
      </ul>
      <p className={styles.plateFree}>{t("plate.free")}</p>
      {/* Decorative/atmospheric, not a data claim — the same `aria-hidden` treatment
          `home.module.css`'s own `.heroCoord` label already gives an identical device. */}
      <p className={styles.plateCoord} aria-hidden="true">
        {t("plate.coord")}
      </p>
    </aside>
  );
}
