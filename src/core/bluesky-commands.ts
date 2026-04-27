import { commandTree } from "./router.js";

/** Must match `commandTree.api.bluesky` (menu + compile-time check). */
export type BlueskyCommandName = (typeof commandTree.api.bluesky)[number];

export const BLUESKY_COMMAND_LABELS: Record<BlueskyCommandName, string> = {
  login: "🔐 login - Web auth; no extra flags",
  post: "📝 post - Publish (--text or prompt)",
  read: "📖 read - Home or --actor feed, --limit",
  extract: "📦 extract - JSON export --actor, --limit, --out",
  followers: "👥 followers - List followers; optional --actor, --limit",
  unfollow:
    "🧹 unfollow - Policy wizard or flags (--all, --dry-run, --example-policy, …)",
  "auto-post": "🤖 auto-post - --text, --times, --intervalSeconds",
  "auto-follow": "🤝 auto-follow - --actor, --limit, optional --dry-run"
};

/**
 * Runtime guard: fails if a command is added to the router but not the label map
 * (or if labels have drifted). The `Record<BlueskyCommandName, string>` also enforces
 * keys at compile time when `commandTree` changes.
 */
export function assertBlueskyCommandLabelsInSyncWithRouter(): void {
  const fromTree = [...commandTree.api.bluesky].sort();
  const fromLabels = (Object.keys(BLUESKY_COMMAND_LABELS) as BlueskyCommandName[]).sort();
  if (fromTree.join("\0") !== fromLabels.join("\0")) {
    throw new Error(
      `Bluesky command label keys out of sync with commandTree. tree=${fromTree.join(",")} labels=${fromLabels.join(",")}`
    );
  }
}
