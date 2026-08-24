# Codex Adapter — `cografya_web`

Before task actions, read `ENGINEERING.md` completely. It is the provider-neutral,
binding frontend handbook.

The Atlas dispatch is the task context and must provide the orchestration root as an
absolute path. From that root, explicitly open:

- the orchestration-root `AGENTS.md`
- the orchestration-root `ATLAS.md`
- the orchestration-root `STATE.md` only when task state matters
- every policy source required by the output type and named in the Atlas dispatch

The dispatch is a starting point, not a ceiling. Read `CONVENTIONS.md`, `SEO-POLICY.md`
and `CONTENT-STYLE.md` as far as the task needs;
economise on history ledgers by grepping the heading. **Reading more is not the failure
mode; missing a binding rule is** (→ DEC 2026-08-06w). Any reader-facing string obliges
`CONTENT-STYLE.md`, cited or not.

Codex-specific execution uses the `cografya-frontend-dev` profile from the orchestration
root's `.codex/agents/`. Vera is the single writer. Never edit the sibling
`cografya_api` repo; coordinate OpenAPI contract changes through Atlas.

CI is the only test-suite gate. Use only the local checks allowed by `ENGINEERING.md`.
Do not merge or run the PR-review fan-out; Atlas invokes `$review-pr`.

A nested repo launch loads this adapter but must not assume the parent orchestration root
or its agents/config were discovered automatically. Before using shared state or policy,
or a custom agent, explicitly read `AGENTS.md`, `ATLAS.md`, and when needed `STATE.md`
from the orchestration root supplied by Atlas; verify that root's `.codex` configuration
is active. If the root was not supplied or cannot be read, do not guess a path: stop
fail-closed and report the block to Atlas.
