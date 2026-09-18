import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO BUTTON IS NAMED BY `title=` ALONE.
 *
 * ## The defect
 *
 * `title` is not an accessible name. It is exposed inconsistently across screen readers, it
 * never appears on keyboard focus, and it never appears on touch at all. An icon-only
 * `<button title="Yakınlaştır">` is, for most of the people who need the name, an unnamed
 * button — announced as "button", with nothing to distinguish it from the one next to it.
 *
 * T-036 found thirteen of them, all in the two map explorers' floating toolbars: zoom in,
 * zoom out, reset, the region/continent grouping toggle, the table view, the alphabetical
 * index, and the region-colour toggle. Four had a visible label that disappears under `sm:`
 * (`<span className="hidden sm:inline">`), so on a phone the name vanished for everyone.
 *
 * All thirteen now carry `aria-label`, read from `messages/{tr,en}.json`. This keeps it at
 * zero.
 *
 * ## Why the regex is scoped to `<button` opening tags
 *
 * Counting raw `title=` cannot work, and the two reasons are both live in this repo:
 *
 *   - `components/book/deneme-video.tsx` has `<iframe title={title}>`. That one is MANDATORY
 *     (WCAG H64); a test that flagged it would be asking for a violation.
 *   - `<Specimen title=`, `<DenemeVideo title=` and `<BenchStage title=` are PROPS of our own
 *     components. They never reach the DOM as an attribute, and no regex over source text can
 *     tell them from one that does — except by only looking at tags it knows are real DOM
 *     elements. The control below keeps using `<Callout title=`, a component T-042 deleted,
 *     because it is SYNTHETIC source: the shape it proves the scanner ignores is any
 *     capitalised tag, and pinning it to a component that exists today would make the control
 *     die the next time that component does.
 *
 * So the scan reads `<button …>` opening tags and nothing else. It says nothing about `title`
 * on a `<span>`, an `<a>` or an `<abbr>`; those are separate judgements (a decorative span
 * takes `aria-hidden`, a truncated cell's `title={full value}` is correct and stays).
 */

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

/** Everything a reader can reach, plus the showcase — a specimen sets the example too. */
const ROOTS = ["app", "components"] as const;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });
}

/**
 * A `<button` opening tag, up to its closing `>`.
 *
 * `[^>]` would stop at the first `>` inside an expression — `onClick={() => …}` and
 * `className={x > 1 ? …}` both contain one — and would then miss every attribute after it,
 * including the `aria-label` this test is looking for. So the tag body allows a `>` that is
 * part of `=>` or `>=`, and stops only at a `>` that really closes the tag.
 */
const BUTTON_TAG = /<button(\s(?:[^>]|=>|>=)*?)\/?>/g;

interface Offender {
  readonly file: string;
  readonly tag: string;
}

const offenders: Offender[] = ROOTS.flatMap((root) => walk(join(repoRoot, root))).flatMap(
  (file) => {
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(BUTTON_TAG)]
      .filter((match) => /\btitle=/.test(match[1]!) && !/\baria-label=/.test(match[1]!))
      .map((match) => ({ file: relative(repoRoot, file), tag: match[0].slice(0, 120) }));
  },
);

describe("the scan itself", () => {
  // POSITIVE CONTROL on fabricated source, not on the files it measures: with zero offenders
  // expected, a broken regex and a clean repo produce exactly the same green.
  const scan = (source: string) =>
    [...source.matchAll(BUTTON_TAG)].filter(
      (match) => /\btitle=/.test(match[1]!) && !/\baria-label=/.test(match[1]!),
    ).length;

  it("flags a button named only by title", () => {
    expect(scan('<button type="button" title="Yakınlaştır"><ZoomIn /></button>')).toBe(1);
  });

  it("does not flag a button that also has aria-label", () => {
    expect(scan('<button title="Yakınlaştır" aria-label="Yakınlaştır"><ZoomIn /></button>')).toBe(
      0,
    );
  });

  it("reads past an arrow function and a comparison in the tag body", () => {
    // The exact shape a `[^>]*` tag pattern loses: everything after the `>` of `=>` would be
    // invisible, so the `aria-label` at the end would never be seen and this would be a false
    // positive. It is also why `>=` is spelled out in the pattern.
    const tag =
      '<button onClick={() => setZoom(z => z + 1)} disabled={z >= 8} title="Yakınlaştır" aria-label="Haritayı Yakınlaştır">';
    expect(scan(tag)).toBe(0);
  });

  it("is not flagging the mandatory iframe title or our own components' title props", () => {
    expect(scan("<iframe title={title} src={src} />")).toBe(0);
    // Synthetic, and deliberately a component that no longer exists — see the docblock.
    expect(scan('<Callout variant="note" title="Tanım">')).toBe(0);
  });

  it("walked real files", () => {
    // Anti-vacuity for the assertion below: "no offenders" must mean the scan looked.
    const files = ROOTS.flatMap((root) => walk(join(repoRoot, root)));
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((file) => file.endsWith("v2-turkey-map-explorer.tsx"))).toBe(true);
  });
});

describe("no <button> is named by title= alone", () => {
  it("has no offenders anywhere under app/ or components/", () => {
    expect(offenders, offenders.map((entry) => `${entry.file}: ${entry.tag}`).join("\n")).toEqual(
      [],
    );
  });
});
