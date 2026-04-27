# Core Module Guide

This folder contains the command runtime, router, and local persistence services.

## Files

- `cli.ts`: CLI entry logic, argument parsing, interactive fallback, top-level error handling. When the path comes from the interactive menu, `rawArgs` is rebuilt (e.g. `api`, `bluesky`, `read`, plus any flags) so plugins see the same flag layout as a typed invocation.
- `bluesky-commands.ts`: `BLUESKY_COMMAND_LABELS` for the Bluesky action menu; keep keys in sync with `commandTree.api.bluesky` (see `assertBlueskyCommandLabelsInSyncWithRouter` and `test/bluesky-labels.test.mjs`).
- `bluesky-menu.ts`: second-level interactive prompts (flag presets) after choosing a Bluesky command.
- `router.ts`: namespace/group/command routing and dynamic imports for plugins.
- `types.ts`: shared command/context interfaces.
- `auth.ts`: secret/session read/write service backed by `~/.cli-commander/secrets.json`.
- `state.ts`: generic JSON state service backed by `~/.cli-commander/state.json` (e.g. `bluesky_unfollow_profile_cache` written by the Bluesky `unfollow` command when caching is enabled).

## Runtime Flow (Simple View)

1. `src/index.ts` calls `runCli(process.argv)`.
2. `cli.ts` parses args and creates `ctx` (`auth`, `state`, `log`, `debug`).
3. `cli.ts` resolves command path (from args or interactive menu).
4. `router.ts` dynamically imports the plugin command.
5. Plugin runs and may read/write:
   - `~/.cli-commander/secrets.json`
   - `~/.cli-commander/state.json`

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

Example:

```bash
cct api bluesky post --debug
```

## Persistence Rules

- Keep auth/state local only (`~/.cli-commander/secrets.json`, `~/.cli-commander/state.json`).
- Use `fs/promises` and JSON files.
- Avoid schema migrations unless absolutely required; if introduced, document migration steps in root `README.md`.

## Useful Maintenance Commands

```bash
# build
npm run build

# run tests
npm test

# run from source
npm run dev -- api bluesky followers --limit 5
```
