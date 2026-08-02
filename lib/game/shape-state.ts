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

/** The three marks a shape can carry. Mirrors the `[data-state]` values in the CSS. */
export type ShapeState = "correct" | "wrong" | "reveal";

export interface ShapeStateInput {
  /**
   * The target this shape belongs to — a province id in the il modes, a REGION id in the
   * bölge mode, and `undefined` for a shape the api never seeded. A shape with no target is
   * geographic backdrop: it is never an answer and therefore never marked.
   */
  readonly targetId: string | undefined;
  /** Targets already answered correctly (score > 0) at some point in this round. */
  readonly solvedTargetIds: ReadonlySet<string>;
  /** The target currently being shown by "Cevabı göster", if any. */
  readonly revealedTargetId: string | null;
  /** The target of the most recent wrong click, during its brief flash. */
  readonly wrongTargetId: string | null;
}

/**
 * Precedence: **solved beats wrong**; revealed still beats solved; wrong still beats
 * revealed. Only the first of those three changed here — the solved↔revealed pair is
 * carried over untouched from the inline version this function replaced (and is not
 * reachable in play anyway: a target is asked once per round, so the target being revealed
 * is by construction one that has not been solved).
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
 * Wrong still beats revealed and an unsolved target still flashes exactly as before: wrong
 * is the newest, shortest-lived thing that happened and it is what the player needs to see
 * at that moment. Scoring is untouched by this file and by this rule.
 */
export function deriveShapeState({
  targetId,
  solvedTargetIds,
  revealedTargetId,
  wrongTargetId,
}: ShapeStateInput): ShapeState | null {
  if (targetId === undefined) return null;
  const solved = solvedTargetIds.has(targetId);
  let state: ShapeState | null = solved ? "correct" : null;
  if (revealedTargetId !== null && targetId === revealedTargetId) state = "reveal";
  if (!solved && wrongTargetId !== null && targetId === wrongTargetId) state = "wrong";
  return state;
}
