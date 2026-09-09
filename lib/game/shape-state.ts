/**
 * What a single map shape is showing right now — the play state the island writes onto the
 * server-rendered `<path>` as `data-state`, which `game-map.module.css` then paints.
 *
 * WHY THIS IS A PURE FUNCTION AND NOT AN INLINE BRANCH IN THE ISLAND.
 * The bug it exists to prevent is a real one that shipped: the CORRECT mark was derived
 * from the answered TARGET (so in bölge mode all of that region's provinces lit up), while
 * the WRONG mark was derived from the clicked PLATE (so a wrong bölge answer reddened the
 * single il under the cursor, not the region the player actually named). The two marks
 * disagreed about what "the thing the player picked" means.
 *
 * Both marks now resolve through the SAME target id, and the invariant is pinned by a test
 * (`shape-state.test.ts`): the set of shapes a wrong answer marks is exactly the set a
 * correct answer for that same target would mark. The repo's vitest environment is `node`
 * with no jsdom, so an island-level DOM test is not available — extracting the decision is
 * what makes the invariant testable at all.
 */

/** The four marks a shape can carry. Mirrors the `[data-state]` values in the CSS. */
export type ShapeState = "correct" | "wrong" | "shown" | "reveal";

export interface ShapeStateInput {
  /**
   * The target this shape belongs to — a province id in the il modes, a REGION id in the
   * bölge mode, and `undefined` for a shape the api never seeded. A shape with no target is
   * geographic backdrop: it is never an answer and therefore never marked.
   */
  readonly targetId: string | undefined;
  /** Targets already answered correctly (score > 0) at some point in this round. */
  readonly solvedTargetIds: ReadonlySet<string>;
  /**
   * Targets already GIVEN UP ON this round — every target `revealRound` scored 0 for
   * (`lib/game/round.ts`), which is the only way a `QuestionResult` ever scores 0. The map's
   * OTHER permanent mark (→ owner report, oyun-notlar.txt md. 1): "Cevabı göster" shows the
   * answer only for the CURRENT question (`revealedTargetId` below), and that flag is cleared
   * the moment "Devam" fires — so without this set, the distinction the player was just shown
   * vanished from the map one click later, even though the round's own "Bilemediklerin" list
   * (built from this exact same score-is-0 filter, `summarizeRound`'s `missedTargetIds`) kept
   * it correctly the whole time. This is what lets the map agree with that list for the rest
   * of the round instead of just for the one question it was asked about.
   */
  readonly shownTargetIds: ReadonlySet<string>;
  /** The target currently being shown by "Cevabı göster", if any. */
  readonly revealedTargetId: string | null;
  /** The target of the most recent wrong click, during its brief flash. */
  readonly wrongTargetId: string | null;
}

/**
 * Precedence, stated exactly — it is NOT a single total order, and the earlier one-line
 * version of this note ("solved beats wrong; revealed beats solved; wrong beats revealed")
 * read like a cycle because it left out the condition:
 *
 * - on a SOLVED or SHOWN target (i.e. one that already has a `QuestionResult` — found or
 *   given up on), the wrong mark never applies at all, and revealed still wins over either
 *   permanent mark;
 * - on a target with neither mark yet, wrong wins over revealed.
 *
 * SHOWN JOINS SOLVED IN THAT FIRST BULLET for the same reason solved was already there: a
 * shown target's question is over — `revealRound` moved the round past it — so a stray
 * click that happens to name it (bölge mode again: `wrongTargetId` is keyed on what the
 * clicked shape names, not on the open question, `game-island.tsx`) is a wrong answer to a
 * DIFFERENT, still-open question. It must not borrow that click to repaint an already-closed
 * one, the same way an earned `correct` must not be repainted lost.
 *
 * Only the solved/shown↔wrong half changed here. The solved↔revealed pair is carried over
 * untouched from the inline version this function replaced (and is not reachable in play
 * anyway: a target is asked once per round, so the target being revealed is by construction
 * one that has not been solved or shown before now).
 *
 * WHY SOLVED WINS OVER WRONG (→ PR #38 review I1). `answerRound` returns `retry` for ANY
 * pick that is not the open question's target — including a target the player already
 * earned. With the wrong mark keyed on the TARGET (this PR's fix), a misclick inside a
 * region that was solved three questions ago used to repaint that whole region dashed red
 * for 700 ms and then back to green. The map would be saying "you lost Marmara", which is
 * false: the score for that question is already banked and nothing can take it back.
 * A shape is allowed to show only things that are true, so an earned mark is permanent for
 * the round and the transient one yields to it.
 *
 * What the player loses in that case is the MAP's reaction to the click — the shape they
 * hit does not change at all. That is deliberate: the click is still a wrong answer to the
 * open question, and the HUD's `role="status"` line says so in words ("Burası Marmara.
 * Tekrar dene."). The text carries the whole signal there, which is why `game-island.tsx`
 * re-announces it even when the sentence repeats verbatim.
 *
 * On an unsolved target wrong still beats revealed, and such a target still flashes exactly
 * as before: wrong is the newest, shortest-lived thing that happened and it is what the
 * player needs to see at that moment. Scoring is untouched by this file and by this rule.
 */
export function deriveShapeState({
  targetId,
  solvedTargetIds,
  shownTargetIds,
  revealedTargetId,
  wrongTargetId,
}: ShapeStateInput): ShapeState | null {
  if (targetId === undefined) return null;
  const solved = solvedTargetIds.has(targetId);
  const shown = shownTargetIds.has(targetId);
  let state: ShapeState | null = solved ? "correct" : shown ? "shown" : null;
  if (revealedTargetId !== null && targetId === revealedTargetId) state = "reveal";
  if (!solved && !shown && wrongTargetId !== null && targetId === wrongTargetId) state = "wrong";
  return state;
}
