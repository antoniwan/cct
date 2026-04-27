# Plugin Guide

Plugins provide command behavior. Keep them focused and local.

## Plugin Paths In This Repo

- `src/plugins/sys/<command>.ts` for sys root commands
- `src/plugins/api/<service>/<command>.ts` for API commands

## Current Plugins

- `sys/update.ts`
  - Interactive updater for common local tooling.
  - Supports Homebrew formulae/casks, Oh My Zsh, npm, pnpm (Corepack-first fallback), Node runtime (nvm/Volta), and optional macOS updates.
  - Use `cct sys update --all` to run all available updaters without prompts.
- `api/bluesky/login.ts`
  - Starts a local web login flow, opens your browser, and stores a resumable Bluesky session in `~/.cli-commander/secrets.json`.
- `api/bluesky/post.ts`
  - Resumes a saved Bluesky session.
  - Accepts `--text` or prompts interactively.
  - Publishes a real Bluesky post and records post text in state.
- `api/bluesky/read.ts`
  - Reads home timeline or `--actor` feed.
  - Supports `--limit`.
- `api/bluesky/extract.ts`
  - Extracts feed posts to JSON via `--out`.
  - Supports `--actor` and `--limit`.
- `api/bluesky/followers.ts`
  - Lists latest followers for `--actor`.
  - Defaults to logged-in handle when `--actor` is omitted.
  - Supports `--limit`.
- `api/bluesky/unfollow.ts`
  - Unfollows users you currently follow based on criteria rules.
  - Opens a guided interactive criteria setup when no rule flags are passed.
  - Supports `--interactive` to force guided setup.
  - Supports `--all` for full paginated scan, `--throttle-ms` to pace requests, profile cache via `--cache-ttl-minutes` / `--no-cache` (stored in `~/.cli-commander/state.json`), retries on transient network errors, plus `--match all|any`, `--dry-run`, and multiple filters.
  - Includes `--example-policy` (fewer followers than you AND no posts in last year).
- `api/bluesky/auto-post.ts`
  - Repeated posting with `--times` and `--intervalSeconds`.
- `api/bluesky/auto-follow.ts`
  - Follows followers of `--actor`.
  - Supports `--limit` and `--dry-run`.

## Quick Command Examples

```bash
cct sys update --all
cct api bluesky login
cct api bluesky post --text "hello"
cct api bluesky read --limit 10
cct api bluesky extract --out ./posts.json --limit 20
cct api bluesky followers --limit 10
cct api bluesky unfollow --example-policy --dry-run
cct api bluesky auto-post --text "ping" --times 2 --intervalSeconds 30
cct api bluesky auto-follow --actor bsky.app --limit 10 --dry-run
```

## Command Contract

Each plugin exports:

```ts
export const command: Command = {
  name: "my-command",
  description: "What it does",
  run: async (ctx, args) => {
    // implementation
  }
}
```

## Adding A New Plugin Command

1. Create command file under `src/plugins/<namespace>/<group>/<command>.ts` (or `src/plugins/sys/<command>.ts` for sys root commands).
2. Export a `command` object matching `Command` in `src/core/types.ts`.
3. Register dynamic import entry in `src/core/router.ts`.
4. If command needs interactive navigation, ensure it is represented in `commandTree` in `router.ts`.
5. Validate with:
   - `npm run build`
   - direct invocation and `cct` interactive mode

## Plugin Design Rules

- No network/service abstraction layer unless needed by multiple commands.
- Keep command logic close to command file.
- Prefer simple data flow through `ctx.auth`, `ctx.state`, and local helpers.
- Provide clear user-facing messages with `chalk`.

## Plugin Author Checklist

Before finishing plugin changes:

1. Confirm command is in `router.ts` loaders and `commandTree`.
2. Run command directly with realistic args.
3. Run command from interactive menu (`cct`).
4. Run `npm run build`.
5. Update docs in:
   - `README.md`
   - `src/core/README.md` (if core behavior changed)
   - `src/plugins/README.md`
