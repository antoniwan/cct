import chalk from "chalk";
import ora from "ora";
import { $ } from "zx";

import type { Command } from "../../core/types.js";

export const command: Command = {
  name: "update",
  description: "Run brew update and upgrade",
  run: async (ctx) => {
    const spinner = ora("Running macOS package updates...").start();
    try {
      await $`brew update && brew upgrade`;
      spinner.succeed(chalk.green("System packages updated successfully."));
      ctx.log("Completed: brew update && brew upgrade");
    } catch (error) {
      spinner.fail(chalk.red("Failed to run system update."));
      throw error;
    }
  }
};
