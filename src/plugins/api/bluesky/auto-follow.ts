import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { getFlag, getNumberFlag, hasFlag, loadAgentFromSession } from "./client.js";

export const command: Command = {
  name: "auto-follow",
  description: "Auto-follow followers of a target actor",
  run: async (ctx, args) => {
    const agent = await loadAgentFromSession(ctx);
    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const actor = getFlag(rawArgs, "actor");
    const limit = getNumberFlag(rawArgs, "limit", 20);
    const dryRun = hasFlag(rawArgs, "dry-run");

    if (!actor) {
      throw new Error("Missing --actor. Example: cct api bluesky auto-follow --actor bsky.app");
    }

    const followers = (await agent.getFollowers({ actor, limit })).data.followers;
    if (followers.length === 0) {
      console.log(chalk.yellow(`No followers found for ${actor}.`));
      return;
    }

    let followed = 0;
    for (const follower of followers) {
      if (dryRun) {
        console.log(chalk.cyan(`[dry-run] Would follow ${follower.handle}`));
        continue;
      }
      await agent.follow(follower.did);
      followed += 1;
      console.log(chalk.green(`Followed ${follower.handle}`));
    }

    if (dryRun) {
      console.log(chalk.green(`Dry-run complete. ${followers.length} users evaluated.`));
      return;
    }

    console.log(chalk.green(`Auto-follow complete. Followed ${followed} users.`));
  }
};
