# CLI Commander Tool (`cct`)

Minimal, production-quality local CLI for macOS.

## What It Does

`cct` provides a single command entrypoint with plugin-based commands:

- `cct sys update`
- `cct api bluesky login`
- `cct api bluesky post --text "hello world"`
- `cct api bluesky read --limit 10`
- `cct api bluesky extract --actor bsky.app --limit 20 --out ./posts.json`
- `cct api bluesky followers --actor bsky.app --limit 20`
- `cct api bluesky auto-post --text "scheduled hello" --times 3 --intervalSeconds 60`
- `cct api bluesky auto-follow --actor bsky.app --limit 10 --dry-run`

It runs entirely on your machine and stores local state in `~/.cli-commander/`.

## Requirements

- macOS
- Node.js 18+
- Homebrew (for `sys update`)

## Install And Run

```bash
npm install
npm run build
npm run link
```

After linking:

```bash
cct sys update
```

## Development

### Run in dev mode

```bash
npm run dev -- sys update
npm run dev -- api bluesky login
npm run dev -- api bluesky post --text "test post"
npm run dev -- api bluesky read --limit 5
npm run dev -- api bluesky extract --actor bsky.app --limit 5 --out ./posts.json
npm run dev -- api bluesky followers --actor bsky.app --limit 10
npm run dev -- api bluesky auto-post --text "hello" --times 2 --intervalSeconds 30
npm run dev -- api bluesky auto-follow --actor bsky.app --limit 5 --dry-run
```

`sys update` is interactive by default and lets you choose from available updaters (Homebrew, casks/apps, Oh My Zsh, npm, pnpm via Corepack fallback, Node via nvm/Volta, and optional macOS updates). For pnpm updates, `cct` uses Corepack when available, and falls back to `pnpm self-update` when Corepack is missing. Use `--all` to run every available updater non-interactively:

```bash
cct sys update --all
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Use the linked CLI

```bash
npm run link
cct api bluesky post --text "from linked binary"
```

## Usage

### Non-interactive mode

```bash
cct <namespace> <command> [options]
```

Supported:

- `cct sys update`
- `cct api bluesky login`
- `cct api bluesky post --text "hello world"`
- `cct api bluesky read --limit 10`
- `cct api bluesky read --actor bsky.app --limit 10`
- `cct api bluesky extract --limit 50 --out ./bluesky-posts.json`
- `cct api bluesky followers --actor bsky.app --limit 20`
- `cct api bluesky auto-post --text "hello" --times 3 --intervalSeconds 60`
- `cct api bluesky auto-follow --actor bsky.app --limit 20 --dry-run`

### Interactive mode

Run without args:

```bash
cct
```

This opens nested menus (`sys`/`api` then plugin commands).

## Local Data

`cct` creates `~/.cli-commander/` on first write:

- `~/.cli-commander/secrets.json` for auth tokens
- `~/.cli-commander/state.json` for command state

No database is used.

## Troubleshooting

- Add `--debug` to show stack traces:
  - `cct api bluesky post --debug`
- If `sys update` fails, verify `brew` is installed and on `PATH`.
- `cct api bluesky login` starts a local web page and listens on `127.0.0.1` for your form submission.
- If a Bluesky command says session is missing/expired, run `cct api bluesky login` again.

## Maintenance Map

- CLI entry and argument handling: `src/core/cli.ts`
- Dynamic command routing: `src/core/router.ts`
- Auth and state persistence: `src/core/auth.ts`, `src/core/state.ts`
- Plugin commands: `src/plugins/**`

See module docs for contributor details:

- `src/core/README.md`
- `src/plugins/README.md`
