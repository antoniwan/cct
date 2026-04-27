# CLI Commander Tool (`cct`)

Minimal, production-quality local CLI for macOS.

## What It Does

`cct` provides a single command entrypoint with plugin-based commands:

- `cct sys update`
- `cct api bluesky login`
- `cct api bluesky post --text "hello world"`

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
- If `post` says token is missing, run `cct api bluesky login` first.

## Maintenance Map

- CLI entry and argument handling: `src/core/cli.ts`
- Dynamic command routing: `src/core/router.ts`
- Auth and state persistence: `src/core/auth.ts`, `src/core/state.ts`
- Plugin commands: `src/plugins/**`

See module docs for contributor details:

- `src/core/README.md`
- `src/plugins/README.md`
