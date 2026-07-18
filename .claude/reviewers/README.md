# Reviewer assets — `cografya_web`

Committed, auditable role templates for the **Autonomous PR-Review Loop** on the web repo.
These are the files **Atlas loads to run the reviewer fan-out**. They are not runnable by
the engineers — see the loop note below.

## The loop

Every PR → **Atlas runs the reviewer fan-out on the MAIN THREAD** (engineers have no
`Agent` tool by design → they cannot spawn reviewers → the review stays **independent of
the author**, which is the entire point). Atlas spawns each roster reviewer as a
fresh-context `general-purpose` agent, **anchored to this PR's worktree/branch diff only**,
and hands it the matching role template below. Each reviewer is **read-only**, writes its
findings to `pr-reviews/{PR#}-{role}.md`, and returns a distilled, severity-tagged summary
to Atlas. **CRITICAL findings get per-finding adversarial validation** (a second agent
tries to break the claim before it counts). Then the **authoring engineer (Vera) runs the
Critical Architect Filter** on the collected findings (protocol in `cografya_web/CLAUDE.md`
§8) → acts only on correctness/security/SEO-correctness/requirement items, annotates every
skipped item in English, commits & pushes → if any Critical/Important was fixed, Atlas
re-runs the fan-out and Vera re-filters → **re-loop until no Critical/Important remains** →
Atlas archives `pr-reviews/{PR#}.md` to
`Owner's Inbox/pr-review-archive/{repo}-{PR#}.md`.

> **Only Atlas (main thread) runs the fan-out.** A subagent (Vera/Deniz) invoking a review
> skill would read "spawn reviewers" and be unable to — no `Agent` tool — and even if
> granted, an author spawning their own reviewers reintroduces the exact bias the loop
> exists to remove. Keep engineers Agent-tool-less; keep the fan-out Atlas-only.

## Roster (web)

Atlas drives the fan-out through the **`review-pr` skill** in the Atlas workspace
(`.claude/skills/review-pr/SKILL.md`), which landed and made its first live run on PR #16.
Reviewers are still spawned as fresh `general-purpose` agents, each pinned to the PR diff
and given its template below (FENER is the exception — a real subagent, see the note after
the table):

**The roster is RIGHT-SIZED BY PR SHAPE — "always" applies only to code-reviewer**
(→ DEC 2026-07-11 / 2026-07-12, pace levers; the shape rules themselves are **binding and
live in `CONVENTIONS.md` §2**, which wins over this table on any conflict). Atlas evaluates
each "Runs" condition against the actual diff before spawning; skipping a reviewer whose
condition is unmet is correct behaviour, not a shortcut.

| Role                 | Model    | Runs                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **code-reviewer**    | `opus`   | **Always**, no exception — correctness, architecture, contract/type safety                                                                                                                                                                                                                                                                                              |
| **FENER** (SEO)      | `sonnet` | Spawned as `subagent_type: cografya-seo` (**not** from a file here). When the diff touches the SEO surface — metadata/`buildMetadata`, routing/slugs, canonical/hreflang, JSON-LD, `sitemap.ts`/`robots.ts`/`llms.txt`, or data-fetching/schema. **Skipped on a presentation-only diff** (JSX/markup, copy/i18n values, styling, assets — touching no SEO surface) per `CONVENTIONS.md` §2. Note: a **rendering-mode change** (SSG→SSR/CSR, adding `dynamic(… { ssr: false })` around content) is a data-fetching change, NOT presentation-only — it still triggers FENER |
| **a11y-reviewer**    | `sonnet` | When the diff touches **rendered UI** — markup/semantics, interactive components, focus/keyboard behaviour, color/contrast tokens, motion. Skipped on a diff with no user-visible surface (pure data/config/docs)                                                                                                                                                       |
| **pr-test-analyzer** | `sonnet` | When the PR touches tests, or changes logic that should have been tested                                                                                                                                                                                                                                                                                                |
| **code-simplifier**  | `sonnet` | When the PR adds non-trivial logic that may be over-built                                                                                                                                                                                                                                                                                                               |

**Escalation overrides right-sizing** (→ DEC 2026-07-18b K7): when a PR is flagged as an
escalation, run the full roster regardless of the conditions above.

> **The SEO leg is FENER, and FENER is the ONLY SEO voice** (→ DEC 2026-07-18b, owner
> directive "bir tane olsun"). The retired `seo-reviewer.md` in this folder is now just a
> pointer stub. FENER's rules live in **`SEO-POLICY.md`** (orchestrator-home root, the one
> canonical SEO document); in the fan-out it reports on the CRITICAL/IMPORTANT/MINOR scale
> below, while its wave-end/retroactive audit mode uses BLOCKER/UYARI/NOT.

(api-repo roster — code-reviewer + security-privacy-reviewer + silent-failure-hunter —
lives in `cografya_api/.claude/reviewers/`, Deniz's half, right-sized by the same
`CONVENTIONS.md` §2 rules.)

## Severity taxonomy (shared with api — do not diverge)

- **CRITICAL** — blocks merge: correctness / security / data-loss / SEO-breaking. **A
  concrete failure scenario is required** to call something critical (not a hunch).
- **IMPORTANT** — a real defect or standards violation (a11y, SEO-correctness, validation)
  that must be fixed before merge, but is not catastrophic.
- **MINOR** — cleanup / nit / deferrable; the filter decides whether to act now or defer.

Reviewers and the filter share this vocabulary so a "CRITICAL" from a reviewer means the
same thing the filter weighs.

## Output contract (every reviewer template restates it)

- **Read-only.** Do not create, edit, delete, move, or rename ANY file — including leftover
  files in `pr-reviews/` from prior PRs. Your only write is your own findings file.
- **Anchor to the PR diff only.** Judge what this PR changes (and its direct blast radius),
  not the whole pre-existing codebase.
- Write findings to **`pr-reviews/{PR#}-{role}.md`**, grouped by severity
  (CRITICAL / IMPORTANT / MINOR), each with: file:line, a concrete failure scenario (for
  CRITICAL/IMPORTANT), and a concrete fix.
- Return to Atlas a **distilled severity-tagged summary** — never a raw dump; the detail
  lives in your findings file.

## Directory layout

```
cografya_web/
  CLAUDE.md                       # engineering ground-truth + Filter protocol (§8)
  DESIGN.md                       # Terra design system + data-viz color doctrine
  .claude/reviewers/
    README.md                     # this file
    code-reviewer.md
    seo-reviewer.md               # RETIRED — pointer stub → FENER (subagent_type: cografya-seo)
    a11y-reviewer.md
    pr-test-analyzer.md
    code-simplifier.md
  pr-reviews/                     # transient run workspace (gitignored); Atlas archives it
```
