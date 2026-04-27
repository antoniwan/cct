import { input } from "@inquirer/prompts";
import chalk from "chalk";

import type { Command } from "../../../core/types.js";

export const command: Command = {
  name: "post",
  description: "Post to Bluesky",
  run: async (ctx, args) => {
    const token = await ctx.auth.get("bluesky");
    if (!token) {
      throw new Error("Missing Bluesky token. Run: cct api bluesky login");
    }

    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const textFlagIndex = rawArgs.indexOf("--text");
    const textFromFlag =
      textFlagIndex >= 0 ? rawArgs[textFlagIndex + 1] : undefined;
    const text =
      textFromFlag ??
      (await input({
        message: "Post text",
        required: true
      }));

    if (!text?.trim()) {
      throw new Error("Post text cannot be empty.");
    }

    console.log(chalk.green("Posted to Bluesky (simulated)."));
    console.log(chalk.gray(`Token prefix: ${token.slice(0, 4)}...`));
    console.log(text.trim());
    await ctx.state.push("bluesky_posts", {
      text: text.trim(),
      createdAt: new Date().toISOString()
    });
  }
};
