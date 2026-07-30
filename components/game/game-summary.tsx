"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { provinceUrl } from "@/lib/game/province-url";
import { MAX_STARS, starsForScore, type RoundSummary } from "@/lib/game/round";
import { targetsById, type GameTarget } from "@/lib/game/target";
import styles from "./game-ui.module.css";

interface GameSummaryProps {
  open: boolean;
  summary: RoundSummary;
  /** The full pool of the finished round — the source of the missed targets' labels. */
  targets: readonly GameTarget[];
  /** Best score (0–100) for this mode BEFORE the round, `undefined` on a first run. */
  previousBest: number | undefined;
  provinceUrlTemplate: string;
  formatClock: (ms: number) => string;
  onClose: () => void;
  onReplay: () => void;
  onChangeMode: () => void;
  onClearProgress: () => void;
}

/**
 * The end-of-round screen (SPEC §5.4) — the most valuable part of the game.
 *
 * The headline is the round's score out of 100 (→ DEC 2026-07-30f/30h): a question halves
 * with every wrong click (100 · 50 · 25 · 13 …) and the round reports the mean, so a
 * 7-question mode and an 81-question mode are directly comparable. The honest detail sits
 * under it — how many were found on the first click, and how many wrong clicks it took.
 *
 * Then comes the list of what was MISSED — the ones whose answer had to be shown — each
 * province a real link to its own page. That
 * list is what turns a game round into a reading session and wires the game into the
 * content corpus (CONVENTIONS §6 #10).
 *
 * This is the ONE file in the game surface that is allowed to render a link. The map and
 * the island are held to "no navigation, anywhere" by a CI guard
 * (`game-map.nav-guard.test.ts`), because on the play surface a click must answer a
 * question, never navigate.
 *
 * It is a native `<dialog showModal>`: focus trapping, Esc-to-close, inert background and
 * top-layer stacking come from the platform, and — because a modal never participates in
 * page layout — an 81-row list can appear at the end of a round without moving a single
 * pixel of the page (CLS budget, CONVENTIONS §6 #9).
 */
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

export function GameSummary({
  open,
  summary,
  targets,
  previousBest,
  provinceUrlTemplate,
  formatClock,
  onClose,
  onReplay,
  onChangeMode,
  onClearProgress,
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

  const isNewBest = previousBest === undefined || summary.score > previousBest;
  const stars = starsForScore(summary.score);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="game-summary-heading"
      onClose={onClose}
    >
      <div className={styles.dialogBody}>
        <h2
          id="game-summary-heading"
          className={styles.dialogHeading}
          ref={headingRef}
          tabIndex={-1}
        >
          {t("summaryHeading")}
        </h2>

        <p className={styles.dialogScore}>{t("summaryScore", { score: summary.score })}</p>
        {/* The star row is DECORATION over a number that is already on screen: the glyphs
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
        <p className={styles.dialogStats}>
          <span>{t("summaryFirstTry", { count: summary.firstTry, total: summary.total })}</span>
          <span aria-hidden="true">·</span>
          <span>{t("summaryTotalWrongs", { count: summary.totalWrongs })}</span>
          <span aria-hidden="true">·</span>
          <span>{t("summaryTime", { time: formatClock(summary.elapsedMs) })}</span>
        </p>
        <p className={styles.dialogBest}>
          {isNewBest ? t("summaryNewBest") : t("summaryPreviousBest", { score: previousBest ?? 0 })}
        </p>

        <h3 className={styles.dialogSubheading}>{t("summaryMissedHeading")}</h3>
        {missed.length === 0 ? (
          <p className={styles.dialogNote}>{t("summaryMissedNone")}</p>
        ) : (
          <>
            {/* Only promise a page when there is one: region targets have no detail page,
                so in Mode 1 the list is plain text and this line would be a lie. */}
            {missed.some((target) => target.slug) ? (
              <p className={styles.dialogNote}>{t("summaryMissedNote")}</p>
            ) : null}
            <TargetList targets={missed} urlTemplate={provinceUrlTemplate} />
          </>
        )}

        {/* The SECOND group: found, but only after real searching. Collapsed by default —
            on an 81-question round both lists open at once would bury the score, and this
            one is the optional one. `<details>` keeps it a real disclosure control with
            keyboard support and no JavaScript of ours. */}
        {review.length > 0 ? (
          <details className={styles.reviewGroup}>
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
          <button type="button" className={styles.action} onClick={onChangeMode}>
            {t("summaryChangeMode")}
          </button>
          <button type="button" className={styles.action} onClick={onClose}>
            {t("summaryClose")}
          </button>
        </div>
        <button type="button" className={styles.quietAction} onClick={onClearProgress}>
          {t("summaryClearProgress")}
        </button>
      </div>
    </dialog>
  );
}
