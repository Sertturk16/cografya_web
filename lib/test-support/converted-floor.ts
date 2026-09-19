/**
 * WHERE A PINNED CSS VALUE GOES WHEN T-033 DELETES THE STYLESHEET THAT PINNED IT.
 *
 * `components/css-module-fixed-widths.test.ts` is a census of every fixed-`px` inline-axis
 * declaration in the surviving CSS Modules, and it exists for one measured defect:
 * `climate.module.css`'s `.chartFrame` carried a bare `min-width: 300px` and scrolled
 * `/turkiye/istanbul` 21px sideways at a 320px viewport. Its entry said so in as many words —
 * "if this line ever reads `min-width: 300px` again, this suite is where it stops".
 *
 * A T-033 conversion moves that declaration into a Tailwind class string in JSX, where the
 * census cannot read it. Two tasks did exactly that and left `pnpm sweep:overflow` as the only
 * cover: air's `max-w-[720px]` (task 3) and climate's `min-w-[min(300px,100%)]` (task 4). **The
 * sweep is not in `.github/workflows/ci.yml`** — CI runs typecheck, lint, the generate/codegen
 * checks, test and build — so on both files the guard became a command a human has to remember.
 *
 * THE RULE, for the conversions still to come: **when a conversion deletes a pinned CSS value,
 * the pin moves to the consumer's own test. It does not evaporate into the sweep.** This module
 * is the shared half of that pin, so the two (and counting) tests that carry one cannot drift in
 * how they read a constant — the shape `docs/conventions.md` calls two readers of one notation
 * that nothing compares.
 *
 * Only the EXTRACTION is shared. Each consumer test states its own value, its own rejected
 * spelling and its own reason, because those are facts about that component and not about this
 * helper.
 */

/**
 * The full text of a top-level `const NAME = …;` declaration, or `null` if there is none.
 *
 * Non-greedy to the first `;`, which is correct for a class-string constant (a Tailwind class
 * string contains no semicolon) and is why this is not offered for anything else.
 */
export function classConstant(source: string, name: string): string | null {
  const match = new RegExp(`const ${name} =[\\s\\S]*?;`).exec(source);
  return match === null ? null : match[0];
}

/**
 * Every `className={NAME}` site for a constant, so a pin can prove the constant it inspected is
 * the one the component actually renders. A pin that only reads the declaration stays green on a
 * constant nothing uses any more, which is the same green-copy-of-itself failure the census was
 * built to avoid.
 */
export function renderSites(source: string, name: string): number {
  return (source.match(new RegExp(`className=\\{${name}\\}`, "g")) ?? []).length;
}
