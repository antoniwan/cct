# AGENTS: Documentation Upkeep Rules

This file defines how agents must keep project docs accurate as code changes land.

## Scope

These rules apply to every change in this repository.

## Source Of Truth

- Code is the source of truth.
- Docs must reflect current behavior, paths, commands, and scripts.
- If docs and code conflict, update docs in the same change.

## Required Docs To Maintain

- Root usage/development guide: `README.md`
- Core architecture/maintenance guide: `src/core/README.md`
- Plugin authoring/maintenance guide: `src/plugins/README.md`

## Mandatory Doc Update Triggers

Update docs whenever a change affects:

1. CLI usage syntax, flags, examples, or command paths
2. Project scripts (`dev`, `build`, `link`) or setup steps
3. File/folder structure referenced by docs
4. Plugin registration flow or command contract
5. Auth/state storage paths or behavior
6. Error handling or debug behavior visible to users

## Agent Workflow For Every Code Change

1. Implement code changes.
2. Check which docs are impacted using the trigger list above.
3. Update all impacted docs in the same task.
4. Run `npm run build` after doc + code edits (to catch accidental code regressions).
5. In final response, include a short "Docs updated" list with touched doc paths.

## Writing Standards

- Keep docs concise and operational.
- Prefer runnable command examples.
- Use exact file paths and command names.
- Avoid roadmap/speculative language in maintenance docs.
- Do not document abstractions that do not exist in code.

## Anti-Drift Checklist

Before finishing, verify:

- Command examples still execute with current CLI parser.
- Mentioned scripts exist in `package.json`.
- Mentioned files/directories exist.
- Auth/state paths match implementation (`~/.cli-commander/secrets.json`, `~/.cli-commander/state.json`).

## If Unsure

When a change might impact docs, treat it as impacted and update docs proactively.
