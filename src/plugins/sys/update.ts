import { checkbox, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { $ } from "zx";

import type { Command } from "../../core/types.js";

export const command: Command = {
  name: "update",
  description: "Interactively run common local system/tool updates",
  run: async (ctx, args) => {
    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const runAll = rawArgs.includes("--all");

    const tasks = [
      {
        id: "brew_core",
        label: "Homebrew formulae (brew update && brew upgrade && brew cleanup)",
        isAvailable: async () => hasCommand("brew"),
        run: async () => $`brew update && brew upgrade && brew cleanup`
      },
      {
        id: "brew_casks",
        label: "Homebrew casks/apps (brew upgrade --cask --greedy)",
        isAvailable: async () => hasCommand("brew"),
        run: async () => $`brew upgrade --cask --greedy`
      },
      {
        id: "oh_my_zsh",
        label: "Oh My Zsh (omz update)",
        isAvailable: async () => hasCommand("omz"),
        run: async () => $`omz update`
      },
      {
        id: "npm_global",
        label: "Global npm packages (npm update -g)",
        isAvailable: async () => hasCommand("npm"),
        run: async () => $`npm update -g`
      },
      {
        id: "pnpm_global",
        label:
          "pnpm + global pnpm packages (Corepack first, fallback to pnpm self-update)",
        isAvailable: async () =>
          (await hasCommand("corepack")) || (await hasCommand("pnpm")),
        run: async () => {
          if (await hasCommand("corepack")) {
            await $`corepack enable`;
            await $`corepack prepare pnpm@latest --activate`;
            await $`pnpm -g update`;
            return;
          }

          if (await hasCommand("pnpm")) {
            await $`pnpm self-update && pnpm -g update`;
            return;
          }

          ctx.log("Skipping pnpm update: corepack/pnpm not installed.");
        }
      },
      {
        id: "node_runtime",
        label: "Node runtime (nvm LTS or Volta latest)",
        isAvailable: async () => (await hasCommand("nvm")) || (await hasCommand("volta")),
        run: async () => {
          if (await hasCommand("nvm")) {
            await $`zsh -lc "nvm install --lts && nvm alias default lts/*"`;
            return;
          }
          await $`volta install node@latest`;
        }
      },
      {
        id: "macos",
        label: "macOS software updates (sudo softwareupdate -ia)",
        isAvailable: async () => hasCommand("softwareupdate"),
        run: async () => $`sudo softwareupdate -ia`
      }
    ] as const;

    const availableTasks = [];
    for (const task of tasks) {
      if (await task.isAvailable()) {
        availableTasks.push(task);
      } else if (ctx.debug) {
        ctx.log(`Skipping unavailable updater: ${task.id}`);
      }
    }

    if (availableTasks.length === 0) {
      throw new Error("No supported update tools were found on this machine.");
    }

    let selectedTaskIds = availableTasks.map((task) => task.id);
    if (!runAll) {
      selectedTaskIds = await checkbox({
        message: "Select updates to run",
        choices: availableTasks.map((task) => ({
          name: task.label,
          value: task.id,
          checked: task.id !== "macos"
        })),
        required: true
      });
    }

    const selectedTasks = availableTasks.filter((task) =>
      selectedTaskIds.includes(task.id)
    );

    if (selectedTasks.length === 0) {
      throw new Error("No update targets selected.");
    }

    const includesMacOsUpdate = selectedTasks.some((task) => task.id === "macos");
    if (includesMacOsUpdate && !runAll) {
      const approved = await confirm({
        message:
          "macOS updates may prompt for your password and can take a long time. Continue?",
        default: false
      });
      if (!approved) {
        throw new Error("Cancelled macOS update.");
      }
    }

    const failures: Array<{ id: string; error: string }> = [];
    for (const task of selectedTasks) {
      const spinner = ora(`Running: ${task.label}`).start();
      try {
        await task.run();
        spinner.succeed(chalk.green(`Completed: ${task.label}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail(chalk.red(`Failed: ${task.label}`));
        failures.push({ id: task.id, error: message });
      }
    }

    if (failures.length > 0) {
      const details = failures.map((f) => `${f.id}: ${f.error}`).join("; ");
      throw new Error(`Some updates failed. ${details}`);
    }

    ctx.log(`Completed ${selectedTasks.length} update task(s).`);
  }
};

async function hasCommand(commandName: string): Promise<boolean> {
  try {
    await $`command -v ${commandName}`;
    return true;
  } catch {
    return false;
  }
}
