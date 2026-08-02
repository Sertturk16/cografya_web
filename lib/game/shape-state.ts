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
 * Precedence, unchanged from the inline version it replaces: solved → revealed → wrong.
 * Wrong is last because it is the newest, shortest-lived thing that happened, and it is
 * what the player needs to see at that moment.
 */
export function deriveShapeState({
  targetId,
  solvedTargetIds,
  revealedTargetId,
  wrongTargetId,
}: ShapeStateInput): ShapeState | null {
  if (targetId === undefined) return null;
  let state: ShapeState | null = null;
  if (solvedTargetIds.has(targetId)) state = "correct";
  if (revealedTargetId !== null && targetId === revealedTargetId) state = "reveal";
  if (wrongTargetId !== null && targetId === wrongTargetId) state = "wrong";
  return state;
}
