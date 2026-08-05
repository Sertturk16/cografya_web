"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { provinceUrl } from "@/lib/game/province-url";
import { MAX_STARS, STAR_THRESHOLDS, starsForScore, type RoundSummary } from "@/lib/game/round";
import { targetsById, type GameTarget } from "@/lib/game/target";
import { TrophyIcon } from "./game-icons";
import styles from "./game-ui.module.css";

interface GameSummaryProps {
  open: boolean;
  summary: RoundSummary;
  /** The full pool of the finished round — the source of the missed targets' labels. */
  targets: readonly GameTarget[];
  provinceUrlTemplate: string;
  /** Localized path of `/oyun`, so the end screen can offer the way back out. */
  hubUrl: string;
  onClose: () => void;
  onReplay: () => void;
}

/**
 * How many "look again" chips may be shown open. Above this the group starts folded: the
 * 7-question region round can never reach it, an 81-question round easily can, and a list
 * long enough to push the score off a phone screen defeats its own purpose.
 */
const REVIEW_OPEN_MAX = 12;

/** One chip row of targets: a real link when the target has a page, plain text when not. */
function TargetList({
  targets,
  urlTemplate,
}: {
  targets: readonly GameTarget[];
  urlTemplate: string;
}) {
  return (
    <ul className={styles.missedList}>
      {targets.map((target) => (
        <li key={target.id}>
          {target.slug ? (
            <a className={styles.missedLink} href={provinceUrl(urlTemplate, target.slug)}>
              {target.label}
            </a>
          ) : (
            <span className={styles.missedPlain}>{target.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The end-of-round screen (SPEC §5.4) — the most valuable part of the game.
 *
 * Layout follows the owner's design direction (2026-07-30): a badge, the result, three
 * stat boxes, then what was missed. The numbers themselves are the ones DEC 2026-07-30h
 * locked — a question halves with every wrong click (100 · 50 · 25 · 13 …) and the round
 * reports the mean, so a 7-question mode and an 81-question mode are directly comparable —
 * plus the two honest details: how many were found on the first click, and how many wrong
 * clicks it took. There is no elapsed time and no personal best: the seconds display and
 * the whole persistence layer were removed by DEC 2026-07-30m/30n.
 *
 * Then comes the list of what was MISSED — the ones whose answer had to be shown — each
 * province a real link to its own page. That list is what turns a game round into a reading
 * session and wires the game into the content corpus (CONVENTIONS §6 #10). Nothing in the
 * benchmarked competitors does this (`Owner's Inbox/oyun-metin-benchmark/brief.md`).
 *
 * This is the ONE file in the play surface that renders links; the map and the island are
 * held to "no navigation, anywhere" by a CI guard (`game-map.nav-guard.test.ts`), because
 * on the map a click must answer a question, never navigate.
 *
 * Those links are plain `<a href>`, deliberately. This is a client component and every URL
 * it renders arrives ALREADY resolved — the localized province template and the localized
 * `/oyun` path, both built once on the server through `getPathname` (SEO-POLICY §B7 7.4).
 * next-intl's `Link` wants the unlocalized route and would resolve it a second time, and
 * `next/link` over a list of up to 81 province chips would fire a prefetch per visible
 * chip from inside a modal. The cost is one full navigation on two deliberate exit
 * actions; the crawler sees a normal link either way.
 *
 * It is a native `<dialog showModal>`: focus trapping, Esc-to-close, inert background and
 * top-layer stacking come from the platform, and — because a modal never participates in
 * page layout — a long list can appear at the end of a round without moving a single pixel
 * of the page (CLS budget, CONVENTIONS §6 #9). Closing it leaves the finished map on
 * screen, which is the one thing the design mockup's separate result page cannot show.
 */
export function GameSummary({
  open,
  summary,
  targets,
  provinceUrlTemplate,
  hubUrl,
  onClose,
  onReplay,
}: GameSummaryProps) {
  const t = useTranslations("Game");
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const resolveGroup = useMemo(() => {
    const index = targetsById(targets);
    return (ids: readonly string[]) =>
      ids.map((id) => index.get(id)).filter((target): target is GameTarget => target !== undefined);
  }, [targets]);
  const missed = useMemo(
    () => resolveGroup(summary.missedTargetIds),
    [resolveGroup, summary.missedTargetIds],
  );
  const review = useMemo(
    () => resolveGroup(summary.reviewTargetIds),
    [resolveGroup, summary.reviewTargetIds],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // `<dialog>` autofocuses its first focusable child; move focus to the heading
      // instead so the result is READ OUT before the buttons are offered (WCAG 4.1.3).
      headingRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const stars = starsForScore(summary.score);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="game-summary-heading"
      onClose={onClose}
    >
      <div className={styles.dialogBody}>
        {/* A trophy over the result, per the design direction. Decorative: every fact it
            could stand for is written underneath it in words. */}
        <p className={styles.dialogBadge} aria-hidden="true">
          <TrophyIcon size={26} />
        </p>

        <h2
          id="game-summary-heading"
          className={styles.dialogHeading}
          ref={headingRef}
          tabIndex={-1}
        >
          {t("summaryHeading")}
        </h2>

        {/* The star row is DECORATION over numbers that are already on screen: the glyphs
            are hidden from assistive tech and the same grade is stated in words next to
            them, so nothing here is carried by a symbol alone. */}
        <p className={styles.dialogStars}>
          <span className={styles.starGlyphs} aria-hidden="true">
            {"★".repeat(stars)}
            <span className={styles.starEmpty}>{"☆".repeat(MAX_STARS - stars)}</span>
          </span>
          <span className={styles.starLabel}>
            {t("summaryStars", { count: stars, max: MAX_STARS })}
          </span>
        </p>

        {/* The star rule, in one sentence. The row above shows a grade the numbers below
            cannot explain: 6 of 7 on the first try scores 93, which is three stars, and
            nothing on this screen said why (UX tour B9). A grade the player cannot check is
            a grade they cannot trust. */}
        <p className={styles.dialogNote}>
          {t("summaryStarsRule", {
            three: STAR_THRESHOLDS[0] ?? 0,
            two: STAR_THRESHOLDS[1] ?? 0,
            one: STAR_THRESHOLDS[2] ?? 0,
          })}
        </p>

        <p className={styles.dialogFirstTry}>
          {t("summaryFirstTry", { count: summary.firstTry, total: summary.total })}
        </p>

        {/* Three boxes, one number each. `<dl>` rather than a row of paragraphs because
            that is exactly what this is — three labelled values — and it is what makes each
            number readable as "Puan: 78" instead of a bare "78" out of context.
            THE THIRD LABEL IS A FIX, not a rewording: it read "Yanlış", next to "Doğru 7/7",
            so the same screen appeared to report 8 events in a 7-question round. The two
            numbers were never in the same unit — one counts QUESTIONS, the other counts
            CLICKS — and only the label was hiding it (UX tour B9 / D5). */}
        <dl className={styles.statGrid}>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t("statScore")}</dt>
            <dd className={styles.statValue}>{summary.score}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t("statFound")}</dt>
            <dd className={styles.statValue}>
              {summary.found}
              <span className={styles.statOutOf}>/{summary.total}</span>
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t("statWrong")}</dt>
            <dd className={styles.statValue}>{summary.totalWrongs}</dd>
          </div>
        </dl>

        <h3 className={styles.dialogSubheading}>{t("summaryMissedHeading")}</h3>
        {missed.length === 0 ? (
          /* "Hepsini bildin." is now conditional on BOTH lists being empty, and that is a
             correctness fix. This block only ever knew about `missed` — the answers that had
             to be SHOWN — so a player who missed a province once and then found it was told
             they had known everything (UX tour B9). The second sentence is the honest thing
             to say in that case: nothing had to be shown, but something is still worth a
             second look, and the list is right underneath. */
          <p className={styles.dialogNote}>
            {review.length === 0 ? t("summaryMissedNone") : t("summaryMissedNoneReveal")}
          </p>
        ) : (
          <>
            {/* Only promise a page when there is one: region targets have no detail page,
                so in the region mode the list is plain text and this line would be a lie. */}
            {missed.some((target) => target.slug) ? (
              <p className={styles.dialogNote}>{t("summaryMissedNote")}</p>
            ) : null}
            <TargetList targets={missed} urlTemplate={provinceUrlTemplate} />
          </>
        )}

        {/* The SECOND group: found, but NOT on the first click — the round's real learning
            list, and each province a link to its own page (→ the UX tour's Ö5). Its
            threshold moved from two wrong clicks to one (`lib/game/config.ts`), which is
            what makes the group appear at all for the ordinary "missed it once" case.
            OPEN by default while it is short, because it is the point of the screen; folded
            once it is long enough to bury the score on an 81-question round. `<details>`
            either way: a real disclosure control, keyboard support included, no JavaScript
            of ours. */}
        {review.length > 0 ? (
          <details className={styles.reviewGroup} open={review.length <= REVIEW_OPEN_MAX}>
            <summary className={styles.reviewSummary}>
              {t("summaryReviewHeading", { count: review.length })}
            </summary>
            <p className={styles.dialogNote}>{t("summaryReviewNote")}</p>
            <TargetList targets={review} urlTemplate={provinceUrlTemplate} />
          </details>
        ) : null}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.primaryAction} onClick={onReplay}>
            {t("summaryReplay")}
          </button>
          <a className={styles.action} href={hubUrl}>
            {t("summaryBackToHub")}
          </a>
          <button type="button" className={styles.action} onClick={onClose}>
            {t("summaryClose")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
