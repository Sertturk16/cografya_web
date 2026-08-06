# Claude Code Adapter — `cografya_web`

@ENGINEERING.md

The imported handbook is provider-neutral and binding. Claude-specific execution uses
the `cografya-frontend-dev` agent definition from the orchestration root. Vera remains
the single writer, has no `Agent` tool, and returns review orchestration to Atlas.

For shared process and product state, use the assigned task context manifest and read
only its exact sections in the orchestration root. Never load full `CONVENTIONS.md`,
`SEO-POLICY.md`, or `TASKS.md` by default. A session launched with its cwd inside this
repo loads only this adapter and the imported handbook — explicitly add the parent root
before shared-state work.
