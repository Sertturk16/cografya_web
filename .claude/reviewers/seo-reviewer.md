# Reviewer role — seo-reviewer (web) — **RETIRED: folded into FENER**

> **Do not use this file as a role template.** The `seo-reviewer` role no longer exists as
> a separate reviewer. It was folded into **FENER** on 2026-07-18 (→ DEC 2026-07-18b,
> owner directive "bir tane olsun": the SEO authority must be SINGLE, so there is no second
> competing SEO voice).
>
> **Use instead:** `subagent_type: cografya-seo` (FENER).

## Where everything moved

| What you came here for                  | Where it lives now                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The SEO reviewer persona/prompt         | `.claude/agents/cografya-seo.md` (orchestrator home) — FENER is a **persona**, not a prompt template, so Atlas spawns it by `subagent_type` rather than by handing over a file like the roles below |
| The SEO rules being checked             | **`SEO-POLICY.md`** (orchestrator-home root) — the ONE canonical SEO document. Part A = authoring rules (shift-left, for NOVA + Vera), Part B = the audit checklist                                 |
| The in-repo non-negotiables restatement | `cografya_web/CLAUDE.md` §4 (still current, still binding)                                                                                                                                          |

## FENER's two modes (one role, not two)

1. **`review-pr` fan-out leg** — on web PRs, alongside code-reviewer / a11y-reviewer.
   Audits the PR's **code/template** surface (`SEO-POLICY.md` Part B §1–§9, §11) and
   reports on the shared reviewer severity scale: **CRITICAL / IMPORTANT / MINOR**.
2. **Wave-end / retroactive audit** — audits the **published corpus** over live rendered
   HTML (Part B §10, §12–§15 — the layer only visible in bulk, e.g. cross-page metadata
   near-duplication). Reports on FENER's own audit scale: **BLOCKER / UYARI / NOT**.

Mode 1 is subject to the roster right-sizing rules in `CONVENTIONS.md` §2 (→ DEC
2026-07-11/12) — see `README.md` for when the leg runs and when it is skipped.

_(This stub is intentionally kept rather than deleted: archived `pr-reviews/` files and
prior PR-review archives reference the `seo-reviewer` name, and a live pointer serves
whoever follows one of those trails better than a missing file.)_
