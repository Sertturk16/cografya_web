# Codex Adapter — `cografya_web`

Before task actions, read `ENGINEERING.md` completely. It is the provider-neutral,
binding frontend handbook.

For shared process and product state, also read:

- the orchestration-root `ATLAS-OPERATIONS.md`
- the orchestration-root `CONVENTIONS.md`
- the orchestration-root `SEO-POLICY.md`
- the orchestration-root `TASKS.md` when task state matters
- the other relevant root policy documents

Codex-specific execution uses the `cografya_frontend_dev` profile from the orchestration
root's `.codex/agents/`. Vera is the single writer. Never edit the sibling
`cografya_api` repo; coordinate OpenAPI contract changes through Atlas.

CI is the only test-suite gate. Use only the local checks allowed by `ENGINEERING.md`.
Do not merge or run the PR-review fan-out; Atlas invokes `$review-pr`.

Prefer launching Codex from `/Users/omercan/Desktop/cografya`. A nested-only launch
loads this adapter but must not assume the parent's project agents/config are discovered;
explicitly add/read the parent before shared-state work, and do not dispatch team roles
until the outer-root configuration is active.
