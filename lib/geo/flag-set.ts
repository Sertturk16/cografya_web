import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import "server-only";

/**
 * ISO 3166-1 alpha-2 → flag SVG asset. Server-only; the package never reaches the client.
 * Files are read while prerendering and again on first on-demand generation after a seed.
 *
 * ## Resolution order (→ plan §7.3, DEC 2026-08-08c md.2)
 *
 * ```
 * 1. local override map  → a file we produced ourselves, committed under assets/flags/
 * 2. the flag-icons set  → node_modules/flag-icons/flags/4x3/{iso}.svg
 * 3. neither             → fail-soft: the card is not rendered at all, never an empty <img>
 * ```
 *
 * The local layer comes FIRST so a package file can be replaced without a second mechanism,
 * and it is a bare `Record` rather than a plugin/registry abstraction because there is
 * exactly one candidate entry and no second use case (AO-6 / YAGNI).
 *
 * **It carries exactly one entry, `QN` (KKTC), and that entry is why the layer exists.** The
 * upstream maintainer declined that flag three times on explicit political grounds (issues
 * #549, #1186, #1268), so the set covers 198 of the 199 seeded rows. Rendering `CY` with a
 * flag and `QN` without one is the asymmetry DEC 2026-08-08c md.2 called "not silently
 * neutral"; the owner ruled that we close it with our own asset (DEC 2026-08-08m), and
 * DEC 2026-08-08p fixed how that asset is built — 3:2, from the published dimension table
 * alone. `assets/flags/qn.svg` carries the full derivation. Its geometry was verified
 * independently of whoever drew it (DEC 2026-08-08n).
 *
 * The fail-soft third step therefore no longer manages a known gap. It is a defence line: a
 * row added to the seed tomorrow must not drop into a broken `<img>`.
 *
 * ## Licence
 *
 * `flag-icons` is MIT (`node_modules/flag-icons/LICENSE`, first line "The MIT License (MIT)").
 * MIT asks that the copyright notice travel with the distribution, which is why the package is
 * named in the `/hakkimizda` map-data section. Font Awesome Free and the CC BY sets were
 * excluded by the owner and must not be introduced here.
 */

/**
 * Where the `flag-icons` 4x3 set lives, resolved once per process.
 *
 * `process.cwd()` is the project root during `next build` and for a Node server started from
 * it; pnpm places a `flag-icons` symlink there. Resolved lazily so an environment without the
 * package fails at the first flag read with a clear path, not at module load.
 *
 * `turbopackIgnore` is required, not cosmetic: without it Turbopack's file tracer sees a
 * `process.cwd()`-rooted path, cannot statically bound it, and pulls the WHOLE project into
 * the route's NFT list (it warns about exactly this). The path is statically scoped to one
 * directory, which is the condition the tracer's own guidance names.
 */
function packageFlagDir(): string {
  return join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    "flag-icons",
    "flags",
    "4x3",
  );
}

/** The pinned package's own declaration of the files that make up its flag corpus. */
function packageFlagManifestPath(): string {
  return join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    "flag-icons",
    "country.json",
  );
}

/** Where our OWN flag assets live (committed, not in `public/` — one gate, one URL). */
function localFlagDir(): string {
  return join(/*turbopackIgnore: true*/ process.cwd(), "assets", "flags");
}

/**
 * ISO codes we serve from our own committed asset instead of the package.
 *
 * The key is the UPPERCASE ISO code the api uses; the value is the file name under
 * `assets/flags/`, lower-cased to match the package's own naming so the two layers read the
 * same way on disk. `lib/geo/flag-set.test.ts` pins that every key here resolves to a file
 * that actually exists, and catalogue construction refuses to publish any layer unless the
 * package enumeration and every local override both succeed.
 */
export const LOCAL_FLAG_OVERRIDES: Readonly<Record<string, string>> = { QN: "qn.svg" };

/** Which layer a flag came from — the unit tests assert the ORDER, not the file list. */
export type FlagOrigin = "local" | "package";

export interface ResolvedFlag {
  readonly origin: FlagOrigin;
  /** Absolute path on disk. */
  readonly path: string;
}

/**
 * Resolve one ISO code to a flag asset, or `null` when neither layer has it.
 *
 * `overrides` and `dirs` are injectable so the resolution ORDER can be unit-tested against a
 * synthetic directory pair. That keeps the mechanism's tests from naming any country: the
 * shipped map's one entry is a product decision, and a test that hard-codes it would fail the
 * day the decision changes rather than the day the mechanism breaks. The shipped map is
 * checked separately, by key, in `flag-set.test.ts`.
 */
export function resolveFlag(
  iso: string,
  overrides: Readonly<Record<string, string>> = LOCAL_FLAG_OVERRIDES,
  dirs: { local?: string; package?: string } = {},
): ResolvedFlag | null {
  const code = iso.trim().toUpperCase();
  if (code.length === 0) return null;

  const localName = overrides[code];
  if (localName !== undefined) {
    const path = join(dirs.local ?? localFlagDir(), localName);
    if (existsSync(path)) return { origin: "local", path };
  }

  const path = join(dirs.package ?? packageFlagDir(), `${code.toLowerCase()}.svg`);
  if (existsSync(path)) return { origin: "package", path };

  return null;
}

interface FlagCatalogueSources {
  readonly packageFiles: () => Iterable<string>;
  readonly expectedPackageFiles: () => Iterable<string>;
  readonly localOverrideOrigin: (code: string) => FlagOrigin | null;
}

/**
 * Read the expected 4x3 filenames from `flag-icons`' own manifest.
 *
 * This is deliberately package-owned structure rather than a frontend country list. A
 * missing/malformed manifest, malformed row, duplicate path or incomplete directory is an
 * infrastructure fault and must abort catalogue publication.
 */
export function expectedPackageFlagFiles(manifestJson: string): ReadonlySet<string> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestJson);
  } catch (error) {
    throw new Error(`[flag-set] flag-icons country.json is not valid JSON: ${String(error)}`);
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("[flag-set] flag-icons country.json must be a non-empty array");
  }

  const expected = new Set<string>();
  for (const [index, row] of manifest.entries()) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error(`[flag-set] flag-icons country.json row ${index} is malformed`);
    }
    const flagPath = (row as { flag_4x3?: unknown }).flag_4x3;
    if (typeof flagPath !== "string") {
      throw new Error(`[flag-set] flag-icons country.json row ${index} has no 4x3 path`);
    }
    const match = /^flags\/4x3\/([a-z0-9-]+\.svg)$/.exec(flagPath);
    const file = match?.[1];
    if (file === undefined) {
      throw new Error(`[flag-set] flag-icons country.json row ${index} has an invalid 4x3 path`);
    }
    if (expected.has(file)) {
      throw new Error(`[flag-set] flag-icons country.json repeats ${file}`);
    }
    expected.add(file);
  }

  return expected;
}

/**
 * Build one complete local + package catalogue without publishing intermediate state.
 *
 * Package manifest parsing and enumeration deliberately run before local overrides. If either
 * fails, or if a non-throwing listing omits any manifest-declared 4x3 file, no local-only Set
 * exists even briefly. If a local override is missing, the otherwise-complete package Set is
 * discarded too. The caller memoises only the returned Set.
 *
 * Sources are injectable so CI can prove the failure branch. The production source stays a
 * direct directory read; no alternate catalogue or fallback list is introduced.
 */
export function buildFlagIsoCodes(
  sources: FlagCatalogueSources = {
    packageFiles: () => readdirSync(packageFlagDir()),
    expectedPackageFiles: () =>
      expectedPackageFlagFiles(readFileSync(packageFlagManifestPath(), "utf8")),
    localOverrideOrigin: (code) => resolveFlag(code)?.origin ?? null,
  },
): ReadonlySet<string> {
  const codes = new Set<string>();
  const expectedFiles = sources.expectedPackageFiles();
  const listedFiles = new Set(sources.packageFiles());

  for (const file of expectedFiles) {
    if (!listedFiles.has(file)) {
      throw new Error(`[flag-set] incomplete flag-icons package: missing ${file}`);
    }
    if (!file.endsWith(".svg")) continue;
    const code = file.slice(0, -".svg".length);
    // The set carries 14 non-ISO-3166-1 keys (four international organisations and ten
    // sub-national/dependent entries such as `gb-eng`, `es-ct`, `sh-ac`). They can never
    // match an api `isoCode`, but filtering them out here keeps the exported set honest
    // about what it is: a map of ISO alpha-2 codes.
    if (!/^[a-z]{2}$/.test(code)) continue;
    codes.add(code.toUpperCase());
  }

  for (const code of Object.keys(LOCAL_FLAG_OVERRIDES)) {
    if (sources.localOverrideOrigin(code) !== "local") {
      throw new Error(`[flag-set] local override ${code} does not resolve to a local asset`);
    }
    codes.add(code);
  }

  return codes;
}

/** Memoise only successful loads; a thrown load is retried rather than frozen as absence. */
export function memoizeFlagCatalogue(load: () => ReadonlySet<string>): () => ReadonlySet<string> {
  let memo: ReadonlySet<string> | null = null;
  return () => {
    if (memo !== null) return memo;
    const complete = load();
    memo = complete;
    return complete;
  };
}

/**
 * The set of ISO codes that have SOME flag asset — one complete directory read per process,
 * so the country page's gate is a Set lookup rather than a stat on every render.
 */
const loadAvailableIsoCodes = memoizeFlagCatalogue(buildFlagIsoCodes);

export function flagIsoCodes(): ReadonlySet<string> {
  return loadAvailableIsoCodes();
}

/** Does this ISO code have a flag asset? Drives the fail-soft gate on the country page. */
export function hasFlag(iso: string): boolean {
  return flagIsoCodes().has(iso.trim().toUpperCase());
}

/** The raw SVG bytes for one ISO code, or `null` when it has no asset. Read faults throw. */
export function readFlagSvg(
  iso: string,
  overrides: Readonly<Record<string, string>> = LOCAL_FLAG_OVERRIDES,
  dirs: { local?: string; package?: string } = {},
): string | null {
  const resolved = resolveFlag(iso, overrides, dirs);
  if (resolved === null) return null;
  return readFileSync(resolved.path, "utf8");
}

/** File extension of the public flag URL. The param carries it — see the route's docblock. */
export const FLAG_URL_SUFFIX = ".svg";

/**
 * Turn a `/flags/{param}` URL segment into an ISO code this repo is willing to serve, or
 * `null`.
 *
 * ## This is a SECURITY boundary, not a formatting helper
 *
 * The segment arrives from the URL and used to reach `path.join` + `readFileSync` with no
 * validation of any kind. `join()` collapses `../`, so a request could walk out of the flag
 * directory and have any readable `.svg` on the box returned from this site's own origin —
 * as active content, since SVG executes script when navigated to directly. Two accidental
 * constraints narrowed it (the appended suffix, the upper/lower round-trip) and neither was a
 * control; on a case-insensitive filesystem the second one does not exist at all.
 *
 * The asset allow-list was always one import away. Consulting it here bounds the filesystem
 * read to resolved local/package files; `lib/geo/flag-route.ts` then intersects this Set with
 * the current API corpus to decide which of those assets is public. The two gates close what a
 * separate review leg measured independently from the outside: `/flags/ES-CT.svg`,
 * `/flags/GB-ENG.svg` and `/flags/EU.svg` all returned 200, none of which is a seeded country.
 *
 * Case folding is normalisation, not sanitisation — the membership test is what makes this
 * safe, and it runs BEFORE anything touches the filesystem.
 *
 * Lives in `lib/` rather than in the route on purpose: `vitest.config.ts` collects
 * `lib/**` and nothing under `app/`, so a guard written in the handler would be the one piece
 * of this feature that CI could never check.
 */
export function flagParamToIso(
  param: string,
  available: ReadonlySet<string> = flagIsoCodes(),
): string | null {
  if (!param.endsWith(FLAG_URL_SUFFIX)) return null;
  const code = param.slice(0, -FLAG_URL_SUFFIX.length);
  // Shape first: two ASCII letters, nothing else. `..`, separators, encoded separators and
  // every other traversal payload fail here before the Set is even consulted.
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  const iso = code.toUpperCase();
  return available.has(iso) ? iso : null;
}
