# T-164 Search Index Kinds Implementation Plan

> **For agentic workers:** executed natively (superpowers:executing-plans) by the implementer.

**Goal:** Both search boxes (header and homepage hero) read one server index that also holds
regions, continents, seas, tools and section pages, ranked by one matcher.

**Architecture:** `buildSearchIndex` (pure, `lib/search/index-source.ts`) gains the new kinds;
the route resolves paths through `getPathname` and copy through a new `SearchIndex` message
namespace, and drops only a failed API source. A shared `useSearchIndex` hook owns fetching
for both islands; the hero swaps its substring filter for `searchPrepared`.

**Tech Stack:** Next.js 16 route handler, next-intl, vitest (node).

**Spec:** `TASKS.md` T-164 (scope A+B) and the orchestrator brief.

## Global Constraints

- Kinds and labels: İl, Ülke, Bölge, Kıta, Deniz, Araç, Sayfa (EN Province, Country, Region,
  Continent, Sea, Tool, Page).
- Regions 7 → `/turkiye/bolge/[slug]`, continents 7 → `/dunya/kita/[slug]`, seas 4 →
  `/deniz/{karadeniz,marmara,ege,akdeniz}`; EN index uses EN paths and names.
- A failing source drops only its own kind; no API/contract change; districts/aliases are T-166.
- Keep "Sonuç bulunamadı."; label/placeholder name the new types (docs/copy.md).

## Review Focus

- "Asya" must rank the continent above Amasya (exact beats substring) — match test.
- A name that is both region and sea ("Karadeniz", "Ege") returns both rows — match test.
- Provinces API down → index still serves continents/seas/regions/tools — index test.
- Keyword match must never outrank a name match (e.g. "deniz") — match test.
- EN index must not carry TR paths — index test.

---

### Task 1: Index kinds and keywords (types + builder)

**Files:** `lib/search/types.ts`, `lib/search/index-source.ts`, `lib/search/index-source.test.ts`

- Kinds `p c r k s t g`; optional 4th tuple field `keywords`; guard accepts it.
- `buildSearchIndex({ provinces|null, countries|null, locale, pathOf, text })` emits
  provinces, countries, regions (REGION_KEYS), continents (getAllContinents), seas, tools,
  pages. Tests: counts per kind, EN paths/names, null source drops only its kind.

### Task 2: Matcher keywords + ranking tests

**Files:** `lib/search/match.ts`, `lib/search/match.test.ts`

- Keywords matched at word-prefix/substring tiers only. Tests for Asya/Amasya, region+sea
  pair, keyword below name.

### Task 3: Route + messages

**Files:** `app/api/search-index/[locale]/route.ts`, `messages/{tr,en}.json`,
`lib/search/messages.test.ts`

- `Promise.allSettled`; degraded response `no-store`. `SearchIndex` namespace and kind labels.

### Task 4: Shared fetch hook, header labels, hero on the shared matcher

**Files:** `components/site-search/use-search-index.ts`, `search-combobox.tsx`,
`components/v2/v2-hero.tsx`, `lib/search/kind-label.ts` (+ test)

- Hero loads the per-locale index on focus, uses `searchPrepared`, renders kind badges.

### Task 5: Verify

- typecheck, lint, test; acceptance queries in both boxes on :3000 TR + EN; sweep:overflow;
  impeccable audit; PR into dev.
