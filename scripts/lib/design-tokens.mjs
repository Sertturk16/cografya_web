// @ts-check
/**
 * Terra tokens → the YAML frontmatter impeccable reads from a DESIGN.md (the Google Stitch
 * schema: `colors`, `typography`, `rounded`). impeccable resolves `docs/design.md` as the
 * project's DESIGN.md; without this block its detector cannot check colour, type or radius
 * drift and its live panel shows generic approximations.
 *
 * Everything is derived from `app/globals.css` except `INCUMBENT_TYPE_STEPS` below, which
 * records literal sizes the site already uses at scale and that no CSS variable carries.
 *
 * Colours are the UI palette only: raw Terra `--color-*` in `:root` as `terra-<name>`, and the
 * bridge tokens `@theme inline` re-exports to Tailwind (`bg-muted`, `text-link`) under their own
 * name, with their `.dark` values as `night-<name>`. Data-encoding tokens (`--region-*`,
 * `--eq-mag-*`, `--map-*`, ...) stay out on purpose: `docs/design.md` "brand chrome ≠ data", and a
 * palette entry is an invitation to colour UI with it. shadcn's `chart-*` and `sidebar-*` are
 * re-exported but have no call site. A bridge token that stops resolving to a literal colour
 * throws rather than silently leaving the palette.
 */

const UNUSED_BRIDGE = /^(chart-\d+|sidebar(-.*)?)$/;

const COLOR_LITERAL = /^(#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch|oklab)\([^()]*\))$/i;

/**
 * Literal type steps with no CSS variable behind them.
 * - `display-hub`: the hub-tier hero h1, `text-[1.9rem]` (`components/patterns/typography.tsx`,
 *   `docs/design.md` Typography: the 1.9rem floor is not negotiable).
 * - `label`: 11px, eyebrows, chips and source footnotes (`docs/design.md`: "11px, muted").
 * - `micro`: 10px, map legends and badge counters.
 */
const INCUMBENT_TYPE_STEPS = {
  "display-hub": { font: "heading", fontSize: "1.9rem", fontWeight: 700 },
  label: { font: "body", fontSize: "11px" },
  micro: { font: "body", fontSize: "10px" },
};

/** @param {string} css */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Body of the first top-level block whose selector matches `selector` exactly.
 * @param {string} css comment-free CSS
 * @param {RegExp} selector anchored at a line start, ending right before `{`
 * @returns {string}
 */
function blockBody(css, selector) {
  const m = selector.exec(css);
  if (!m) return "";
  let depth = 0;
  const open = css.indexOf("{", m.index);
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`Unbalanced block for ${selector}`);
}

/**
 * Custom properties declared directly in a block, in source order.
 * @param {string} body
 * @returns {Map<string, string>}
 */
function customProps(body) {
  /** @type {Map<string, string>} */
  const props = new Map();
  for (const [, name = "", value = ""] of body.matchAll(/--([\w-]+)\s*:\s*([^;{}]+);/g)) {
    props.set(name, value.trim());
  }
  return props;
}

/**
 * Follows `var(--x)` through the given scopes until a literal colour; null otherwise.
 * @param {string} value
 * @param {Map<string, string>[]} scopes innermost first
 * @returns {string | null}
 */
function resolveColor(value, scopes) {
  let current = value;
  for (let hops = 0; hops < 20; hops++) {
    if (COLOR_LITERAL.test(current)) return current;
    const ref = /^var\(--([\w-]+)\)$/.exec(current)?.[1];
    if (ref === undefined) return null;
    const next = scopes.map((s) => s.get(ref)).find((v) => v !== undefined);
    if (next === undefined) return null;
    current = next;
  }
  return null;
}

/**
 * Declarations of the first rule whose selector is exactly `selector`.
 * @param {string} css comment-free CSS
 * @param {string} selector
 * @returns {Map<string, string>}
 */
function ruleDecls(css, selector) {
  for (const [, sel = "", body = ""] of css.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    if (sel.trim() !== selector) continue;
    /** @type {Map<string, string>} */
    const decls = new Map();
    for (const [, prop = "", value = ""] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
      decls.set(prop, value.trim());
    }
    return decls;
  }
  return new Map();
}

/**
 * Fails the generator instead of writing a hole: a value the frontmatter promises (a bridge
 * token Tailwind exports, the base type ramp) that no longer parses is a globals.css shape this
 * file must learn, and `design:tokens:check` would otherwise pass on the degraded output.
 * @param {string | null | undefined} value
 * @param {string} what
 * @returns {string}
 */
function required(value, what) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`design-tokens: could not resolve ${what} from app/globals.css`);
  }
  return value;
}

/** `var(--font-nunito-sans), system-ui` → `Nunito Sans, system-ui` */
function fontStack(/** @type {string} */ value) {
  return value.replace(/var\(--font-([\w-]+)\)/g, (_, /** @type {string} */ name) =>
    name
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  );
}

/** `0.625rem` → 10 (px) */
function remToPx(/** @type {string} */ value) {
  const m = /^([\d.]+)rem$/.exec(value);
  if (!m) throw new Error(`Expected a rem length, got ${value}`);
  return Number(m[1]) * 16;
}

function px(/** @type {number} */ n) {
  return `${Number(n.toFixed(2))}px`;
}

/**
 * @param {string} rawCss contents of app/globals.css
 */
export function extractTokens(rawCss) {
  const css = stripComments(rawCss);
  const root = customProps(blockBody(css, /^:root,\s*\.light\s*\{/m));
  const dark = customProps(blockBody(css, /^\.dark\s*\{/m));
  const theme = customProps(blockBody(css, /^@theme inline\s*\{/m));

  /** @type {Record<string, string>} */
  const colors = {};
  const add = (/** @type {string} */ key, /** @type {string | null} */ value) => {
    if (value) colors[key] = value;
  };
  for (const [name, value] of root) {
    if (name.startsWith("color-")) add(`terra-${name.slice(6)}`, resolveColor(value, [root]));
  }
  /** @type {string[]} */
  const bridge = [];
  for (const [name, value] of theme) {
    const target = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
    if (!name.startsWith("color-") || target !== name.slice(6)) continue;
    if (!target.startsWith("color-") && !UNUSED_BRIDGE.test(target)) bridge.push(target);
  }
  for (const name of bridge) add(name, required(resolveColor(`var(--${name})`, [root]), name));
  for (const name of bridge) {
    if (!dark.has(name)) continue;
    add(`night-${name}`, required(resolveColor(`var(--${name})`, [dark, root]), `.dark ${name}`));
  }

  const heading = fontStack(root.get("font-heading") ?? "");
  const body = fontStack(root.get("font-body") ?? "");
  const bodyRule = ruleDecls(css, "body");
  const h1 = ruleDecls(css, "h1");
  const h2 = ruleDecls(css, "h2");

  /** @type {Record<string, Record<string, string | number>>} */
  const typography = {
    display: {
      fontFamily: heading,
      fontSize: required(h1.get("font-size"), "h1 font-size"),
      fontWeight: Number(required(h1.get("font-weight"), "h1 font-weight")),
    },
    headline: {
      fontFamily: heading,
      fontSize: required(h2.get("font-size"), "h2 font-size"),
      fontWeight: Number(required(h2.get("font-weight"), "h2 font-weight")),
    },
    body: {
      fontFamily: body,
      fontSize: required(bodyRule.get("font-size"), "body font-size"),
      lineHeight: Number(required(bodyRule.get("line-height"), "body line-height")),
    },
  };
  for (const [role, step] of Object.entries(INCUMBENT_TYPE_STEPS)) {
    const { font, ...rest } = step;
    typography[role] = { fontFamily: font === "heading" ? heading : body, ...rest };
  }

  const base = remToPx(root.get("radius") ?? "");
  /** @type {Record<string, string>} */
  const rounded = {};
  for (const [name, value] of theme) {
    if (!name.startsWith("radius-")) continue;
    const factor = /^calc\(var\(--radius\) \* ([\d.]+)\)$/.exec(value);
    if (factor) rounded[name.slice(7)] = px(base * Number(factor[1]));
    else if (value === "var(--radius)") rounded[name.slice(7)] = px(base);
    else throw new Error(`--${name}: unsupported radius form "${value}"; teach extractTokens it`);
  }
  const focusRadius = ruleDecls(css, ":focus-visible").get("border-radius");
  if (focusRadius) rounded.focus = focusRadius;

  return { colors, typography, rounded };
}

/** @param {unknown} v */
function yamlScalar(v) {
  return typeof v === "number" ? String(v) : JSON.stringify(v);
}

/**
 * @param {ReturnType<typeof extractTokens>} tokens
 * @returns {string}
 */
export function renderFrontmatter(tokens) {
  const lines = [
    "---",
    "# Generated by `pnpm design:tokens` from app/globals.css. Do not edit by hand.",
    'name: "Coğrafya Gurmesi (Terra)"',
    'description: "Earth / topographic: terracotta, olive and water-teal on warm parchment."',
    "colors:",
    ...Object.entries(tokens.colors).map(([k, v]) => `  ${k}: ${yamlScalar(v)}`),
    "typography:",
  ];
  for (const [role, props] of Object.entries(tokens.typography)) {
    lines.push(`  ${role}:`);
    for (const [k, v] of Object.entries(props)) lines.push(`    ${k}: ${yamlScalar(v)}`);
  }
  lines.push("rounded:");
  for (const [k, v] of Object.entries(tokens.rounded)) lines.push(`  ${k}: ${yamlScalar(v)}`);
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

/**
 * Puts `fm` at the top of `md`, replacing any frontmatter already there.
 * @param {string} md
 * @param {string} fm
 */
export function spliceFrontmatter(md, fm) {
  const rest = md.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n)+/, "");
  return `${fm}\n${rest}`;
}
