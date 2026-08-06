# Claude Code Adapter — `cografya_web`

@ENGINEERING.md

The imported handbook is provider-neutral and binding. Claude-specific execution uses
the `cografya-frontend-dev` agent definition from the orchestration root. Vera remains
the single writer, has no `Agent` tool, and returns review orchestration to Atlas.

For shared process and product state, start from the assigned task context manifest.
Read `CONVENTIONS.md`, `SEO-POLICY.md` and `CONTENT-STYLE.md` as far as the task needs;
economise on _history_ — `DECISIONS.md`, board archives, provenance ledgers — by grepping
the heading. **Reading more is not the failure mode; missing a binding rule is**
(→ DEC 2026-08-06w). When your task's output type obliges a source, read it whether or not
the manifest cited it: any reader-facing string obliges `CONTENT-STYLE.md`.

A session launched with its cwd inside this repo loads only this adapter and the
imported handbook — explicitly add the parent root before shared-state work.
