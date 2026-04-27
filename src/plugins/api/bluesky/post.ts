import { input } from "@inquirer/prompts";
import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { getFlag, loadAgentFromSession } from "./client.js";

export const command: Command = {
  name: "post",
  description: "Post to Bluesky",
  run: async (ctx, args) => {
    const agent = await loadAgentFromSession(ctx);

    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const textFromFlag = getFlag(rawArgs, "text");
    const text =
      textFromFlag ??
      (await input({
        message: "Post text",
        required: true
      }));

    if (!text?.trim()) {
      throw new Error("Post text cannot be empty.");
    }

    console.log(chalk.cyan("📝 Publishing post..."));
    await agent.post({ text: text.trim() });
    console.log(chalk.green("✅ Posted to Bluesky."));
    await ctx.state.push("bluesky_posts", {
      text: text.trim(),
      createdAt: new Date().toISOString()
    });
    console.log(chalk.gray("💡 Tip: use cct api bluesky read --limit 5 to verify timeline."));
  }
};
