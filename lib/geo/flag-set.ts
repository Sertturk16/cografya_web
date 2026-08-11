import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import "server-only";

/**
 * ISO 3166-1 alpha-2 → flag SVG asset. Build-time only; the package never reaches the client.
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
 * that actually exists: `flagIsoCodes()` trusts this map without a `stat`, so a key with no
 * file would let the card render and then 404 the asset.
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
 * `overrides` is injectable so the resolution ORDER can be unit-tested with a synthetic map:
 * the real map is empty today, and a test that asserts "QN resolves locally" would be
 * asserting a fact about a file this phase deliberately does not create.
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

/**
 * The set of ISO codes that have SOME flag asset — one directory read per process, so the
 * country page's "does this row get a flag card" check is a `Set` lookup rather than a `stat`
 * on every render.
 */
let availableIsoCodes: ReadonlySet<string> | null = null;

export function flagIsoCodes(): ReadonlySet<string> {
  if (availableIsoCodes !== null) return availableIsoCodes;
  const codes = new Set<string>(Object.keys(LOCAL_FLAG_OVERRIDES));
  try {
    for (const file of readdirSync(packageFlagDir())) {
      if (!file.endsWith(".svg")) continue;
      const code = file.slice(0, -".svg".length);
      // The set carries 14 non-ISO-3166-1 keys (four international organisations and ten
      // sub-national/dependent entries such as `gb-eng`, `es-ct`, `sh-ac`). They can never
      // match an api `isoCode`, but filtering them out here keeps the exported set honest
      // about what it is: a map of ISO alpha-2 codes.
      if (!/^[a-z]{2}$/.test(code)) continue;
      codes.add(code.toUpperCase());
    }
  } catch {
    // A missing package is a build/environment fault, not a page fault: every flag card then
    // takes the fail-soft path and every country page still renders.
  }
  availableIsoCodes = codes;
  return availableIsoCodes;
}

/** Does this ISO code have a flag asset? Drives the fail-soft gate on the country page. */
export function hasFlag(iso: string): boolean {
  return flagIsoCodes().has(iso.trim().toUpperCase());
}

/** The raw SVG bytes for one ISO code, or `null` when it has no asset. */
export function readFlagSvg(iso: string): string | null {
  const resolved = resolveFlag(iso);
  if (resolved === null) return null;
  return readFileSync(resolved.path, "utf8");
}
