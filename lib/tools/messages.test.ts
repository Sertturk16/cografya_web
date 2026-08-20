import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the CBS tool tier (the `lib/marine/messages.test.ts`
 * pattern, → PR #73 review `TEST73-I1`).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path.
 * On this tier that path reaches the SEO surface directly:
 * `app/[locale]/araclar/mesafe-olcme/page.tsx` feeds `Tools.mesafe.metaTitle` and
 * `metaDescription` straight into `buildMetadata`, so one renamed key ships
 * `<title>Tools.mesafe.metaTitle</title>` on an indexable page with all three CI jobs green
 * (`ENGINEERING.md` §4 #2).
 *
 * The TR-only / both-locale split is the second half and the sharper one. A minority of keys
 * are rendered outside the `rendersProse` / `rendersIntro` gates — head, headings, cards and
 * JSON-LD — and the rest exist in Turkish alone because `SEO-POLICY.md` §B14 bars
 * machine-translating the narrative. Nothing pinned that boundary, and every PR in this tier
 * has had to rewrite several of these same keys. The two lists below ARE the boundary, and
 * they are compared against the catalogue in both directions rather than counted here: a
 * written count is a second copy of a fact the assertion already establishes, and it went
 * stale within one PR of being written.
 *
 * Structural only (`CONVENTIONS.md` §2): every assertion is about whether a key RESOLVES, what
 * shape its value has, or which catalogue carries it — never about what any string says. The
 * one content-shaped assertion is a licence NEGATIVE guard on our own catalogue (AK-32), which
 * is the `components/book/attribution-gate.test.ts` precedent rather than a fact assertion.
 */

type Catalogue = Record<string, unknown>;

/** Walks a nested message object into `a.b.c` → value pairs. */
function flatten(node: unknown, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (typeof node !== "object" || node === null) return out;

  for (const [key, value] of Object.entries(node as Catalogue)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "object" && value !== null) {
      for (const [nested, nestedValue] of flatten(value, path)) out.set(nested, nestedValue);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const trTools = flatten((trMessages as Catalogue).Tools);
const enTools = flatten((enMessages as Catalogue).Tools);

/**
 * The namespaces whose copy is gated behind `locale === routing.defaultLocale`, and the ones
 * that are pure interface vocabulary and therefore symmetric. Asserted against the catalogue
 * below, so a new `Tools.*` namespace cannot slip past this file by not being mentioned in it.
 */
const PROSE_NAMESPACES = ["alan", "hub", "koordinat", "mesafe"] as const;
const CHROME_NAMESPACES = ["map", "ui"] as const;

/** Keys inside a prose namespace that BOTH locales render — head, headings, cards, JSON-LD. */
const BOTH_LOCALE_KEYS = [
  "hub.metaTitle",
  "hub.metaDescription",
  "hub.heading",
  "hub.mesafeName",
  "hub.mesafeBody",
  "hub.koordinatName",
  "hub.koordinatBody",
  "mesafe.metaTitle",
  "mesafe.metaDescription",
  "mesafe.heading",
  "mesafe.teaches",
  "mesafe.toolHeading",
  "koordinat.metaTitle",
  "koordinat.metaDescription",
  "koordinat.heading",
  "koordinat.teaches",
  "koordinat.toolHeading",
  "alan.metaTitle",
  "alan.metaDescription",
  "alan.heading",
  "alan.teaches",
  "alan.toolHeading",
  "hub.alanName",
  "hub.alanBody",
] as const;

/** Keys inside a prose namespace that exist in Turkish ONLY (§B14, the `/deniz` precedent). */
const TR_ONLY_KEYS = [
  "hub.introP1",
  "hub.introP2",
  "mesafe.lede",
  "mesafe.nedirHeading",
  "mesafe.nedirP1",
  "mesafe.nedirP2",
  "mesafe.karayoluHeading",
  "mesafe.karayoluP1",
  "mesafe.karayoluP2",
  "mesafe.olcekHeading",
  "mesafe.olcekP1",
  "mesafe.olcekP2",
  "mesafe.olcekP3",
  "mesafe.buyukdaireHeading",
  "mesafe.buyukdaireP1",
  "mesafe.buyukdaireP2",
  "mesafe.buyukdaireP3",
  "mesafe.sonucHeading",
  "mesafe.sonucP1",
  "mesafe.sonucP2",
  "mesafe.sonucP3",
  "mesafe.kaynak",
  "koordinat.lede",
  "koordinat.sistemHeading",
  "koordinat.sistemP1",
  "koordinat.sistemP2",
  "koordinat.sistemP3",
  "koordinat.derecekmHeading",
  "koordinat.derecekmP1",
  "koordinat.derecekmP2",
  "koordinat.gosterimHeading",
  "koordinat.gosterimP1",
  "koordinat.gosterimP2",
  "koordinat.gosterimP3",
  "koordinat.sonucHeading",
  "koordinat.sonucP1",
  "koordinat.sonucP2",
  "koordinat.sonucP3",
  "koordinat.kaynak",
  "alan.lede",
  "alan.sinirHeading",
  "alan.sinirP1",
  "alan.sinirP2",
  "alan.kureHeading",
  "alan.kureP1",
  "alan.kureP2",
  "alan.yuzolcumuHeading",
  "alan.yuzolcumuP1",
  "alan.yuzolcumuP2",
  "alan.yuzolcumuP3",
  "alan.sonucHeading",
  "alan.sonucP1",
  "alan.sonucP2",
  "alan.sonucP3",
  "alan.kaynak",
] as const;

function expectNonEmptyString(catalogue: Map<string, unknown>, key: string): void {
  const value = catalogue.get(key);
  expect(typeof value, `Tools.${key} must be a string`).toBe("string");
  expect((value as string).trim().length, `Tools.${key} must not be empty`).toBeGreaterThan(0);
}

function keysUnder(catalogue: Map<string, unknown>, namespace: string): string[] {
  return [...catalogue.keys()].filter((key) => key.startsWith(`${namespace}.`)).sort();
}

describe("the Tools namespace is fully classified", () => {
  it("declares exactly the namespaces this file knows how to judge", () => {
    // The anchor for everything below: a new `Tools.*` namespace has to be classified as prose
    // or chrome here before its keys can ship, rather than silently falling outside every
    // assertion in this file. `alan` arrived through exactly this gate in PR-D.
    expect(Object.keys((trMessages as Catalogue).Tools as Catalogue).sort()).toEqual(
      [...PROSE_NAMESPACES, ...CHROME_NAMESPACES].sort(),
    );
  });

  it("classifies every prose key as both-locale or TR-only, in both directions", () => {
    const declared = [...BOTH_LOCALE_KEYS, ...TR_ONLY_KEYS].sort();
    const actual = PROSE_NAMESPACES.flatMap((namespace) => keysUnder(trTools, namespace)).sort();
    // Equality, not containment: a new prose key must be classified (or it is unguarded), and a
    // classified key that no longer exists must be removed (or the lists rot into a claim about
    // yesterday's catalogue — review `TA56-M4`).
    expect(actual).toEqual(declared);
  });
});

describe("Tools.* keys both locales render", () => {
  for (const key of BOTH_LOCALE_KEYS) {
    it(`Tools.${key} is a non-empty string in tr and en`, () => {
      expectNonEmptyString(trTools, key);
      expectNonEmptyString(enTools, key);
    });
  }
});

describe("Tools.* keys that are Turkish-only by policy", () => {
  for (const key of TR_ONLY_KEYS) {
    it(`Tools.${key} exists in tr and NOT in en`, () => {
      expectNonEmptyString(trTools, key);
      // The absence is the assertion. `SEO-POLICY.md` §B14 bars machine-translating the
      // narrative, so `/en/tools*` renders the notice instead of these blocks. If genuine
      // English prose is ever WRITTEN, this is the reminder that the render gate has to open in
      // the same commit — the same shape `lib/marine/messages.test.ts` uses for `/en/sea`.
      expect(enTools.has(key)).toBe(false);
    });
  }
});

describe("Tools.* interface vocabulary is symmetric", () => {
  for (const namespace of CHROME_NAMESPACES) {
    it(`Tools.${namespace} declares the same key set in tr and en`, () => {
      expect(keysUnder(enTools, namespace)).toEqual(keysUnder(trTools, namespace));
    });

    it(`every Tools.${namespace} value is a non-empty string in both locales`, () => {
      const keys = keysUnder(trTools, namespace);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expectNonEmptyString(trTools, key);
        expectNonEmptyString(enTools, key);
      }
    });
  }

  it("keeps every cardinal letter exactly one character long", () => {
    // `lib/map/measure.ts`'s `CardinalLetters` contract, pinned at the BUNDLE for the first
    // time (→ review `CODE73-M10`). Its own test pins local fixtures, not these values, so a
    // copy edit to "Kuzey"/"North" would make every typed DMS coordinate unreadable — killing
    // the primary keyboard input path with CI green.
    for (const key of ["ui.north", "ui.south", "ui.east", "ui.west"]) {
      expect((trTools.get(key) as string).length, `Tools.${key} (tr)`).toBe(1);
      expect((enTools.get(key) as string).length, `Tools.${key} (en)`).toBe(1);
    }
  });
});

describe("licence compliance of the shipped tool copy", () => {
  // Atlas ruling AK-32: KGM's site terms bar commercial use, so its road-distance figure and
  // its name stay out of shipped strings (`CONVENTIONS.md` §7). The road-distance block names
  // only the DIRECTION of the difference. md.7.1 obliges PR-C/PR-D to restore three-tool
  // wording from the same draft revision that once carried the KGM sentence, which is why this
  // is a standing gate rather than the one-time grep it was.
  const BARRED_SOURCE = /\bKGM\b|Karayolları Genel Müdürlüğü/i;

  it("names no barred source anywhere in the Tools catalogue", () => {
    for (const [catalogue, label] of [
      [trTools, "tr"],
      [enTools, "en"],
    ] as const) {
      for (const [key, value] of catalogue) {
        expect(BARRED_SOURCE.test(String(value)), `Tools.${key} (${label})`).toBe(false);
      }
    }
  });

  it("uses a pattern that can actually see the barred source", () => {
    // Self-check: without it the assertion above means both "clean" and "the pattern is wrong",
    // and nothing in a green run tells the two apart. The control literals live here, never in
    // the catalogue they measure.
    for (const control of ["Kaynak: KGM, 2024.", "Karayolları Genel Müdürlüğü verisi"]) {
      expect(BARRED_SOURCE.test(control)).toBe(true);
    }
    expect(BARRED_SOURCE.test("Karayolu mesafesinden farkı")).toBe(false);
  });
});

/**
 * CONSUMER SCAN — the half the hand-maintained lists above cannot do.
 *
 * The lists can only prove that yesterday's keys still resolve. Discovering every file that
 * reaches for a `Tools.*` namespace, and reading the keys it asks for, ties them to the code:
 * a key requested by a file these lists have never heard of goes red here instead of rendering
 * its own dotted path in production (`components/site-nav/messages.test.ts:61-72`).
 */
const CONSUMER_ROOTS = [
  { label: "app/[locale]/araclar", url: new URL("../../app/[locale]/araclar/", import.meta.url) },
  { label: "components/tools", url: new URL("../../components/tools/", import.meta.url) },
] as const;

interface ToolsBinding {
  readonly path: string;
  /** The local translator name, e.g. `t` or `tHub`. */
  readonly binding: string;
  /** The namespace it was opened with, e.g. `Tools.hub`. */
  readonly namespace: string;
  readonly requested: readonly string[];
}

/** `useTranslations("Tools.ui")` and both `getTranslations` spellings. */
const DIRECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*"([^"]+)"\s*\)/g;
const OBJECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*\{[^}]*namespace:\s*"([^"]+)"[^}]*\}\s*\)/g;

/**
 * Every `Tools.*` binding one source file opens, and the keys each one asks for.
 *
 * ## DECLARATION-SCOPED, not file-scoped (→ PR #73 review `FIXV73-M4`)
 *
 * Keying a binding's calls by NAME over the whole file merges two bindings that share a name
 * and attributes every call to both. While every such pair opened the SAME namespace that was
 * lossless; the moment one file opens two DIFFERENT `Tools` namespaces under one local name —
 * `const t = await getTranslations("Tools.hub")` in `generateMetadata` and
 * `const t = await getTranslations("Tools.koordinat")` in the component, which is exactly the
 * shape this tier's pages take — every key resolves against the wrong namespace and the suite
 * goes red on correct code.
 *
 * So a REPEATED name is cut into windows: each declaration owns the source from itself to the
 * next redeclaration of that same name, and the first one owns everything before it too. A
 * name declared ONCE still owns the whole file, so this narrows only where the old key was
 * ambiguous and nothing that used to be scanned stops being scanned.
 *
 * Exported shape, one file's worth — `path` is attached by the caller.
 */
function scanBindings(source: string): Omit<ToolsBinding, "path">[] {
  const declared = [...source.matchAll(DIRECT_NAMESPACE), ...source.matchAll(OBJECT_NAMESPACE)]
    .filter((match) => match[2]?.startsWith("Tools"))
    .sort((a, b) => a.index - b.index);

  return declared.map((match, index) => {
    const binding = match[1]!;
    const namespace = match[2]!;
    const repeated = declared.filter((entry) => entry[1] === binding).length > 1;
    const next = declared.slice(index + 1).find((later) => later[1] === binding);
    const first = declared.findIndex((entry) => entry[1] === binding) === index;
    const window = repeated
      ? source.slice(first ? 0 : match.index, next?.index ?? source.length)
      : source;
    // `(?<![\w$.])` keeps `t(` from matching `format.t(` or `next(`; `.rich` is how the pages
    // pass province links into `karayoluP1`, `derecekmP2` and `sonucP3`.
    const calls = new RegExp(String.raw`(?<![\w$.])${binding}(?:\.rich)?\(\s*"([^"]+)"`, "g");
    return {
      binding,
      namespace,
      requested: [...window.matchAll(calls)].map((call) => call[1]!),
    };
  });
}

/** Comments out, so a docblock naming a key is not a request and one naming a namespace is not a binding. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

const bindings: ToolsBinding[] = CONSUMER_ROOTS.flatMap(({ label, url }) =>
  readdirSync(fileURLToPath(url), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(?:ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
    .flatMap((name) =>
      scanBindings(stripComments(readFileSync(fileURLToPath(new URL(name, url)), "utf8"))).map(
        (entry) => ({ ...entry, path: `${label}/${name}` }),
      ),
    ),
);

describe("the consumer scan itself", () => {
  // POSITIVE CONTROL for the scan, on fabricated source rather than on the files it measures:
  // a green suite below means both "every key resolves" and "the scan attributed each key to
  // the right namespace", and nothing in the output tells those apart without this.
  const FIXTURE = [
    'export async function generateMetadata() { const t = await getTranslations({ locale, namespace: "Tools.hub" }); return t("metaTitle"); }',
    'export default function Page() { const t = await getTranslations("Tools.koordinat"); const tb = useTranslations("Breadcrumb"); return t("heading") + tb("home"); }',
  ].join("\n");

  it("splits two same-named bindings that open different namespaces", () => {
    expect(scanBindings(FIXTURE)).toEqual([
      { binding: "t", namespace: "Tools.hub", requested: ["metaTitle"] },
      { binding: "t", namespace: "Tools.koordinat", requested: ["heading"] },
    ]);
  });

  it("still gives a name declared once the whole file, calls above it included", () => {
    const early = 'const read = () => t("kmShort");\nconst t = useTranslations("Tools.ui");';
    expect(scanBindings(early)).toEqual([
      { binding: "t", namespace: "Tools.ui", requested: ["kmShort"] },
    ]);
  });
});

describe("every Tools key the code asks for exists", () => {
  it("discovers a consumer for each of the five namespaces", () => {
    // Anti-vacuity, and the reason it is an equality: a scan that found nothing, or that lost a
    // surface to a refactor, would satisfy every per-key assertion below by having nothing to
    // check.
    expect([...new Set(bindings.map((entry) => entry.namespace))].sort()).toEqual([
      "Tools.hub",
      "Tools.koordinat",
      "Tools.map",
      "Tools.mesafe",
      "Tools.ui",
    ]);
  });

  it.each(bindings)("$path asks $namespace for keys the catalogue carries", (entry) => {
    expect(
      entry.requested.length,
      `${entry.path}: ${entry.binding} requests no key`,
    ).toBeGreaterThan(0);
    for (const key of entry.requested) {
      expectNonEmptyString(trTools, `${entry.namespace.replace(/^Tools\./, "")}.${key}`);
    }
  });
});
