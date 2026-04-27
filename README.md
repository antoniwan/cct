# CLI Commander Tool (`cct`)

Local CLI for system tasks and Bluesky actions.

It runs on your machine and stores local files in `~/.cli-commander/`.

## Requirements

- macOS
- Node.js `>=18`
- Homebrew (only needed for `cct sys update`)

## Installation

### Project install (for development in this repo)

```bash
npm install
npm run build
```

### System-wide command install (`cct`)

This repo already has a link script:

```bash
npm run link
```

After this, `cct` is available in your shell.

Alternative global install from this local folder:

```bash
npm install -g .
```

## First Run

```bash
cct
```

This opens interactive menus.

Quick Bluesky setup:

```bash
cct api bluesky login
```

Then try:

```bash
cct api bluesky followers --limit 10
```

## Development Commands

```bash
# run source directly
npm run dev -- api bluesky followers --limit 5

# build TypeScript output
npm run build

# run tests
npm test
```

## CLI Usage

### General shape

```bash
cct <namespace> <groupOrCommand> [command] [options]
```

Examples:

- `cct sys update`
- `cct api bluesky login`
- `cct api bluesky post --text "hello world"`

### Interactive mode

```bash
cct
```

### Debug mode

`--debug` prints stack traces on errors:

```bash
cct api bluesky post --debug
```

## Command Reference

## `sys` namespace

### `cct sys update`

Interactive updater for local tooling.

```bash
cct sys update
```

Run all available updaters without prompts:

```bash
cct sys update --all
```

## `api bluesky` namespace

### 1) Login

```bash
cct api bluesky login
```

What happens:

- Starts a local page on `127.0.0.1`
- Opens browser for credentials
- Saves Bluesky session in `~/.cli-commander/secrets.json`

### 2) Post

Post with flag:

```bash
cct api bluesky post --text "hello from cct"
```

Or run without `--text` and answer prompt:

```bash
cct api bluesky post
```

### 3) Read timeline or author feed

Home timeline:

```bash
cct api bluesky read --limit 10
```

Specific actor:

```bash
cct api bluesky read --actor bsky.app --limit 10
```

Options:

- `--actor <handleOrDid>`
- `--limit <number>`

### 4) Extract posts to JSON

```bash
cct api bluesky extract --limit 50 --out ./bluesky-posts.json
```

Author feed extract:

```bash
cct api bluesky extract --actor bsky.app --limit 20 --out ./posts.json
```

Options:

- `--actor <handleOrDid>`
- `--limit <number>`
- `--out <filePath>`

### 5) List latest followers

Use logged-in account:

```bash
cct api bluesky followers --limit 20
```

Use explicit actor:

```bash
cct api bluesky followers --actor bsky.app --limit 20
```

Options:

- `--actor <handleOrDid>` (optional)
- `--limit <number>`

### 6) Auto-post

```bash
cct api bluesky auto-post --text "status update" --times 3 --intervalSeconds 60
```

Options:

- `--text <string>` (optional, prompts if missing)
- `--times <number>`
- `--intervalSeconds <number>`

### 7) Auto-follow

Preview only:

```bash
cct api bluesky auto-follow --actor bsky.app --limit 20 --dry-run
```

Execute:

```bash
cct api bluesky auto-follow --actor bsky.app --limit 20
```

Options:

- `--actor <handleOrDid>` (required)
- `--limit <number>`
- `--dry-run`

### 8) Unfollow cleanup

Interactive wizard (recommended first run):

```bash
cct api bluesky unfollow
```

Force interactive wizard even with flags:

```bash
cct api bluesky unfollow --interactive
```

Preset rule (your requested policy), dry-run:

```bash
cct api bluesky unfollow --example-policy --dry-run
```

Full account sweep, preset policy, dry-run:

```bash
cct api bluesky unfollow --all --example-policy --dry-run
```

Large follow lists can hit rate limits or short network blips. Add a small pause between accounts (milliseconds):

```bash
cct api bluesky unfollow --all --example-policy --dry-run --throttle-ms 50
```

Custom rule example (AND):

```bash
cct api bluesky unfollow \
  --less-followers-than-me \
  --no-posts-since --inactive-days 365 \
  --max-posts 20 \
  --match all \
  --dry-run
```

Unfollow options:

- `--example-policy`  
  Fewer followers than you AND no posts in last year.
- `--less-followers-than-me`
- `--no-posts-since`
- `--inactive-days <days>`
- `--max-followers <n>`
- `--max-following <n>`
- `--max-posts <n>`
- `--match all|any`
- `--limit <n>` (used when `--all` is not set)
- `--all` (scan all followed accounts with pagination)
- `--dry-run`
- `--interactive`
- `--throttle-ms <n>` optional pause between accounts (0 = no pause; try 25–100 on long runs)
- `--cache-ttl-minutes <n>` (default `60`, `0` = same as no cache) reuse recent profile + last-post data from a local cache to skip duplicate API calls on the next run
- `--no-cache` do not read or write the profile cache

**Matching vs unfollowing:** After step 2, the tool evaluates **every** account in the current scan. Step 3 keeps only accounts that pass your rules. Step 4 unfollows **that** matched set. Example: you might scan 1,900+ follows but only 48 match “fewer followers than me and inactive a year” — the command unfollows those 48, not 1,900. The number `50` in `--limit` is only the default **scan** size when you do **not** use `--all`; it is not a cap on how many accounts you can unfollow in step 4.

`unfollow` prints progress in the terminal (fetch pages, profile scan, filters, unfollow steps). API calls that fail with common network or rate-limit errors are retried a few times with backoff before the command gives up. If a rule does not need “last post” time, the command skips the extra feed request per account to reduce load.

**Profile cache:** Data is stored under the key `bluesky_unfollow_profile_cache` inside `~/.cli-commander/state.json`, scoped to the logged-in account. Entries expire by TTL so “inactive since last post” rules are not stuck on very old data forever.

## Local Data Files

`cct` writes:

- `~/.cli-commander/secrets.json` (Bluesky session secrets)
- `~/.cli-commander/state.json` (local command state, including `bluesky_unfollow_profile_cache` for `unfollow` when caching is on)

No database is used.

## Troubleshooting

- If a Bluesky command says session is missing or expired, run:
  - `cct api bluesky login`
- If `sys update` fails, verify:
  - `brew` is installed
  - `brew` is in your `PATH`
- For full error stack traces:
  - add `--debug` to your command
- If `unfollow` stops with `fetch failed` after many accounts, run again (progress is not saved). Add `--throttle-ms 50` (or higher) to slow the request rate.

## Code Map

- CLI entry and argument handling: `src/core/cli.ts`
- Dynamic command routing: `src/core/router.ts`
- Auth and state persistence: `src/core/auth.ts`, `src/core/state.ts`
- Plugin commands: `src/plugins/**`

More contributor docs:

- `src/core/README.md`
- `src/plugins/README.md`
