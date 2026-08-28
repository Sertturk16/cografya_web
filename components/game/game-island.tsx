"use client";

import {
  Fragment,
  // Aliased: the delegated SVG listener below takes the DOM's `MouseEvent`, and an unaliased
  // React import of the same name would shadow it in this file.
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { GameShapeTargetEntry } from "@/lib/game/map-shapes";
import { dispatchMapCamera } from "@/lib/map/map-camera";
import {
  advanceRound,
  answerRound,
  createRound,
  currentTargetId,
  finishEarly,
  revealRound,
  summarizeRound,
  type AnswerOutcome,
  type RoundState,
} from "@/lib/game/round";
import { deriveShapeState } from "@/lib/game/shape-state";
import {
  buildProvinceTargetSet,
  buildRegionTargetSet,
  targetsById,
  type GameModeId,
  type RegionLabels,
} from "@/lib/game/target";
import { RestartIcon } from "./game-icons";
import { GameSummary } from "./game-summary";
import styles from "./game-ui.module.css";

export interface GameIslandProps {
  /** Which pool this screen asks about. One page, one mode (→ DEC 2026-07-30p). */
  mode: GameModeId;
  /**
   * The answer-side view of the map's shapes — plaka kodu, name, region, slug. NO path
   * geometry: the path data is already in the server HTML and is never shipped a second
   * time as JavaScript (SPEC §3.3, enforced by the `GameShapeTargetEntry` type). In the
   * region mode this is already narrowed to that region, so the pool needs no filter here.
   */
  shapes: readonly GameShapeTargetEntry[];
  /** Localized region names, from the `Regions` message namespace. */
  regionLabels: RegionLabels;
  /**
   * May this screen offer "Turu bitir"? (→ DEC 2026-08-05g md. 2.)
   *
   * DERIVED on the server from the screen's own identity rather than decided here, so no
   * region round can acquire the button by accident (`game-screen.tsx`). A seven-question
   * round has nothing to escape from; an eighty-one-question one does.
   */
  allowEarlyFinish: boolean;
  /**
   * The locale's own province-detail path with `SLUG_PLACEHOLDER` where the slug goes,
   * resolved once on the server through `getPathname`. Passing the resolved shape rather
   * than rebuilding routes on the client keeps localized-URL resolution in exactly one
   * place (SEO-POLICY §B7 7.4) — the island only substitutes a slug into it.
   */
  provinceUrlTemplate: string;
  /** The shop window's own localized path — the end screen's way back out. */
  hubUrl: string;
  /**
   * The game-round save payload's `mode` tag (UYELIK-10 plan §5.5), resolved once on the
   * server (`game-screen.tsx`) from `mode`/`region` — an opaque string, the same shape as
   * `provinceUrlTemplate`/`hubUrl` above. Forwarded to `<GameSummary>` unchanged; this
   * island never inspects or re-derives it.
   */
  submitModeTag: string;
  /**
   * The route's own locale (UYELIK-10 plan §5.6) — forwarded to `<GameSummary>`'s save
   * control for the anonymous-reader redirect, the same `CODE85-M5` reasoning
   * `login-form.tsx`/`register-form.tsx`/`FavoriteButton` already carry: `next/navigation`'s
   * plain `useRouter` is deliberately paired with an EXPLICIT `getPathname({ locale, href })`
   * result rather than `@/i18n/navigation`'s own locale-aware router, which would apply a
   * SECOND locale prefix on top of one already resolved.
   */
  locale: Locale;
}

/**
 * The server-rendered box under the map that the round's controls are portalled into.
 *
 * Read as an EXTERNAL STORE, because that is what it is: a piece of DOM this island does
 * not own and did not render. `subscribe` has nothing to listen to — the slot is
 * server-rendered once per page and never replaced — but `useSyncExternalStore` re-reads
 * the snapshot after the commit and re-renders if it changed, which is the entire point
 * here (see {@link GameIsland}).
 */
const subscribeToActionSlot = () => () => {};
const readActionSlot = (): HTMLElement | null => {
  const node = document.querySelector("[data-game-actions]");
  return node instanceof HTMLElement ? node : null;
};
/** There is no server render of this island (`ssr: false`), so there is nothing to read. */
const noActionSlot = () => null;

/**
 * ---- THE TWO SHAPE QUERIES, AND WHY THEY ARE DIFFERENT -----------------------------------
 *
 * Since the map went to layered `<use>` twins (`game-map.tsx`), a single plaka kodu is
 * carried by TWO elements: the painted one in the base layer and the invisible hit twin above
 * it. An unscoped `svg.querySelectorAll("[data-plate]")` therefore returns 162 elements where
 * it used to return 81, and this island has two loops that each need a DIFFERENT half of that
 * — so both are scoped explicitly, and `game-map.layers.test.ts` pins both.
 *
 * HIT_SHAPES — the control surface. `role="button"`, `tabindex` and `aria-label` belong to
 * exactly ONE element per province: putting them on both twins would double the tab order
 * (162 stops) and announce every province twice. The hit twin is the right one, because it is
 * the element that actually receives the click and the key event.
 */
const HIT_SHAPES = '[data-map-layer="hit"] [data-plate]';
/**
 * PAINTED_SHAPES — both twins, deliberately. `data-state` is what the stylesheet paints a
 * right/wrong/revealed answer from, and that answer is now expressed in two places: the FILL
 * on the base twin, the LINE on the hit twin. Writing it to one of them would half-render
 * every answer. Written as an explicit two-part selector rather than left unscoped so that
 * "both twins" is a stated intention and not an accident of how many layers happen to carry
 * `data-plate` today — the region-silhouette layer deliberately carries none.
 */
const PAINTED_SHAPES = '[data-map-layer="base"] [data-plate], [data-map-layer="hit"] [data-plate]';

/**
 * Milliseconds the wrongly-picked shape stays marked before it returns (SPEC §5.3).
 *
 * Raised from 700 ms after the 2026-08-05 UX tour reported the wrong answer as "marked with
 * the same black stroke as hover" (B31). MEASURED, not guessed: at t+150 ms the picked shape
 * really is red (`rgb(192 57 43)` fill + dark dotted line) and by t+800 ms it is already
 * back to resting — the tour's screenshot was simply later than the flash. A signal that is
 * gone before the eye returns from the question line to the map is, for the player, a signal
 * that never happened.
 */
const WRONG_FLASH_MS = 1100;
/**
 * Auto-advance delay after a right answer. Also raised (900 → 1200) for the reason above:
 * the tour read the correct answer as having NO positive feedback (B23) while
 * `feedbackCorrect` was on screen the whole time — for 900 ms.
 *
 * A right answer keeps its timer: the player is already looking at the map, the shape stays
 * green for the rest of the round, and nothing here has to be READ.
 */
const CORRECT_HOLD_MS = 1200;

type Feedback = Exclude<AnswerOutcome, { kind: "ignored" }>;

/**
 * The play island of one game screen (SPEC §3.3, §5; mechanics → DEC 2026-07-30f/30h) —
 * loaded with `ssr: false`, so nothing here is in the served HTML and nothing here can
 * change it.
 *
 * It follows the repo's established "enhance the server HTML in place" pattern
 * (`MapHoverCard`, `MapZoomPan`): the `<path>` elements are ALREADY on the page, so the
 * island reaches them through `[data-game-map]`, binds ONE delegated listener to the
 * `<svg>`, and expresses every game state by writing `data-state` attributes. It never
 * re-renders the map — 81 React elements per answer is exactly the INP problem this design
 * avoids (CONVENTIONS §6 #9).
 *
 * THE ROUND STARTS ITSELF. Reaching this page IS the decision to play (the mode was chosen
 * on `/oyun`), so there is no "start" button to press twice. Leaving the page ends the
 * round: nothing is stored, in this browser or anywhere else (→ DEC 2026-07-30n).
 *
 * ACCESSIBILITY POSTURE. While no round is answerable the SVG stays what the server
 * shipped — ONE labelled image (`role="img"`), because anonymous, non-actionable tab stops
 * would be pure noise. While a round is live the island upgrades it: `role="img"` comes OFF
 * and every answerable shape becomes a real `role="button"` tab stop whose accessible name
 * is the province's name (WCAG 4.1.2). It is downgraded again when the round ends, so the
 * map is never a control that does nothing.
 *
 * Text carries every state the colours carry (`role="status"` line, DESIGN.md §6.1 rule 3),
 * and every timed transition has a "Devam" button that does the same thing immediately
 * (WCAG 2.2.1).
 */
export function GameIsland({
  mode,
  shapes,
  regionLabels,
  allowEarlyFinish,
  provinceUrlTemplate,
  hubUrl,
  submitModeTag,
  locale,
}: GameIslandProps) {
  const t = useTranslations("Game");

  const targetSet = useMemo(
    () =>
      mode === "regions"
        ? buildRegionTargetSet(shapes, regionLabels)
        : buildProvinceTargetSet(shapes),
    [mode, shapes, regionLabels],
  );
  const targetIds = useMemo(() => targetSet.targets.map((target) => target.id), [targetSet]);
  const labelOf = useMemo(() => {
    const index = targetsById(targetSet.targets);
    return (targetId: string | null) => (targetId ? (index.get(targetId)?.label ?? "") : "");
  }, [targetSet]);

  /**
   * The round, created on the FIRST render rather than in an effect. `createRound` shuffles,
   * so it must run exactly once per round; a lazy initializer is the one place React
   * guarantees that, and because this island is `ssr: false` there is no server render for
   * the randomness to disagree with.
   */
  const [round, setRound] = useState<RoundState>(() => createRound(mode, targetIds));
  /**
   * The targets already found this round — the map's one PERMANENT state.
   *
   * Hoisted out of the paint effect because two effects need it now: the paint effect writes
   * `data-state` (which the hatch is drawn from) and the accessible-name effect appends the
   * "solved" qualifier that says the same thing to a screen reader (→ PR #50 A11Y50-I1). One
   * derivation, so the picture and the name can never disagree about what is finished.
   */
  const solvedTargetIds = useMemo(
    () =>
      new Set(round.results.filter((result) => result.score > 0).map((result) => result.targetId)),
    [round.results],
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  /**
   * The most recent wrong answer, as the TARGET it named — not as the plate that was
   * clicked. In bölge mode a click answers for a whole region, and marking only the il
   * under the cursor made the red flash disagree with the green one, which covers the
   * whole region (`lib/game/shape-state.ts`).
   *
   * `seq` is what makes a repeat mistake re-flash. The flash is cleared by a timer keyed on
   * this state, and two wrong clicks inside the same region produce the SAME target id — so
   * without a changing companion value React would bail out of the update, the timer would
   * not restart, and the second mistake would fade on the first one's schedule.
   */
  const [wrongAnswer, setWrongAnswer] = useState<{ targetId: string; seq: number } | null>(null);
  /**
   * How many feedback events have happened, purely so the live region below can re-announce
   * one that repeats itself word for word.
   *
   * The same problem `wrongAnswer.seq` solves for the eye, one layer up. Click the wrong
   * region twice and `feedbackRetry` renders the IDENTICAL sentence both times; React sees
   * an unchanged string and touches no DOM node, so a polite live region has nothing to
   * observe and says nothing — the second mistake is silent for a screen-reader user. This
   * counter keys the sentence's fragment, so a repeat genuinely replaces the nodes inside
   * the live region and is announced again.
   *
   * It matters more since the map stopped reacting to a wrong click on an ALREADY-SOLVED
   * target (`lib/game/shape-state.ts`): there the text is the ONLY feedback there is.
   */
  const [feedbackSeq, setFeedbackSeq] = useState(0);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  /**
   * The portal target for the round's controls — RE-READ after the commit, never frozen at
   * the first render.
   *
   * `ssr: false` makes this island a `React.lazy` created ONCE at module scope. Only the
   * very first load suspends on the chunk and therefore renders with this page's HTML
   * already in the document. On every later client-side navigation the chunk is warm,
   * React renders the island SYNCHRONOUSLY, and the document still holds the PREVIOUS
   * page's DOM — so a value captured during that render is either `null` (hub → game: the
   * whole control strip then never mounts, silently, for the rest of the round) or the
   * outgoing page's detached slot node (game → game). Link prefetching means production
   * hits this on the FIRST click, not the second.
   *
   * `useSyncExternalStore` is what makes the stale read self-correcting: React verifies the
   * snapshot after committing and re-renders when it moved, so the portal lands in the
   * live slot. The slot's height is reserved by CSS either way, so the controls arriving a
   * frame later moves nothing (CLS budget, CONVENTIONS §6 #9).
   */
  const actionSlot = useSyncExternalStore(subscribeToActionSlot, readActionSlot, noActionSlot);

  const questionRef = useRef<HTMLParagraphElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  /**
   * The live round, for the DOM listeners. They are attached once, so reading `round`
   * through their closure would answer questions from an old state. Every write to it
   * happens inside a handler, next to the matching `setRound`.
   */
  const roundRef = useRef<RoundState>(round);
  /** Monotonic counter behind `wrongAnswer.seq` — see that state's note. */
  const wrongSeqRef = useRef(0);

  const interactive = round.status !== "finished";

  // --- round transitions (handlers and timers only) ------------------------------------
  /** Apply a round transition: to the listeners' ref and to React, in that order. */
  const commitRound = useCallback((next: RoundState) => {
    roundRef.current = next;
    setRound(next);
  }, []);

  /** Open a round: clear whatever the previous one left on screen, then commit it. */
  const beginRound = useCallback(
    (state: RoundState) => {
      setFeedback(null);
      setWrongAnswer(null);
      setSummaryDismissed(false);
      commitRound(state);
    },
    [commitRound],
  );

  /**
   * "Baştan başlat" (→ DEC 2026-07-30m). Guarded while a round is still in progress: it
   * throws away everything played so far and nothing is stored anywhere, so there is no
   * undo. A finished round has nothing left to lose, so replaying it just replays.
   */
  const restartRound = useCallback(() => {
    if (targetIds.length === 0) return;
    const current = roundRef.current;
    if (
      current.status !== "finished" &&
      current.results.length > 0 &&
      !window.confirm(t("confirmRestart"))
    ) {
      return;
    }
    beginRound(createRound(mode, targetIds));
  }, [beginRound, mode, t, targetIds]);

  /**
   * "Turu bitir" (→ DEC 2026-08-05g md. 2) — end the round now and show the result.
   *
   * NO CONFIRMATION, and that is the difference from "Baştan başlat": this action does not
   * throw anything away, it hands the player exactly what they have earned. A confirm dialog
   * in front of a non-destructive action teaches people to dismiss confirm dialogs.
   */
  const endRoundEarly = useCallback(() => {
    const next = finishEarly(roundRef.current);
    if (next === roundRef.current) return;
    setFeedback(null);
    setWrongAnswer(null);
    setSummaryDismissed(false);
    commitRound(next);
  }, [commitRound]);

  /** Dismiss the current question's feedback — the button and the timer share this. */
  const goNext = useCallback(() => {
    const current = roundRef.current;
    const next = advanceRound(current);
    if (next === current) return;
    setFeedback(null);
    commitRound(next);
    if (next.status === "finished") setSummaryDismissed(false);
  }, [commitRound]);

  /**
   * "Devam", as pressed by a POINTER.
   *
   * The second click of a double-click is dropped — the same guard, for a closely related
   * reason, that the map's own listener carries. Here the mechanism is React's: "Cevabı
   * göster" and "Devam" render at the same position with the same element type, so React
   * reuses the DOM node and swaps only the handler. A double-click therefore lands on BOTH
   * — click 1 shows the answer, click 2 advances straight past it — and the shown answer
   * flashes for the 150-300 ms between them. That is exactly the defect this PR exists to
   * remove, reachable by an impatient double-tap (→ PR #48 review CR48-I1).
   *
   * `detail` is the browser's own click counter and is 0 for a keyboard activation, so
   * Enter and Space on the button are untouched. The timer path does not go through here.
   */
  const onNextClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.detail > 1) return;
      goNext();
    },
    [goNext],
  );

  /** "Cevabı göster" — 0 points for this question, then on to the next (DEC 2026-07-30h). */
  const showAnswer = useCallback(() => {
    const { state, outcome } = revealRound(roundRef.current);
    if (outcome.kind === "ignored") return;
    setWrongAnswer(null);
    setFeedback(outcome);
    setFeedbackSeq((seq) => seq + 1);
    commitRound(state);
  }, [commitRound]);

  // --- answering (driven by the delegated DOM listeners) -------------------------------
  const handlePlate = useCallback(
    (plate: string) => {
      const pickedTargetId = targetSet.plateToTarget[plate];
      // A shape with no target is geographic backdrop, not a wrong answer: it must not
      // halve the question. Since the layer split an unseeded plate has no hit twin at all,
      // so a click on backdrop no longer even resolves a plaka kodu — but the base layer
      // still carries `data-plate` (it needs it for `data-state`), and this guard is what
      // keeps the answer path correct no matter which layer a future caller reads from.
      if (!pickedTargetId) return;
      const { state, outcome } = answerRound(roundRef.current, pickedTargetId);
      if (outcome.kind === "ignored") return;
      setFeedback(outcome);
      setFeedbackSeq((seq) => seq + 1);
      setWrongAnswer(
        outcome.kind === "retry"
          ? { targetId: pickedTargetId, seq: (wrongSeqRef.current += 1) }
          : null,
      );
      commitRound(state);
    },
    [commitRound, targetSet],
  );

  // --- DOM wiring: the pre-sized slots ---------------------------------------------------
  // The head slot ships a server-rendered sentence so it is neither empty nor useless
  // without JavaScript. Once the island is mounted that space is the island's, so the slot
  // is marked and CSS hides the static copy — no duplicate sentence, no layout jump. BEFORE
  // paint (`useLayoutEffect`), because a passive effect flushes after it.
  useLayoutEffect(() => {
    const head = document.querySelector("[data-game-head]");
    if (!(head instanceof HTMLElement)) return;
    head.dataset.gameReady = "true";
    return () => {
      delete head.dataset.gameReady;
    };
  }, []);

  // --- DOM wiring: the map ---------------------------------------------------------------
  useEffect(() => {
    const svg = document.querySelector("[data-game-map] svg");
    if (!(svg instanceof SVGSVGElement)) return;
    svgRef.current = svg;

    const plateOf = (node: EventTarget | null) => {
      const shape = node instanceof Element ? node.closest("[data-plate]") : null;
      return shape instanceof SVGElement ? shape.dataset.plate : undefined;
    };

    // ONE delegated listener for every shape (INP, SPEC §11.3). MapZoomPan's capture-phase
    // click swallow sits on the ancestor container, so a click that was really a drag is
    // stopped before it reaches this handler — panning the map can never answer a
    // question, at no cost here.
    const onClick = (event: MouseEvent) => {
      // Only the FIRST click of a click sequence is an answer. A double-click is one
      // gesture — MapZoomPan reads it as "zoom in here" — but the DOM still delivers two
      // `click` events, and on a wrong province the second one would halve the question a
      // second time (100 → 50 → 25 for a single mistake). `detail` is the click counter
      // the browser already keeps; a right answer was never affected, because the second
      // click lands while the question is `resolved` and is ignored anyway.
      if (event.detail > 1) return;
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

    if (interactive) {
      // `role="img"` makes the whole subtree presentational, so it has to come off before a
      // single shape can be exposed as a control.
      svg.removeAttribute("role");
      svg.removeAttribute("focusable");
    }

    // `data-game-active` — whether the map is a control surface RIGHT NOW (cursor, focus
    // ring), which stops the moment the round finishes. Its companion `data-game-mode` is
    // no longer written here: it says what the map LOOKS like, the server has always known
    // it, and one of its rules (the region mode's transparent water, `game-map.module.css`)
    // must hold from the first response rather than from the island's first effect. One
    // writer, and it is `game-map.tsx`.
    if (stage instanceof HTMLElement) {
      if (interactive) stage.dataset.gameActive = "true";
      else delete stage.dataset.gameActive;
    }

    // The HIT layer only (see HIT_SHAPES): one tab stop and one accessible name per province.
    // The base layer is `aria-hidden` as a whole and is never a control.
    for (const shape of svg.querySelectorAll(HIT_SHAPES)) {
      if (!(shape instanceof SVGElement)) continue;
      const plate = shape.dataset.plate ?? "";
      const name = nameByPlate.get(plate);
      if (interactive && name) {
        shape.setAttribute("role", "button");
        shape.setAttribute("tabindex", "0");
        // The accessible name is the province's own name in BOTH modes. In region mode that
        // leaks nothing: which region a province belongs to is precisely what the mode
        // asks, and it is never written on the map (SPEC §6.1, §8.2).
        //
        // PLUS "solved", once its target is (→ PR #50 review A11Y50-I1). Without it the map's
        // one permanent state was visible ONLY as paint: a sighted player keeps a glanceable
        // record of what is finished — that is the whole subject of I1 — while a screen-reader
        // user tabbing the same seven or eighty-one shapes heard the identical name at every
        // stop and had to remember the round instead of reading it.
        // It is a NAME SUFFIX rather than `aria-disabled`, because the shape is not disabled:
        // it still takes the click, and that click is still a wrong answer to the open
        // question (`lib/game/shape-state.ts` — the map declines to REPAINT it, the engine
        // still counts it). Announcing an operable control as disabled would trade a missing
        // signal for a false one.
        // It leaks nothing the hatch does not already show, and in bölge mode it names no
        // region: it says this AREA is done, never which bölge it belongs to (SPEC §8.2).
        const targetId = targetSet.plateToTarget[plate];
        const solved = targetId !== undefined && solvedTargetIds.has(targetId);
        shape.setAttribute("aria-label", solved ? t("shapeSolved", { name }) : name);
        shape.removeAttribute("aria-hidden");
      } else {
        shape.removeAttribute("role");
        shape.removeAttribute("tabindex");
        shape.removeAttribute("aria-label");
        if (interactive) shape.setAttribute("aria-hidden", "true");
        else shape.removeAttribute("aria-hidden");
      }
    }

    if (!interactive) {
      svg.setAttribute("role", "img");
      svg.setAttribute("focusable", "false");
    }
    // `solvedTargetIds` is in the list because the names now change DURING a round, not just
    // when it opens or closes. The loop is idempotent — it writes the same three attributes
    // every pass — so re-running it per answer costs 81 `setAttribute` calls next to the 162
    // the paint effect already makes, and it keeps ONE writer for the accessible name.
  }, [interactive, shapes, solvedTargetIds, targetSet, t]);

  // --- DOM sync: answer marks ----------------------------------------------------------------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const revealed = feedback?.kind === "revealed" ? feedback.targetId : null;

    // BOTH painted twins (see PAINTED_SHAPES): the base twin carries the answer's fill, the
    // hit twin carries its line. One `data-state`, written to the pair.
    for (const shape of svg.querySelectorAll(PAINTED_SHAPES)) {
      if (!(shape instanceof SVGElement)) continue;
      const state = deriveShapeState({
        targetId: targetSet.plateToTarget[shape.dataset.plate ?? ""],
        solvedTargetIds,
        revealedTargetId: revealed,
        wrongTargetId: wrongAnswer?.targetId ?? null,
      });
      if (state) shape.setAttribute("data-state", state);
      else shape.removeAttribute("data-state");
    }
  }, [feedback, wrongAnswer, targetSet, solvedTargetIds]);

  /**
   * --- DOM sync: the camera, for a SHOWN answer only (→ DEC 2026-08-17g md. 4) --------------
   *
   * THE DEFECT IT FIXES. Since the phone stage took a shape of its own, roughly half the
   * country's width is off screen at rest and panning is normal play. Press "Cevabı göster"
   * while looking at the east and Bolu is marked — somewhere you cannot see. The player
   * presses the one button whose entire job is to show them the answer and nothing appears to
   * happen.
   *
   * WHAT IS DELIBERATELY NOT DONE. No zoom, in either direction. Kâşif SPEC §7.2 bars
   * auto-zooming to a target because the zoom itself would answer the question; that ban is
   * absolute while the question is open, and this fires only once it has been given up on.
   * The pan is the smallest thing that makes the button honest, so it is the only thing sent.
   *
   * WHY IT DOES NOT READ `data-state`. The revealed shapes are resolved from the round's own
   * target id, so this effect does not depend on the paint effect above having run first —
   * two effects in one commit whose order is a fact about declaration order is exactly the
   * coupling that goes wrong when someone reorders them. It also fires once per shown answer:
   * `feedback` is a fresh object per outcome, and every other kind returns immediately.
   */
  useEffect(() => {
    if (feedback?.kind !== "revealed") return;
    const svg = svgRef.current;
    if (!svg) return;
    const revealed: SVGGraphicsElement[] = [];
    for (const node of svg.querySelectorAll(HIT_SHAPES)) {
      if (!(node instanceof SVGGraphicsElement)) continue;
      const plate = node.getAttribute("data-plate") ?? "";
      // In bölge mode every province of the region shares its target id, so this collects the
      // whole answer and the map pans to the union of it.
      if (targetSet.plateToTarget[plate] === feedback.targetId) revealed.push(node);
    }
    dispatchMapCamera(svg, revealed);
  }, [feedback, targetSet]);

  // --- timers -----------------------------------------------------------------------------------
  useEffect(() => {
    if (!wrongAnswer) return;
    const timer = window.setTimeout(() => setWrongAnswer(null), WRONG_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [wrongAnswer]);

  /**
   * Auto-advance — for a RIGHT answer only (→ B3, rider #1 of Kâşif PR-4a).
   *
   * A shown answer used to advance itself after 2400 ms, and that is the defect the owner
   * ranked first. The mechanism was never broken: measured on the running build, the
   * revealed province carries `data-state="reveal"` on both twins (fill `rgb(63 58 54)`,
   * 3px dashed line) and the sentence "▸ Bolu burası." is on screen from t+150 ms to
   * t+2400 ms. What was broken is the PRODUCT: the player asks for the answer, their eyes
   * are on the button they just pressed — under the map — and by the time they look up the
   * map has moved on. The one moment the whole mode exists to create ("Niğde neredeymiş?")
   * was spent on a timer nobody was watching.
   *
   * So a shown answer now WAITS. It stays until the player presses "Devam", which is also
   * the strictly better answer for WCAG 2.2.1: the timed transition is not merely
   * pausable, it is gone. `advanceRound` is unchanged — the button was always its caller.
   */
  useEffect(() => {
    if (round.status !== "resolved" || feedback?.kind !== "correct") return;
    const timer = window.setTimeout(goNext, CORRECT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [round, feedback, goNext]);

  // Move focus to the live question when a NEW round opens, so a keyboard or screen-reader
  // user is told what changed instead of being left on the button they pressed.
  //
  // Keyed on the QUESTION ORDER: every round gets a freshly shuffled array and a transition
  // inside a round keeps the same one, so this fires exactly once per round.
  //
  // NOT for the round the page opened with. That round was not something the reader did
  // here — it was the page loading — and hijacking focus on load drops them past the
  // header and the back link, with a focus ring around a heading they never asked to be
  // on. The browser already announces a new document; the question is right under its
  // heading and is a live region besides.
  const roundOrder = round.order;
  const initialOrderRef = useRef(round.order);
  useEffect(() => {
    if (roundOrder === initialOrderRef.current) return;
    questionRef.current?.focus();
  }, [roundOrder]);

  // --- render -------------------------------------------------------------------------------------
  const finished = round.status === "finished";
  const summary = useMemo(() => summarizeRound(round), [round]);

  /**
   * NOTHING TO ASK — say so, and stop.
   *
   * `getMapSummaryResilient()` is build-tolerant by design, so an api outage during
   * `next build` degrades every shape to `target: null` and that page still ships; an
   * unseeded region does the same to one screen. `createRound` on an empty pool returns a
   * round that is ALREADY `finished`, so without this guard the page opens straight onto
   * "Tur bitti · 0/0 · Hepsini bildiniz." over an empty map, with both end-screen buttons
   * dead (`restartRound` early-returns on the same empty pool). PR-2 refused that state
   * next to `startRound`; the guard left with that function, so it is re-stated here — at
   * render level, because there is no longer a moment when a round is NOT running.
   */
  if (targetIds.length === 0) {
    return (
      <div className={styles.head}>
        <p className={styles.emptyPool}>{t("emptyPool")}</p>
      </div>
    );
  }

  const tone = feedback?.kind ?? null;
  // A switch rather than a ternary chain: each branch reads a DIFFERENT field of the
  // outcome (`targetId` for what was asked, `pickedId` for what was clicked), and that is
  // the one thing a reader of this line has to get right. No branch names a point value —
  // scoring works silently and surfaces once, at the end (→ DEC 2026-07-30m).
  let feedbackText = "";
  if (feedback) {
    switch (feedback.kind) {
      case "correct":
        feedbackText = t("feedbackCorrect", { name: labelOf(feedback.targetId) });
        break;
      case "retry":
        feedbackText = t("feedbackRetry", { name: labelOf(feedback.pickedId) });
        break;
      case "revealed":
        feedbackText = t("feedbackRevealed", { name: labelOf(feedback.targetId) });
        break;
    }
  }

  /**
   * The control row under the map.
   *
   * NOTHING while the end-of-round dialog is open, and that absence is a fix: the dialog
   * carries its own "Tekrar oyna" and this row carried a second one, so the finished screen
   * offered the same action twice — once inside the modal and once behind it (owner + UX
   * tour, screenshot `30`). The row's height is reserved in CSS either way, so removing its
   * contents moves nothing (CLS budget, CONVENTIONS §6 #9).
   *
   * While a question is RESOLVED, "Devam" is the primary control. Since a shown answer no
   * longer advances itself, it is the only way forward — and it must not sit next to a
   * louder "Baştan başlat" that throws the whole round away.
   */
  /**
   * "Baştan başlat", written ONCE.
   *
   * The two branches below used to each spell this button out in full, differing in nothing
   * but which of the pair was the loud one — two copies of one control that had to be kept in
   * step by hand (→ PR #48 review, code-simplifier MINOR).
   *
   * ITS POSITION IS LOAD BEARING, so it does not move and it gets no `key`: it stays the
   * SECOND child of both branches. React reuses a DOM node by position and element type, and
   * PR #48's `event.detail > 1` guard on "Devam" (CR48-I1) exists precisely because the FIRST
   * child is reused across a status change. Re-ordering these, or keying them apart, would
   * change which node survives and reopen that defect. This dedup removes a duplicate, not a
   * structure.
   */
  const restartButton = (
    <button
      type="button"
      className={round.status === "resolved" ? styles.action : styles.primaryAction}
      onClick={restartRound}
    >
      <RestartIcon size={18} /> {t("restart")}
    </button>
  );

  /**
   * "Turu bitir" — offered only where the length of the round is the problem it solves
   * (→ DEC 2026-08-05g md. 2), and only once there is something to show.
   *
   * `results.length > 0` is the same guard `finishEarly` carries: ending a round before the
   * first answer would open a result screen with no result on it.
   */
  const canFinishEarly = allowEarlyFinish && !finished && round.results.length > 0;

  const actions = finished ? (
    summaryDismissed ? (
      <div className={styles.actions}>
        <button type="button" className={styles.primaryAction} onClick={restartRound}>
          {t("summaryReplay")}
        </button>
        <button type="button" className={styles.action} onClick={() => setSummaryDismissed(false)}>
          {t("summaryReopen")}
        </button>
      </div>
    ) : null
  ) : (
    <div className={styles.actions}>
      {round.status === "resolved" ? (
        <>
          <button type="button" className={styles.primaryAction} onClick={onNextClick}>
            {t("next")}
          </button>
          {restartButton}
        </>
      ) : (
        <>
          <button type="button" className={styles.action} onClick={showAnswer}>
            {t("showAnswer")}
          </button>
          {restartButton}
        </>
      )}
      {/* LAST, and outside the pair above: the two controls before it are the ones React
          reuses across a status change, so a new button in front of them would shift that
          reuse by one position. */}
      {canFinishEarly ? (
        <button type="button" className={styles.action} onClick={endRoundEarly}>
          {t("finishTour")}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={styles.head} data-tone={tone ?? undefined}>
      <p className={styles.question} ref={questionRef} tabIndex={-1} aria-live="polite">
        {finished ? (
          // The SAME partial-aware pair the dialog's heading uses (→ PR #50 review CR50-M4).
          // This line stays on screen after the dialog is dismissed, directly above the
          // progress pill CR50-I1 corrected — "Tur bitti · Soru 6/81" would have fixed the
          // number and left the sentence over it saying the map was finished.
          t(summary.endedEarly ? "summaryHeadingPartial" : "summaryHeading")
        ) : (
          <>
            <span className={styles.questionLead}>{t("questionLead")}</span>{" "}
            <strong className={styles.questionName}>{labelOf(currentTargetId(round))}</strong>
          </>
        )}
      </p>

      {/* ONE pill. The running-score pill that used to sit next to it is GONE — owner
          ruling, 2026-08-05 live tour, and it is the same philosophy DEC 2026-07-30m
          already applied to the per-question value: scoring works silently and surfaces
          once, at the end. A number that climbs while you play invites you to play for the
          number instead of for the map, and on question 3 of 81 it is not even a fair
          summary of how it is going. */}
      <p className={styles.pills}>
        <span className={styles.pill}>
          {t("metaProgress", {
            // FINISHED READS `summary.total`, NOT the pool size (→ PR #50 review CR50-I1).
            // Until "Turu bitir" existed the two were the same number by construction: the
            // only way to finish was to walk `index` past the end. `finishEarly` leaves the
            // index where the player stopped, so `order.length` here made the pill claim the
            // whole map had been played — behind a dialog whose entire job is to say it had
            // not. `summary.total` is the questions actually SCORED, which is the same
            // `order.length` on a completed round and the honest number on a half one.
            // `round.index + 1` is not the answer either: the question the player abandoned
            // was never answered.
            index: finished ? summary.total : round.index + 1,
            total: round.order.length,
          })}
        </span>
      </p>

      {/* Every state the map expresses with colour is ALSO said in words here — colour is
          never the only signal (DESIGN.md §6.1 rule 3) — and this same sentence is what a
          screen reader hears, because the line is the round's live region.

          The `key` is what makes a REPEATED sentence audible. The <p> itself never moves —
          a live region has to be in the document before the change to be announced at all —
          but its contents are keyed on the feedback counter, so a second identical wrong
          answer replaces the nodes instead of leaving an untouched text node, and AT
          announces it again (see `feedbackSeq`). A Fragment rather than a wrapper element:
          the mark and the sentence stay direct flex children of the line, so nothing about
          the layout changes. */}
      <p className={styles.feedback} role="status" aria-live="polite">
        {feedbackText ? (
          <Fragment key={feedbackSeq}>
            <span className={styles.feedbackMark} aria-hidden="true">
              {tone === "correct" ? "✓" : tone === "retry" ? "✕" : "▸"}
            </span>{" "}
            {feedbackText}
          </Fragment>
        ) : null}
      </p>

      {actionSlot ? createPortal(actions, actionSlot) : null}

      {finished ? (
        <GameSummary
          open={!summaryDismissed}
          summary={summary}
          targets={targetSet.targets}
          provinceUrlTemplate={provinceUrlTemplate}
          hubUrl={hubUrl}
          clientRoundId={round.clientRoundId}
          submitModeTag={submitModeTag}
          locale={locale}
          onClose={() => setSummaryDismissed(true)}
          onReplay={restartRound}
        />
      ) : null}
    </div>
  );
}
