import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { getFlag, getNumberFlag, loadAgentFromSession } from "./client.js";

export const command: Command = {
  name: "followers",
  description: "List latest followers for an actor",
  run: async (ctx, args) => {
    const agent = await loadAgentFromSession(ctx);
    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const actor = getFlag(rawArgs, "actor") ?? agent.session?.handle;
    const limit = getNumberFlag(rawArgs, "limit", 20);

    if (!actor) {
      throw new Error(
        "Unable to infer actor. Pass --actor <handle> (example: --actor bsky.app)."
      );
    }

    const response = await agent.getFollowers({ actor, limit });
    const followers = response.data.followers;

    if (followers.length === 0) {
      console.log(chalk.yellow(`No followers found for ${actor}.`));
      return;
    }

    console.log(chalk.cyan(`Latest followers for ${actor}:`));
    for (const user of followers) {
      const label = user.displayName
        ? `${user.displayName} (@${user.handle})`
        : `@${user.handle}`;
      console.log(`- ${label}`);
    }
  }
};
