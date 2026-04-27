import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { getFlag, getNumberFlag, loadAgentFromSession } from "./client.js";

export const command: Command = {
  name: "read",
  description: "Read timeline or an author's feed from Bluesky",
  run: async (ctx, args) => {
    const agent = await loadAgentFromSession(ctx);
    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const actor = getFlag(rawArgs, "actor");
    const limit = getNumberFlag(rawArgs, "limit", 10);

    const posts = actor
      ? (await agent.getAuthorFeed({ actor, limit })).data.feed
      : (await agent.getTimeline({ limit })).data.feed;

    if (posts.length === 0) {
      console.log(chalk.yellow("⚠️ No posts found for this query."));
      return;
    }

    console.log(
      chalk.cyan(
        actor
          ? `📖 Showing up to ${limit} posts from ${actor}`
          : `📖 Showing up to ${limit} posts from your home timeline`
      )
    );
    for (const item of posts) {
      const post = item.post;
      const text = post.record && "text" in post.record ? String(post.record.text) : "";
      console.log(chalk.blue(`👤 ${post.author.handle} (${post.indexedAt})`));
      console.log(text.trim() || chalk.gray("[non-text post]"));
      console.log(chalk.gray("---"));
    }
  }
};
