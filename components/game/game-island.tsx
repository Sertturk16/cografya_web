"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { GameShapeTargetEntry } from "@/lib/game/map-shapes";
import {
  advanceRound,
  answerRound,
  createRound,
  currentQuestionPoints,
  currentTargetId,
  elapsedMs,
  pauseRound,
  resumeRound,
  revealRound,
  summarizeRound,
  type AnswerOutcome,
  type RoundState,
} from "@/lib/game/round";
import {
  buildProvinceTargetSet,
  buildRegionTargetSet,
  isGameModeId,
  targetsById,
  type GameModeId,
  type GameTargetSet,
  type RegionLabels,
} from "@/lib/game/target";
import {
  clearGameProgress,
  getGameProgress,
  getServerGameProgress,
  setGameProgress,
  subscribeGameProgress,
  withBestScore,
} from "@/lib/game/storage";
import { GameSummary } from "./game-summary";
import styles from "./game-ui.module.css";

export interface GameIslandProps {
  /**
   * The answer-side view of the map's shapes — plaka kodu, name, region, slug. NO path
   * geometry: the 56 KB of `d` data is already in the server HTML and is never shipped a
   * second time as JavaScript (SPEC §3.3, enforced by the `GameShapeTargetEntry` type).
   */
  shapes: readonly GameShapeTargetEntry[];
  /** Localized region names, from the `Regions` message namespace. */
  regionLabels: RegionLabels;
  /**
   * The locale's own province-detail path with `SLUG_PLACEHOLDER` where the slug goes,
   * resolved once on the server through `getPathname`. Passing the resolved shape rather
   * than rebuilding routes on the client keeps localized-URL resolution in exactly one
   * place (SEO-POLICY §B7 7.4) — the island only substitutes a slug into it.
   */
  provinceUrlTemplate: string;
}

/** Milliseconds the wrongly-picked shape stays marked before it returns (SPEC §5.3). */
const WRONG_FLASH_MS = 700;
/** Auto-advance delay after a right answer. */
const CORRECT_HOLD_MS = 900;
/** Auto-advance delay after the answer is shown — longer, because it has to be read. */
const REVEAL_HOLD_MS = 2400;
/** HUD clock resolution. */
const CLOCK_TICK_MS = 1000;

type Feedback = Exclude<AnswerOutcome, { kind: "ignored" }>;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The `/oyun` play island (SPEC §3.3, §5; mechanics → DEC 2026-07-30f/30h) — loaded with
 * `ssr: false`, so nothing here is in the indexable HTML and nothing here can change it.
 *
 * It follows the repo's established "enhance the server HTML in place" pattern
 * (`MapHoverCard`, `MapZoomPan`): the 81 `<path>` elements are ALREADY on the page, so the
 * island reaches them through `[data-game-map]`, binds ONE delegated listener to the
 * `<svg>`, and expresses every game state by writing `data-state` attributes. It never
 * re-renders the map — 81 React elements per answer is exactly the INP problem this design
 * avoids (CONVENTIONS §6 #9).
 *
 * Progressive enhancement, honestly: with JavaScript off the page is still a complete
 * description of the game plus a real Türkiye map (PR-1). This file only adds play.
 *
 * ACCESSIBILITY POSTURE. While no round is running the SVG stays what PR-1 shipped — ONE
 * labelled image (`role="img"`), because 81 anonymous, non-actionable tab stops would be
 * pure noise. The moment a round starts the island upgrades it: `role="img"` comes OFF and
 * every answerable shape becomes a real `role="button"` tab stop whose accessible name is
 * the province's name (WCAG 4.1.2). It is downgraded again when the round ends, so the map
 * is never a control that does nothing.
 *
 * Text carries every state the colours carry (`role="status"` line, DESIGN.md §6.1 rule 3),
 * and every timed transition has a "Devam" button that does the same thing immediately
 * (WCAG 2.2.1).
 *
 * STATE SHAPE. Round transitions all originate in an event handler or a timer, so they are
 * applied — and persisted — there rather than in an effect watching the state afterwards.
 * Effects here do only what effects are for: subscribe to the DOM, run timers, and push the
 * current state OUT to the SVG.
 */
export function GameIsland({ shapes, regionLabels, provinceUrlTemplate }: GameIslandProps) {
  const t = useTranslations("Game");

  // `localStorage` is an external system, so it is read as one (`useSyncExternalStore`,
  // the shape `map-zoom-pan.tsx` already uses) rather than copied into state on mount.
  const progress = useSyncExternalStore(
    subscribeGameProgress,
    getGameProgress,
    getServerGameProgress,
  );

  const [round, setRound] = useState<RoundState | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [wrongPlate, setWrongPlate] = useState<string | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  /** Best score for this mode BEFORE the round that just ended (captured at the finish). */
  const [previousBest, setPreviousBest] = useState<number | undefined>(undefined);
  /**
   * `Date.now()` as of the last clock tick. Kept in state rather than read during render:
   * a component must be able to re-render without its output changing, and the HUD clock
   * is the one value that would otherwise break that. It starts at 0, which reads as
   * "0 sn" for the first second of a round — correct, not stale.
   */
  const [clockNow, setClockNow] = useState(0);

  const questionRef = useRef<HTMLParagraphElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  /**
   * The live round, for the DOM listeners. They are attached once, so reading `round`
   * through their closure would answer questions from an old state. Every write to it
   * happens inside a handler, next to the matching `setRound`.
   */
  const roundRef = useRef<RoundState | null>(null);

  const targetSets = useMemo(
    () =>
      ({
        regions: buildRegionTargetSet(shapes, regionLabels),
        provinces: buildProvinceTargetSet(shapes),
      }) satisfies Record<GameModeId, GameTargetSet>,
    [shapes, regionLabels],
  );

  const playing = round !== null;
  const modeId = round?.modeId ?? null;
  const activeSet = round ? targetSets[round.modeId] : null;
  const labelOf = useMemo(() => {
    const index = activeSet ? targetsById(activeSet.targets) : null;
    return (targetId: string | null) => (targetId ? (index?.get(targetId)?.label ?? "") : "");
  }, [activeSet]);

  // --- round transitions (handlers and timers only) ------------------------------------
  /**
   * Apply a round transition and snapshot it with the clock FROZEN, so a tab closed
   * mid-round resumes where it stopped instead of counting the time it was away.
   */
  const commitRound = useCallback((next: RoundState | null) => {
    roundRef.current = next;
    setRound(next);
    const stored = next && next.status !== "finished" ? pauseRound(next, Date.now()) : null;
    setGameProgress({ ...getGameProgress(), round: stored });
  }, []);

  const startRound = useCallback(
    (nextMode: GameModeId) => {
      const ids = targetSets[nextMode].targets.map((target) => target.id);
      // No seeded provinces means no game. Better to leave the idle prompt in place than
      // to open a round with nothing in it and immediately "finish" it at 0/100.
      if (ids.length === 0) return;
      setFeedback(null);
      setWrongPlate(null);
      setSummaryDismissed(false);
      setClockNow(Date.now());
      commitRound(createRound(nextMode, ids, Date.now()));
    },
    [commitRound, targetSets],
  );

  const resumeSaved = useCallback(() => {
    const saved = getGameProgress().round;
    if (!saved) return;
    setFeedback(null);
    setWrongPlate(null);
    setSummaryDismissed(false);
    setClockNow(Date.now());
    commitRound(resumeRound(saved, Date.now()));
  }, [commitRound]);

  const discardSaved = useCallback(() => {
    setGameProgress({ ...getGameProgress(), round: null });
  }, []);

  /** Leave the round but KEEP its snapshot, so "Devam et" is offered afterwards. */
  const leaveRound = useCallback(() => {
    const current = roundRef.current;
    roundRef.current = null;
    setRound(null);
    setFeedback(null);
    setWrongPlate(null);
    const stored =
      current && current.status !== "finished" ? pauseRound(current, Date.now()) : null;
    setGameProgress({ ...getGameProgress(), round: stored });
  }, []);

  /** Dismiss the current question's feedback — the button and the timer share this. */
  const goNext = useCallback(() => {
    const current = roundRef.current;
    if (!current) return;
    const next = advanceRound(current);
    if (next === current) return;
    setFeedback(null);
    commitRound(next);
    if (next.status !== "finished") return;
    // The round ended here, so this is where its result is banked: remember what the best
    // was BEFORE it (the end screen compares against that), then merge the new score.
    const snapshot = getGameProgress();
    setPreviousBest(snapshot.best[next.modeId]);
    setSummaryDismissed(false);
    const { score } = summarizeRound(next, Date.now());
    setGameProgress(withBestScore({ ...snapshot, round: null }, next.modeId, score));
  }, [commitRound]);

  /** "Cevabı göster" — 0 points for this question, then on to the next (DEC 2026-07-30h). */
  const showAnswer = useCallback(() => {
    const current = roundRef.current;
    if (!current) return;
    const { state, outcome } = revealRound(current, Date.now());
    if (outcome.kind === "ignored") return;
    setWrongPlate(null);
    setFeedback(outcome);
    commitRound(state);
  }, [commitRound]);

  const changeMode = useCallback(() => {
    roundRef.current = null;
    setRound(null);
    setFeedback(null);
    document
      .querySelector("[data-game-modes]")
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, []);

  const clearProgress = useCallback(() => {
    clearGameProgress();
    setPreviousBest(undefined);
  }, []);

  // --- answering (driven by the delegated DOM listeners) -------------------------------
  const handlePlate = useCallback(
    (plate: string) => {
      const current = roundRef.current;
      if (!current) return;
      const pickedTargetId = targetSets[current.modeId].plateToTarget[plate];
      // An unseeded plate is geographic backdrop, not a wrong answer: it must not halve the
      // question. `data-plate` is on EVERY shape while `data-slug` is only on seeded ones
      // (SPEC §4.2), so tolerating the difference is the contract, not a defensive extra.
      if (!pickedTargetId) return;
      const { state, outcome } = answerRound(current, pickedTargetId, Date.now());
      if (outcome.kind === "ignored") return;
      setFeedback(outcome);
      setWrongPlate(outcome.kind === "retry" ? plate : null);
      commitRound(state);
    },
    [commitRound, targetSets],
  );

  // --- DOM wiring: the pre-sized HUD slot -------------------------------------------------
  // The slot ships a server-rendered instruction line so it is neither empty nor useless
  // without JavaScript. Once the island is mounted that line is the island's job, so the
  // slot is marked and CSS hides the static copy — no duplicate sentence, no layout jump.
  useEffect(() => {
    const slot = document.querySelector("[data-game-hud]");
    if (!(slot instanceof HTMLElement)) return;
    slot.dataset.gameReady = "true";
    return () => {
      delete slot.dataset.gameReady;
    };
  }, []);

  // --- DOM wiring: the server-rendered mode cards ---------------------------------------
  useEffect(() => {
    const list = document.querySelector("[data-game-modes]");
    if (!(list instanceof HTMLElement)) return;
    // Tells the card list a script is driving it now (styling only — the cards' actions
    // are real links either way, so they still work with JavaScript off).
    list.dataset.gameReady = "true";
    const onClick = (event: MouseEvent) => {
      const trigger =
        event.target instanceof Element ? event.target.closest("[data-game-mode]") : null;
      if (!(trigger instanceof HTMLElement)) return;
      const picked = trigger.dataset.gameMode;
      if (!isGameModeId(picked)) return;
      // The in-page jump to the play area is deliberately NOT prevented: the anchor is a
      // real link, and letting it run gives the scroll and the back button for free.
      startRound(picked);
    };
    list.addEventListener("click", onClick);
    return () => {
      list.removeEventListener("click", onClick);
      delete list.dataset.gameReady;
    };
  }, [startRound]);

  // --- DOM wiring: the map ---------------------------------------------------------------
  useEffect(() => {
    const svg = document.querySelector("[data-game-map] svg");
    if (!(svg instanceof SVGSVGElement)) return;
    svgRef.current = svg;

    const plateOf = (node: EventTarget | null) => {
      const shape = node instanceof Element ? node.closest("[data-plate]") : null;
      return shape instanceof SVGElement ? shape.dataset.plate : undefined;
    };

    // ONE delegated listener for 81 shapes (INP, SPEC §11.3). MapZoomPan's capture-phase
    // click swallow sits on the ancestor container, so a click that was really a drag is
    // stopped before it reaches this handler — panning the map can never answer a
    // question, at no cost here.
    const onClick = (event: MouseEvent) => {
      const plate = plateOf(event.target);
      if (plate) handlePlate(plate);
    };

    // Keyboard equivalent. A `<path role="button">` gets no synthetic click from the
    // browser, so Enter/Space must be handled explicitly (WCAG 2.1.1). MapZoomPan's own key
    // handler ignores everything unless the SVG ITSELF is focused, so the two never
    // collide: zoom keys act on the map surface, answer keys act on a shape.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const plate = plateOf(event.target);
      if (!plate) return;
      event.preventDefault(); // Space would otherwise scroll the page
      handlePlate(plate);
    };

    svg.addEventListener("click", onClick);
    svg.addEventListener("keydown", onKeyDown);
    return () => {
      svg.removeEventListener("click", onClick);
      svg.removeEventListener("keydown", onKeyDown);
    };
  }, [handlePlate]);

  // --- DOM sync: picture ⇄ widget ----------------------------------------------------------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const stage = svg.closest("[data-game-map]");
    const nameByPlate = new Map(
      shapes
        .filter((shape) => shape.target !== null)
        .map((shape) => [shape.plateCode, shape.target?.name ?? ""]),
    );

    if (playing) {
      // `role="img"` makes the whole subtree presentational, so it has to come off before a
      // single shape can be exposed as a control.
      svg.removeAttribute("role");
      svg.removeAttribute("focusable");
      if (stage instanceof HTMLElement && modeId) stage.dataset.gameMode = modeId;
    }

    for (const shape of svg.querySelectorAll("[data-plate]")) {
      if (!(shape instanceof SVGElement)) continue;
      const name = nameByPlate.get(shape.dataset.plate ?? "");
      if (playing && name) {
        shape.setAttribute("role", "button");
        shape.setAttribute("tabindex", "0");
        // The accessible name is the province's own name in BOTH modes. In region mode that
        // leaks nothing: which region a province belongs to is precisely what the mode
        // asks, and it is never written on the map (SPEC §6.1, §8.2).
        shape.setAttribute("aria-label", name);
        shape.removeAttribute("aria-hidden");
      } else {
        shape.removeAttribute("role");
        shape.removeAttribute("tabindex");
        shape.removeAttribute("aria-label");
        if (playing) shape.setAttribute("aria-hidden", "true");
        else shape.removeAttribute("aria-hidden");
      }
    }

    if (!playing) {
      svg.setAttribute("role", "img");
      svg.setAttribute("focusable", "false");
      if (stage instanceof HTMLElement) delete stage.dataset.gameMode;
    }
  }, [playing, modeId, shapes]);

  // --- DOM sync: answer marks ----------------------------------------------------------------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const solved = new Set(
      (round?.results ?? []).filter((result) => result.score > 0).map((result) => result.targetId),
    );
    const revealed = feedback?.kind === "revealed" ? feedback.targetId : null;

    for (const shape of svg.querySelectorAll("[data-plate]")) {
      if (!(shape instanceof SVGElement)) continue;
      const plate = shape.dataset.plate ?? "";
      const targetId = activeSet?.plateToTarget[plate];
      let state: "correct" | "wrong" | "reveal" | null = null;
      if (round && targetId) {
        if (solved.has(targetId)) state = "correct";
        if (revealed !== null && targetId === revealed) state = "reveal";
        if (plate === wrongPlate) state = "wrong";
      }
      if (state) shape.setAttribute("data-state", state);
      else shape.removeAttribute("data-state");
    }
  }, [round, feedback, wrongPlate, activeSet]);

  // --- timers -----------------------------------------------------------------------------------
  useEffect(() => {
    if (!wrongPlate) return;
    const timer = window.setTimeout(() => setWrongPlate(null), WRONG_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [wrongPlate]);

  useEffect(() => {
    if (round?.status !== "resolved" || !feedback) return;
    const hold = feedback.kind === "correct" ? CORRECT_HOLD_MS : REVEAL_HOLD_MS;
    const timer = window.setTimeout(goNext, hold);
    return () => window.clearTimeout(timer);
  }, [round, feedback, goNext]);

  useEffect(() => {
    if (!round || round.status === "finished") return;
    const timer = window.setInterval(() => setClockNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [round]);

  // Move focus to the live question when a round opens, so a keyboard or screen-reader user
  // is told the page changed instead of being left on the card they just activated.
  useEffect(() => {
    if (playing) questionRef.current?.focus();
  }, [playing]);

  // --- render -------------------------------------------------------------------------------------
  const summary = round ? summarizeRound(round, clockNow) : null;
  const finishedRound = round?.status === "finished" ? round : null;

  const formatClock = useCallback(
    (ms: number) => {
      const total = Math.max(0, Math.round(ms / 1000));
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return minutes > 0
        ? t("durationLong", { minutes, seconds })
        : t("durationShort", { seconds });
    },
    [t],
  );

  if (!round) {
    const saved = progress.round;
    return (
      <div className={styles.hud}>
        <p className={styles.hudIdle}>{t("hudIdle")}</p>
        {saved ? (
          <div className={styles.resume} role="group" aria-label={t("resumeHeading")}>
            <p className={styles.resumeText}>
              {t("resumeBody", {
                mode: t(saved.modeId === "regions" ? "mode1Name" : "mode2Name"),
                done: saved.results.length,
                total: saved.order.length,
              })}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryAction} onClick={resumeSaved}>
                {t("resumeContinue")}
              </button>
              <button type="button" className={styles.action} onClick={discardSaved}>
                {t("resumeDiscard")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (finishedRound && summary) {
    return (
      <div className={styles.hud}>
        <p className={styles.hudScore}>{t("summaryScore", { score: summary.score })}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => setSummaryDismissed(false)}
          >
            {t("summaryReopen")}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => startRound(finishedRound.modeId)}
          >
            {t("summaryReplay")}
          </button>
          <button type="button" className={styles.action} onClick={changeMode}>
            {t("summaryChangeMode")}
          </button>
        </div>
        <GameSummary
          open={!summaryDismissed}
          summary={summary}
          targets={targetSets[finishedRound.modeId].targets}
          previousBest={previousBest}
          provinceUrlTemplate={provinceUrlTemplate}
          formatClock={formatClock}
          onClose={() => setSummaryDismissed(true)}
          onReplay={() => startRound(finishedRound.modeId)}
          onChangeMode={changeMode}
          onClearProgress={clearProgress}
        />
      </div>
    );
  }

  const tone = feedback?.kind ?? null;
  const feedbackText = !feedback
    ? ""
    : feedback.kind === "correct"
      ? t("feedbackCorrect", { name: labelOf(feedback.targetId), score: feedback.score })
      : feedback.kind === "retry"
        ? t("feedbackRetry", {
            name: labelOf(feedback.pickedId),
            score: currentQuestionPoints(round),
          })
        : t("feedbackRevealed", { name: labelOf(feedback.targetId) });

  return (
    <div className={styles.hud} data-tone={tone ?? undefined}>
      <p className={styles.question} ref={questionRef} tabIndex={-1} aria-live="polite">
        <span className={styles.questionLead}>{t("questionLead")}</span>{" "}
        <strong className={styles.questionName}>{labelOf(currentTargetId(round))}</strong>
      </p>

      <p className={styles.meta}>
        <span>{t("metaProgress", { index: round.index + 1, total: round.order.length })}</span>
        <span aria-hidden="true">·</span>
        <span>{t("metaWorth", { score: currentQuestionPoints(round) })}</span>
        <span aria-hidden="true">·</span>
        <span>{formatClock(elapsedMs(round, clockNow))}</span>
      </p>

      {/* Every state the map expresses with colour is ALSO said in words here — colour is
          never the only signal (DESIGN.md §6.1 rule 3) — and this same sentence is what a
          screen reader hears, because the line is the round's live region. */}
      <p className={styles.feedback} role="status" aria-live="polite">
        {feedbackText ? (
          <>
            <span className={styles.feedbackMark} aria-hidden="true">
              {tone === "correct" ? "✓" : tone === "retry" ? "✕" : "▸"}
            </span>{" "}
            {feedbackText}
          </>
        ) : null}
      </p>

      <div className={styles.actions}>
        {round.status === "resolved" ? (
          <button type="button" className={styles.primaryAction} onClick={goNext}>
            {t("next")}
          </button>
        ) : (
          <button type="button" className={styles.action} onClick={showAnswer}>
            {t("showAnswer")}
          </button>
        )}
        <button type="button" className={styles.action} onClick={leaveRound}>
          {t("leaveRound")}
        </button>
      </div>
    </div>
  );
}
