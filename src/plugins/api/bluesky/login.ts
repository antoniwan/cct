import { password } from "@inquirer/prompts";
import chalk from "chalk";

import type { Command } from "../../../core/types.js";

export const command: Command = {
  name: "login",
  description: "Authenticate with Bluesky",
  run: async (ctx) => {
    const token = await password({
      message: "Enter Bluesky API token",
      mask: "*"
    });

    if (!token.trim()) {
      throw new Error("Token cannot be empty.");
    }

    await ctx.auth.set("bluesky", token.trim());
    console.log(
      chalk.green("Bluesky token saved to ~/.cli-commander/secrets.json")
    );
  }
};
