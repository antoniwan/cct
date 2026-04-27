# Core Module Guide

This folder contains the command runtime, router, and local persistence services.

## Files

- `cli.ts`: CLI entry logic, argument parsing, interactive fallback, top-level error handling.
- `router.ts`: namespace/group/command routing and dynamic imports for plugins.
- `types.ts`: shared command/context interfaces.
- `auth.ts`: secret/session read/write service backed by `~/.cli-commander/secrets.json`.
- `state.ts`: generic JSON state service backed by `~/.cli-commander/state.json`.

## How To Extend Safely

1. Add plugin command file under `src/plugins/...`.
2. Register it in `router.ts` command loaders.
3. Ensure path parsing in `cli.ts` can reach it (current layout supports `sys` and `api` namespaces).
4. Run:
   - `npm run build`
   - command smoke test in dev mode

## Error Handling Rules

- Throw errors with actionable messages in plugins/services.
- Keep stack traces hidden by default.
- Print stack traces only when `--debug` is passed.

## Persistence Rules

- Keep auth/state local only (`~/.cli-commander/secrets.json`, `~/.cli-commander/state.json`).
- Use `fs/promises` and JSON files.
- Avoid schema migrations unless absolutely required; if introduced, document migration steps in root `README.md`.
